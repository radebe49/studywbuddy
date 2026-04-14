import os
import json
import asyncio
import re
import hmac
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from supabase import create_client, Client
from pypdf import PdfReader
from google import genai
import uvicorn
from dotenv import load_dotenv
import uuid
import datetime

load_dotenv()

# Configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
APP_SECRET = os.environ.get("APP_SECRET")
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "ALLOWED_ORIGINS",
        "https://studywbuddy.vercel.app,http://localhost:3000",
    ).split(",")
    if o.strip()
]

if not all([SUPABASE_URL, SUPABASE_KEY, GOOGLE_API_KEY]):
    raise ValueError("Missing environment variables: SUPABASE_URL, SUPABASE_KEY, GOOGLE_API_KEY")

if not APP_SECRET or len(APP_SECRET) < 16:
    raise ValueError(
        "APP_SECRET env var must be set to a non-trivial value (>=16 chars). "
        "No fallback is permitted — refusing to boot."
    )

# Initialize Clients
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
client = genai.Client(api_key=GOOGLE_API_KEY)

# Model Definitions (2026 Fleet)
GEMMA_MODEL = "gemma-4-31b-it"        # High precision, German extraction
GEMINI_MODEL = "gemini-3-flash-preview" # Large context, voice, planning

# Upload limits
MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", 25 * 1024 * 1024))  # 25 MB default
PDF_MAGIC = b"%PDF-"

app = FastAPI(title="DadTutor API")

PUBLIC_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}


@app.middleware("http")
async def verify_app_secret(request: Request, call_next):
    # Always let CORS preflight and public paths through; CORS middleware (added
    # below, wraps this one) will attach the right headers on responses.
    if request.method == "OPTIONS" or request.url.path in PUBLIC_PATHS:
        return await call_next(request)

    secret = request.headers.get("X-App-Secret", "")
    if not hmac.compare_digest(secret, APP_SECRET):
        return JSONResponse({"detail": "Unauthorized"}, status_code=401)

    return await call_next(request)


# CORS added AFTER the auth middleware so CORS becomes the outermost layer and
# correctly decorates 401/500 responses with Access-Control-Allow-* headers.
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-App-Secret", "Authorization"],
)

@app.get("/health")
def health_check():
    """Check if the backend is running and connected to services."""
    status = {"status": "ok", "services": {}}
    
    # Check Supabase
    try:
        supabase.table("exams").select("count", count="exact").execute()
        status["services"]["supabase"] = "connected"
    except Exception as e:
        status["services"]["supabase"] = f"error: {str(e)}"
        status["status"] = "degraded"

    # Check Gemini (simple model list or check api key presence)
    if GOOGLE_API_KEY:
        status["services"]["gemini"] = "configured"
    else:
        status["services"]["gemini"] = "missing_key"
        status["status"] = "degraded"
        
    return status

@app.get("/settings")
def get_user_settings():
    """Get the current user specialization."""
    res = supabase.table("user_settings").select("*").eq("user_id", "default_user").execute()
    if res.data:
        return res.data[0]
    return {"specialization": None}

class UpdateSettingsRequest(BaseModel):
    specialization: str

@app.post("/settings")
def update_user_settings(request: UpdateSettingsRequest):
    """Update the current user specialization."""
    data = {
        "user_id": "default_user",
        "specialization": request.specialization
    }
    # Upsert
    res = supabase.table("user_settings").upsert(data, on_conflict="user_id").execute()
    return res.data[0]

@app.post("/maintenance/timeout-sweep")
def timeout_sweep():
    """Mark exams stuck in 'processing' for more than 15 minutes as failed."""
    fifteen_mins_ago = (datetime.datetime.now() - datetime.timedelta(minutes=15)).isoformat()
    
    # We use a raw query or try to filter by date
    # Supabase Python client filter
    res = supabase.table("exams")\
        .update({"status": "failed", "error_message": "Verarbeitung abgebrochen (Zeitüberschreitung)"})\
        .eq("status", "processing")\
        .lt("upload_date", fifteen_mins_ago)\
        .execute()
        
    return {"count": len(res.data) if res.data else 0}

# --- Models ---

class GeneratePlanRequest(BaseModel):
    exam_solutions: List[Dict[str, Any]]

class ChatMessage(BaseModel):
    role: str
    content: str

class FachgespraechRequest(BaseModel):
    messages: List[ChatMessage]
    context_topic: Optional[str] = None
    context_questions: Optional[List[Dict[str, Any]]] = None

# --- PDF Extraction ---
def extract_text_from_pdf(file_path: str) -> str:
    try:
        reader = PdfReader(file_path)
        text = ""
        for page in reader.pages:
            result = page.extract_text()
            if result:
                text += result + "\n"
        return text
    except Exception as e:
        print(f"Error extracting PDF text: {e}")
        return ""

# --- NLP PIPELINE: Regex-Based Question Extraction ---

def pre_extract_questions(text: str) -> List[Dict[str, Any]]:
    """
    Uses regex and heuristics to identify potential question blocks.
    Returns a list of candidate questions with metadata.
    """
    candidates = []
    
    # --- Regex Patterns ---
    # Pattern 1: Numbered questions (1., 2., Q1, Question 1, etc.)
    numbered_pattern = re.compile(
        r'(?:^|\n)\s*(?:(?:Q(?:uestion)?\s*)?([0-9]+)[.)]\s*)(.+?)(?=(?:\n\s*(?:Q(?:uestion)?\s*)?[0-9]+[.)])|\Z)',
        re.IGNORECASE | re.DOTALL
    )
    
    # Pattern 2: MCQ options (a), b), c), d) or A. B. C. D.)
    mcq_options_pattern = re.compile(
        r'[\(\[]?[a-dA-D][\).]\s*.+',
        re.MULTILINE
    )
    
    # Pattern 3: True/False indicators
    tf_pattern = re.compile(
        r'\b(?:True\s*(?:\/|or)?\s*False|T\s*\/\s*F)\b',
        re.IGNORECASE
    )

    # Pattern 4: Essay/Long form ("Discuss", "Explain", "Describe")
    essay_keywords_pattern = re.compile(
        r'\b(?:Discuss|Explain|Describe|Analyze|Evaluate|Compare|Contrast|Justify|Elaborate)\b',
        re.IGNORECASE
    )
    
    # Pattern 5: Short Answer ("Define", "List", "Name", "State")
    short_answer_keywords_pattern = re.compile(
        r'\b(?:Define|List|Name|State|Identify|What is|Give an example)\b',
        re.IGNORECASE
    )

    # --- Extraction ---
    matches = numbered_pattern.findall(text)
    
    for i, match in enumerate(matches):
        q_num = match[0].strip()
        q_text = match[1].strip()
        
        # Trim excessive whitespace/newlines within question text
        q_text = re.sub(r'\s+', ' ', q_text)
        
        if len(q_text) < 10:  # Skip fragments too short to be questions
            continue

        # --- Classify Question Type ---
        q_type = "Unknown"
        if mcq_options_pattern.search(q_text):
            q_type = "Multiple Choice"
        elif tf_pattern.search(q_text):
            q_type = "True/False"
        elif essay_keywords_pattern.search(q_text):
            q_type = "Essay"
        elif short_answer_keywords_pattern.search(q_text):
            q_type = "Short Answer"
        else:
            q_type = "Short Answer"  # Default fallback
            
        candidates.append({
            "questionNumber": q_num,
            "questionText": q_text,
            "type": q_type,
            "source": "regex"
        })
        
    # Fallback: If regex finds very few questions, the raw text will still be sent to AI.
    if len(candidates) < 2:
        print("NLP Pre-extraction: Low question count from regex, relying more on AI.")
        # Return an empty list; the main prompt will handle it from raw text.
        # This is intentional to avoid sending bad data.
        # We could also add a "rawTextChunks" fallback here later.
        
    print(f"NLP Pre-extraction: Found {len(candidates)} candidate questions.")
    return candidates

# --- JSON Parsing ---
def parse_json_from_markdown(text: str):
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    
    try:
        start = text.find("```json")
        if start != -1:
            end = text.find("```", start + 7)
            if end != -1:
                json_str = text[start+7:end].strip()
                return json.loads(json_str)
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            json_str = text[start:end+1]
            return json.loads(json_str)
    except Exception as e:
        print(f"JSON Parsing failed: {e}")
    return {}

# --- Prompts ---

# Official IHK Taxonomy for Industriemeister Elektrotechnik
IHK_TAXONOMY = {
    "BQ": {
        "name": "Basisqualifikationen",
        "subjects": [
            "Rechtsbewusstes Handeln",
            "Betriebswirtschaftliches Handeln",
            "Anwendung von Methoden der Information, Kommunikation und Planung",
            "Zusammenarbeit im Betrieb",
            "Berücksichtigung naturwissenschaftlicher und technischer Gesetzmäßigkeiten (NTG)"
        ]
    },
    "HQ": {
        "name": "Handlungsspezifische Qualifikationen",
        "subjects": {
            "Technik": [
                "Infrastruktursysteme und Betriebstechnik",
                "Automatisierungs- und Informationstechnik"
            ],
            "Organisation": [
                "Betriebliches Kostenwesen",
                "Planungs-, Steuerungs- und Kommunikationssysteme",
                "Arbeits-, Umwelt- und Gesundheitsschutz"
            ],
            "Führung und Personal": [
                "Personalführung",
                "Personalentwicklung",
                "Qualitätsmanagement"
            ]
        }
    }
}

EXAM_SYSTEM_PROMPT = """
You are an expert tutor for the German "Industriemeister Elektrotechnik IHK" examination.
Analyze the following extracted text from an exam paper. The output MUST be in German (Deutsch).

CRITICAL: Classify each question according to the OFFICIAL IHK TAXONOMY below:

## Part A: Basisqualifikationen (BQ)
1. Rechtsbewusstes Handeln (Arbeitsrecht, Umweltrecht, Vertragsrecht)
2. Betriebswirtschaftliches Handeln (BWL, Rechnungswesen, Kostenrechnung)
3. Anwendung von Methoden der Information, Kommunikation und Planung (Projektmanagement, Präsentation)
4. Zusammenarbeit im Betrieb (Personalwesen, Führung, Sozialsysteme)
5. Berücksichtigung naturwissenschaftlicher und technischer Gesetzmäßigkeiten (NTG) (Mathematik, Physik, Chemie, Statistik)

## Part B: Handlungsspezifische Qualifikationen (HQ)
### Handlungsbereich "Technik":
- Infrastruktursysteme und Betriebstechnik
- Automatisierungs- und Informationstechnik

### Handlungsbereich "Organisation":
- Betriebliches Kostenwesen
- Planungs-, Steuerungs- und Kommunikationssysteme
- Arbeits-, Umwelt- und Gesundheitsschutz

### Handlungsbereich "Führung und Personal":
- Personalführung
- Personalentwicklung
- Qualitätsmanagement

IMPORTANT CONTEXT: Our NLP pre-processor has identified some candidate questions (provided below in `CANDIDATE_QUESTIONS`).
Use these as a strong starting point, but verify and refine them. The candidates may be incomplete or slightly incorrect.
You should also identify any questions the pre-processor may have MISSED in the raw text.

1. Identify the qualification area (BQ or HQ) and the specific subject from the taxonomy above.
2. For each validated question:
   - Solve it concisely but clearly in German.
   - Provide a brief explanation for the solution in German.
   - Assign "qualificationArea" as either "BQ" or "HQ".
   - Assign "subject" to one of the official IHK subjects listed above.
   - Assign "topic" to a more specific sub-topic within that subject.
   - Confirm the question type (Multiple Choice, True/False, Short Answer, Essay, Calculation).
3. Summarize the overall difficulty and key topics covered in German.

Return the result strictly as a valid JSON object matching this schema:
{
  "subject": "String (official IHK subject name)",
  "qualificationArea": "BQ" | "HQ",
  "handlungsbereich": "String (only for HQ: Technik, Organisation, or Führung und Personal)",
  "year": "String",
  "difficulty": "Easy" | "Medium" | "Hard",
  "topics": ["String"],
  "summary": "String",
  "scenarios": [
    {
      "index": Number,
      "contextText": "String (The shared scenario text / Situationsbeschreibung)"
    }
  ],
  "questions": [
    {
      "questionNumber": "String",
      "questionText": "String",
      "scenarioIndex": Number (Reference the index in 'scenarios' list above if this question belongs to a scenario),
      "type": "Multiple Choice" | "True/False" | "Short Answer" | "Essay" | "Calculation",
      "qualificationArea": "BQ" | "HQ",
      "subject": "String (official IHK subject name)",
      "topic": "String (specific sub-topic)",
      "solution": "String",
      "explanation": "String",
      "points": {
        "total": Number,
        "breakdown": [
          {"step": "String", "pts": Number}
        ]
      }
    }
  ]
}
"""


PLAN_SYSTEM_PROMPT = """
Based on the following analysis of past exam papers, create a comprehensive 7-day study plan in German (Deutsch) to help a student master these subjects.

Focus on:
1. Weak areas implied by "Hard" difficulty papers or complex topics.
2. Balanced revision schedule.
3. Specific actionable tasks for each day.

Output valid JSON matching this schema:
{
  "title": "String",
  "overview": "String",
  "schedule": [
    {
      "day": 1,
      "date": "ISO Date String (starting tomorrow)",
      "focus": "String",
      "tasks": ["String", "String"],
      "durationMinutes": 60
    }
  ]
}
"""

FACHGESPRAECH_SYSTEM_PROMPT = """
You are a member of the "Prüfungsausschuss" (Examination Board) for the German "Industriemeister Elektrotechnik IHK" qualification. 
Your role is to simulate the "Fachgespräch" (oral technical discussion/defense).

SCENARIO:
The user is preparing for the oral exam. Your goal is to probe their knowledge and ability to justify their technical decisions.

INSTRUCTIONS:
1.  **Identity**: You are a professional, slightly formal, but fair examiner. Use "Sie" (formal you).
2.  **Technique**: Do NOT just tell them if they are right or wrong immediately. 
3.  **Probing**: Ask "Why?" and "How?". 
    - "Warum haben Sie sich für dieses Schutzorgan entschieden?"
    - "Welche VDE-Vorschrift liegt hier zugrunde?"
    - "Was wäre die Konsequenz, wenn wir den Leitungsquerschnitt verringern?"
4.  **Feedback**: Provide subtle hints if they are stuck, but encourage them to find the answer themselves.
5.  **Grading**: After several exchanges, if you feel they have demonstrated competence or failure, provide a brief evaluation of their "Handlungskompetenz" (ability to act/competence) in German.

CURRENT CONTEXT:
Topic: {topic}

RESPONSE GUIDELINE:
Keep responses concise, professional, and entirely in German.
"""

STUDY_GUIDE_PROMPT = """
You are an expert tutor. Based on the following exam questions about "{topic}", create a comprehensive study guide / cheat sheet in German (Deutsch).

QUESTIONS ABOUT THIS TOPIC:
{questions}

Create a study guide that includes:

1. **Summary**: A concise 2-3 paragraph explanation of the core concepts related to this topic.
2. **Key Concepts**: The most important ideas a student MUST understand, as bullet points.
3. **Formulas/Rules**: Any formulas, theorems, or rules that apply (if applicable). Use LaTeX notation.
4. **Common Mistakes**: What students typically get wrong and how to avoid it.
5. **Example Problems**: 2-3 worked examples with step-by-step solutions and IHK-compliant point breakdowns (showing how to earn maximum points).
6. **Quick Tips**: Memory tricks, shortcuts, or study strategies.
7. **Punkte-Strategie (Point Strategy)**: Specific advice on how to structure answers to maximize points for this type of topic in an IHK exam.

Output valid JSON matching this schema:
{
  "topic": "String",
  "subject": "String",
  "summary": "String (markdown formatted)",
  "keyConcepts": ["String", "String"],
  "formulas": [
    {
      "name": "String",
      "formula": "String (LaTeX)",
      "description": "String"
    }
  ],
  "commonMistakes": [
    {
      "mistake": "String",
      "correction": "String"
    }
  ],
  "exampleProblems": [
    {
      "problem": "String",
      "solution": "String (step by step)"
    }
  ],
  "quickTips": ["String", "String"]
}
"""

# --- Background Task ---

def process_exam_background(exam_id: str, file_path: str):
    print(f"Processing exam {exam_id}...")
    supabase.table("exams").update({"status": "processing"}).eq("id", exam_id).execute()

    try:
        raw_text = extract_text_from_pdf(file_path)
        if not raw_text:
            raise ValueError("Could not extract text from PDF")

        # --- NLP Pre-Processing Step ---
        print(f"Running NLP pre-extraction for exam {exam_id}...")
        candidate_questions = pre_extract_questions(raw_text)
        
        # Format candidates for the prompt
        candidates_json_str = json.dumps(candidate_questions, indent=2) if candidate_questions else "(None found by pre-processor)"

        print(f"Calling Gemma ({GEMMA_MODEL}) for exam {exam_id}...")
        
        # Enhanced prompt with pre-extracted candidates
        full_prompt = f"""{EXAM_SYSTEM_PROMPT}

--- CANDIDATE_QUESTIONS (from NLP pre-processor) ---
{candidates_json_str}

--- RAW TEXT (verify and find any missed questions) ---
{raw_text[:400000]}
"""
        
        response = client.models.generate_content(
            model=GEMMA_MODEL,
            contents=full_prompt,
            config={
                'response_mime_type': 'application/json',
            }
        )
        
        ai_output = parse_json_from_markdown(response.text)
        
        # Save solution to study_plans table (reusing table for solution storage)
        study_plan_data = {
            "exam_id": exam_id,
            "raw_json": ai_output,
            "markdown_plan": ai_output.get("summary", "Processed successfully")
        }
        
        # Upsert
        existing = supabase.table("study_plans").select("*").eq("exam_id", exam_id).execute()
        if existing.data:
            supabase.table("study_plans").update(study_plan_data).eq("exam_id", exam_id).execute()
        else:
            supabase.table("study_plans").insert(study_plan_data).execute()

        # Get specialization from settings
        settings_res = supabase.table("user_settings").select("specialization").eq("user_id", "default_user").execute()
        user_specialization = settings_res.data[0]['specialization'] if settings_res.data else None

        # Update exam record with extracted metadata
        supabase.table("exams").update({
            "status": "completed",
            "qualification_area": ai_output.get("qualificationArea"),
            "handlungsbereich": ai_output.get("handlungsbereich"),
            "specialization": user_specialization
        }).eq("id", exam_id).execute()

        # --- NEW: Save scenarios and questions to structured tables ---
        # 1. Save Scenarios
        scenario_map = {} # ai_index -> db_uuid
        for ai_scenario in ai_output.get("scenarios", []):
            scenario_data = {
                "exam_id": exam_id,
                "context_text": ai_scenario.get("contextText"),
                "order": ai_scenario.get("index", 0)
            }
            s_res = supabase.table("scenarios").insert(scenario_data).execute()
            if s_res.data:
                scenario_map[ai_scenario.get("index")] = s_res.data[0]['id']

        # 2. Save Questions
        for ai_q in ai_output.get("questions", []):
            scenario_idx = ai_q.get("scenarioIndex")
            q_data = {
                "exam_id": exam_id,
                "scenario_id": scenario_map.get(scenario_idx) if scenario_idx is not None else None,
                "question_number": ai_q.get("questionNumber"),
                "question_text": ai_q.get("questionText"),
                "type": ai_q.get("type"),
                "qualification_area": ai_q.get("qualificationArea"),
                "subject": ai_q.get("subject"),
                "topic": ai_q.get("topic"),
                "solution": ai_q.get("solution"),
                "explanation": ai_q.get("explanation"),
                "points_total": ai_q.get("points", {}).get("total"),
                "points_breakdown": ai_q.get("points", {}).get("breakdown")
            }
            supabase.table("questions").insert(q_data).execute()
            
        print(f"Exam {exam_id} processed successfully with structured scenarios and questions.")

    except Exception as e:
        error_msg = str(e)
        print(f"Error processing exam {exam_id}: {error_msg}")
        
        # Check for specific Google AI errors
        if "429" in error_msg:
            error_msg = "KI-Nutzungslimit überschritten (Quote). Bitte versuchen Sie es später erneut."
        elif "500" in error_msg and "Google" in error_msg:
            error_msg = "KI-Dienstfehler. Bitte versuchen Sie es erneut."
            
        supabase.table("exams").update({
            "status": "failed",
            "error_message": error_msg[:1000]
        }).eq("id", exam_id).execute()

    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

# --- Endpoints ---

def _safe_filename(name: Optional[str]) -> str:
    """Strip path separators and exotic chars from a client-supplied filename."""
    base = os.path.basename(name or "upload.pdf")
    base = re.sub(r"[^A-Za-z0-9._-]", "_", base)
    if not base.lower().endswith(".pdf"):
        base += ".pdf"
    return base[:128] or "upload.pdf"


@app.post("/upload")
async def upload_exam(file: UploadFile = File(...), background_tasks: BackgroundTasks = None):
    # 1. Validate content type & extension before reading the whole body
    declared_ct = (file.content_type or "").lower()
    if declared_ct and declared_ct not in ("application/pdf", "application/x-pdf"):
        raise HTTPException(status_code=415, detail="Nur PDF-Dateien werden unterstützt.")

    safe_name = _safe_filename(file.filename)

    # 2. Stream into a temp file with a size cap & magic-byte check on the first chunk
    os.makedirs("temp", exist_ok=True)
    local_path = f"temp/{uuid.uuid4()}_{safe_name}"

    total = 0
    header_checked = False
    try:
        with open(local_path, "wb") as f:
            while True:
                chunk = await file.read(1024 * 1024)  # 1 MiB chunks
                if not chunk:
                    break
                if not header_checked:
                    if not chunk.startswith(PDF_MAGIC):
                        raise HTTPException(
                            status_code=415,
                            detail="Datei ist keine gültige PDF (Magic-Bytes fehlen).",
                        )
                    header_checked = True
                total += len(chunk)
                if total > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"Datei überschreitet Maximum ({MAX_UPLOAD_BYTES // (1024*1024)} MB).",
                    )
                f.write(chunk)

        if total == 0 or not header_checked:
            raise HTTPException(status_code=400, detail="Leere oder ungültige Datei.")

        # 3. Upload to Supabase Storage
        storage_path = f"exams/{uuid.uuid4()}_{safe_name}"
        with open(local_path, "rb") as f:
            supabase.storage.from_("exams").upload(path=storage_path, file=f)

        # 4. Create database record
        exam_data = {
            "filename": safe_name,
            "storage_path": storage_path,
            "status": "uploading",
        }
        res = supabase.table("exams").insert(exam_data).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to insert into DB")

        exam_id = res.data[0]["id"]

        # 5. Trigger background processing
        background_tasks.add_task(process_exam_background, exam_id, local_path)

        return {"message": "Upload successful", "exam_id": exam_id}
    except HTTPException:
        if os.path.exists(local_path):
            os.remove(local_path)
        raise
    except Exception as e:
        if os.path.exists(local_path):
            os.remove(local_path)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/exams")
def list_exams():
    # Return exams with minimal info
    res = supabase.table("exams").select("*").order("upload_date", desc=True).execute()
    return res.data

@app.post("/retry/{exam_id}")
async def retry_exam(exam_id: str, background_tasks: BackgroundTasks):
    # Fetch exam details
    res = supabase.table("exams").select("*").eq("id", exam_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    exam = res.data
    storage_path = exam['storage_path']
    
    # Download from storage to temp
    if not os.path.exists("temp"):
        os.makedirs("temp")
    
    local_path = f"temp/retry_{uuid.uuid4()}_{exam['filename']}"
    try:
        with open(local_path, "wb+") as f:
            res = supabase.storage.from_("exams").download(storage_path)
            f.write(res)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download from storage: {e}")

    # Mark as processing
    supabase.table("exams").update({"status": "processing", "error_message": None}).eq("id", exam_id).execute()
    
    background_tasks.add_task(process_exam_background, exam_id, local_path)
    return {"message": "Retry started", "exam_id": exam_id}

@app.get("/solutions/{exam_id}")
def get_solution(exam_id: str):
    # 1. Fetch Exam metadata
    exam_res = supabase.table("exams").select("*").eq("id", exam_id).execute()
    if not exam_res.data:
        raise HTTPException(status_code=404, detail="Exam not found")
    exam = exam_res.data[0]

    # 2. Try fetching from structured tables
    q_res = supabase.table("questions").select("*, scenarios(*)").eq("exam_id", exam_id).execute()
    
    if q_res.data:
        # Reconstruct the ExamSolution structure for the frontend
        sp_res = supabase.table("study_plans").select("raw_json").eq("exam_id", exam_id).execute()
        raw_json = sp_res.data[0]['raw_json'] if sp_res.data else {}
        
        # Map structured questions back to frontend format
        questions = []
        for q in q_res.data:
            scenario_text = q.get("scenarios", {}).get("context_text") if q.get("scenarios") else None
            
            # Format points breakdown as string for frontend display
            pts_breakdown = q.get("points_breakdown")
            pts_str = ""
            if isinstance(pts_breakdown, list):
                pts_str = "\n".join([f"• {b.get('step')}: {b.get('pts')} Pkt" for b in pts_breakdown if isinstance(b, dict)])
            elif isinstance(pts_breakdown, str):
                pts_str = pts_breakdown
                
            questions.append({
                "questionNumber": q.get("question_number"),
                "questionText": q.get("question_text"),
                "contextScenario": scenario_text,
                "type": q.get("type"),
                "qualificationArea": q.get("qualification_area"),
                "subject": q.get("subject"),
                "topic": q.get("topic"),
                "solution": q.get("solution"),
                "explanation": q.get("explanation"),
                "points": q.get("points_total"),
                "pointsBreakdown": pts_str
            })
        
        # Sort questions by number if possible
        try:
            questions.sort(key=lambda x: int(x['questionNumber'].split('.')[0]) if x['questionNumber'] else 99)
        except:
            pass

        return {
            "subject": raw_json.get("subject", exam.get("qualification_area")),
            "qualificationArea": exam.get("qualification_area"),
            "handlungsbereich": exam.get("handlungsbereich"),
            "year": raw_json.get("year"),
            "difficulty": raw_json.get("difficulty", "Medium"),
            "topics": raw_json.get("topics", []),
            "summary": raw_json.get("summary", ""),
            "questions": questions
        }

    # 3. Fallback to legacy raw_json
    sp_res = supabase.table("study_plans").select("raw_json").eq("exam_id", exam_id).execute()
    if sp_res.data:
        return sp_res.data[0]['raw_json']
    
    raise HTTPException(status_code=404, detail="Solution not found")

@app.post("/generate-plan")
async def generate_plan(request: GeneratePlanRequest):
    # Takes in MULTIPLE exam solutions and generates a master plan
    papers_summary = ""
    for p in request.exam_solutions:
        papers_summary += f"Subject: {p.get('subject', 'Unknown')}, Topics: {', '.join(p.get('topics', []))}, Difficulty: {p.get('difficulty', 'Unknown')}\n"

    try:
        # Planning across multiple papers involves large context aggregation
        print(f"Generating plan with {GEMINI_MODEL}...")
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=f"{PLAN_SYSTEM_PROMPT}\n\nData:\n{papers_summary}",
            config={
                'response_mime_type': 'application/json',
            }
        )
        plan_json = parse_json_from_markdown(response.text)
        
        # Add metadata
        plan_json['id'] = str(uuid.uuid4())
        plan_json['generatedAt'] = datetime.datetime.now().isoformat()
        
        return plan_json
    except Exception as e:
        print(f"Error generating plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Practice Progress Endpoints ---

class PracticeSessionCreate(BaseModel):
    exam_id: str
    exam_name: str
    total_questions: int
    correct_count: int
    incorrect_count: int
    score_percentage: int

@app.post("/progress/sessions")
async def save_practice_session(session: PracticeSessionCreate):
    """Save a practice session result to the database."""
    try:
        session_data = {
            "exam_id": session.exam_id,
            "exam_name": session.exam_name,
            "total_questions": session.total_questions,
            "correct_count": session.correct_count,
            "incorrect_count": session.incorrect_count,
            "score_percentage": session.score_percentage
        }
        res = supabase.table("practice_sessions").insert(session_data).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to save session")
        return {"message": "Session saved", "session_id": res.data[0]['id']}
    except Exception as e:
        print(f"Error saving practice session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/progress")
def get_progress():
    """Get overall progress data including all sessions and aggregate stats."""
    try:
        # Fetch all practice sessions, ordered by date
        res = supabase.table("practice_sessions").select("*").order("session_date", desc=True).execute()
        sessions = res.data or []
        
        # Calculate aggregate stats
        questions_mastered = sum(s.get('correct_count', 0) for s in sessions)
        questions_attempted = sum(s.get('total_questions', 0) for s in sessions)
        
        return {
            "sessions": sessions,
            "questionsMastered": questions_mastered,
            "questionsAttempted": questions_attempted
        }
    except Exception as e:
        print(f"Error fetching progress: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/progress/exam/{exam_id}")
def get_exam_progress(exam_id: str):
    """Get progress data for a specific exam."""
    try:
        res = supabase.table("practice_sessions").select("*").eq("exam_id", exam_id).order("session_date", desc=True).execute()
        return res.data or []
    except Exception as e:
        print(f"Error fetching exam progress: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Study Guide / Topic Summary Endpoints ---

class GenerateStudyGuideRequest(BaseModel):
    topic: str
    exam_ids: Optional[List[str]] = None  # If None, aggregate from all exams

@app.post("/study-guides/generate")
async def generate_study_guide(request: GenerateStudyGuideRequest):
    """Generate a study guide for a specific topic by aggregating questions from exams."""
    try:
        # 1. Fetch questions related to the topic
        query = supabase.table("questions").select("*, scenarios(context_text)")
        if request.exam_ids:
            query = query.in_("exam_id", request.exam_ids)
        
        res = query.execute()
        
        if not res.data:
            # Fallback to legacy study_plans if questions table is empty for some reason
            res_legacy = supabase.table("study_plans").select("*").execute()
            # ... (omitting legacy fallback for brevity, but could keep it)
            raise HTTPException(status_code=404, detail="No structured question data found. Please trigger an analysis first.")
        
        # 2. Extract questions matching the topic
        topic_lower = request.topic.lower()
        related_questions = []
        subject = None
        source_exam_ids = []
        
        for q in res.data:
            q_topic = (q.get("topic") or "").lower()
            if topic_lower in q_topic or q_topic in topic_lower:
                scenario_text = q.get("scenarios", {}).get("context_text") if q.get("scenarios") else None
                related_questions.append({
                    "questionText": q.get("question_text", ""),
                    "solution": q.get("solution", ""),
                    "explanation": q.get("explanation", ""),
                    "points": q.get("points_total"),
                    "scenario": scenario_text
                })
                if q.get("exam_id") not in source_exam_ids:
                    source_exam_ids.append(q.get("exam_id"))
                if not subject:
                    subject = q.get("subject")
        
        if not related_questions:
            raise HTTPException(status_code=404, detail=f"No questions found for topic: {request.topic}")
        
        # 3. Generate study guide using LLM
        formatted_qs = []
        for q in related_questions[:15]:
            scenario_part = f"SCENARIO: {q['scenario']}\n" if q['scenario'] else ""
            formatted_qs.append(f"{scenario_part}Q: {q['questionText']} ({q['points'] or '?' } Pkt)\nA: {q['solution']}\nExplanation: {q['explanation']}")
        questions_text = "\n\n".join(formatted_qs)
        
        prompt = STUDY_GUIDE_PROMPT.format(topic=request.topic, questions=questions_text)
        
        # High precision requirements for study guides
        print(f"Generating study guide with {GEMMA_MODEL} for topic: {request.topic}...")
        response = client.models.generate_content(
            model=GEMMA_MODEL,
            contents=prompt,
            config={
                'response_mime_type': 'application/json',
            }
        )
        
        guide_json = parse_json_from_markdown(response.text)
        
        # 4. Save to database
        summary_data = {
            "topic": request.topic,
            "subject": subject or guide_json.get("subject"),
            "summary_markdown": guide_json.get("summary", ""),
            "key_concepts": guide_json.get("keyConcepts", []),
            "formulas": guide_json.get("formulas", []),
            "common_mistakes": guide_json.get("commonMistakes", []),
            "example_questions": guide_json.get("exampleProblems", []),
            "point_strategy": guide_json.get("pointStrategy", ""),
            "source_exam_ids": source_exam_ids
        }
        
        # Check if guide already exists for this topic (upsert)
        existing = supabase.table("topic_summaries").select("id").eq("topic", request.topic).execute()
        if existing.data:
            supabase.table("topic_summaries").update(summary_data).eq("topic", request.topic).execute()
            guide_id = existing.data[0]["id"]
        else:
            insert_res = supabase.table("topic_summaries").insert(summary_data).execute()
            guide_id = insert_res.data[0]["id"]
        
        return {
            "id": guide_id,
            "topic": request.topic,
            "questionsUsed": len(related_questions),
            **guide_json
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error generating study guide: {e}")
        # Return a more descriptive error if possible (careful not to leak sensitive info, but detailed enough for debugging)
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@app.get("/study-guides")
def list_study_guides():
    """List all generated study guides."""
    try:
        res = supabase.table("topic_summaries").select("id, topic, subject, created_at, updated_at").order("updated_at", desc=True).execute()
        return res.data or []
    except Exception as e:
        print(f"Error listing study guides: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/study-guides/{guide_id}")
def get_study_guide(guide_id: str):
    """Get a specific study guide by ID."""
    try:
        res = supabase.table("topic_summaries").select("*").eq("id", guide_id).single().execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Study guide not found")
        return res.data
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching study guide: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/topics")
def list_available_topics():
    """List all unique topics found across all exams (for generating study guides)."""
    try:
        res = supabase.table("study_plans").select("raw_json").execute()
        topics = set()
        for row in res.data or []:
            raw_json = row.get("raw_json", {})
            for q in raw_json.get("questions", []):
                topic = q.get("topic")
                if topic:
                    topics.add(topic)
        return sorted(list(topics))
    except Exception as e:
        print(f"Error listing topics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/fachgespraech")
async def chat_fachgespraech(request: FachgespraechRequest):
    """Simulate a Fachgespräch (oral exam defense)."""
    try:
        # Prepare history for Gemini
        chat_history = []
        for msg in request.messages[:-1]: # All but the last one
            chat_history.append({
                "role": "user" if msg.role == "user" else "model",
                "parts": [{"text": msg.content}]
            })
        
        system_instructions = FACHGESPRAECH_SYSTEM_PROMPT.format(
            topic=request.context_topic or "Elektrotechnik Allgemein"
        )
        
        # Oral prep uses Gemini 3 Flash for speed and conversational nuance
        # Start a chat session
        chat = client.chats.create(
            model=GEMINI_MODEL,
            config={
                'system_instruction': system_instructions
            },
            history=chat_history
        )
        
        last_user_message = request.messages[-1].content
        response = chat.send_message(last_user_message)
        
        return {"role": "assistant", "content": response.text}
    except Exception as e:
        print(f"Error in fachgespraech: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
