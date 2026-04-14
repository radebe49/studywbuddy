import os
import json
import asyncio
import re
import hmac
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Body, Request, Depends
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
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

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

# Initialize Service Client (for background tasks/initialization if needed, 
# although we prefer authenticated clients for RLS)
supabase_service: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
client = genai.Client(api_key=GOOGLE_API_KEY)

# Rate Limiter
limiter = Limiter(key_func=get_remote_address)
security = HTTPBearer()

# Model Definitions (2026 Fleet)
GEMMA_MODEL = "gemma-4-31b-it"        # High precision, German extraction
GEMINI_MODEL = "gemini-3-flash-preview" # Large context, voice, planning

# Upload limits
MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", 25 * 1024 * 1024))  # 25 MB default
PDF_MAGIC = b"%PDF-"

app = FastAPI(title="DadTutor API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"], # Drop X-App-Secret
)

# Authentication & Supabase Client Dependency
async def get_supabase(auth: HTTPAuthorizationCredentials = Depends(security)):
    """ Initialize a Supabase client with the user's JWT to respect RLS. """
    access_token = auth.credentials
    try:
        # Create client with user's specific JWT
        # This client is local to the request and respects RLS
        user_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        user_client.postgrest.auth(access_token)
        
        # Verify user
        auth_res = user_client.auth.get_user(access_token)
        if not auth_res.user:
            raise HTTPException(status_code=401, detail="Invalid session")
            
        return user_client, auth_res.user
    except Exception as e:
        print(f"Auth error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

# Dependency for routes that need auth but not necessarily the client
async def get_current_user(auth: HTTPAuthorizationCredentials = Body(security)):
    _, user = await get_supabase(auth)
    return user

@app.get("/health")
def health_check():
    """Check if the backend is running and connected to services."""
    status = {"status": "ok", "services": {}}
    
    # Check Supabase
    try:
        supabase_service.table("exams").select("count", count="exact").execute()
        status["services"]["supabase"] = "connected"
    except Exception as e:
        status["services"]["supabase"] = f"error: {str(e)}"
        status["status"] = "degraded"

    # Check Gemini
    if GOOGLE_API_KEY:
        status["services"]["gemini"] = "configured"
    else:
        status["services"]["gemini"] = "missing_key"
        status["status"] = "degraded"
        
    return status

@app.get("/settings")
def get_user_settings(dep: tuple = Depends(get_supabase)):
    """Get the current user specialization."""
    supabase, user = dep
    res = supabase.table("user_settings").select("*").execute()
    if res.data:
        return res.data[0]
    return {"specialization": None}

class UpdateSettingsRequest(BaseModel):
    specialization: str

@app.post("/settings")
def update_user_settings(request: UpdateSettingsRequest, dep: tuple = Depends(get_supabase)):
    """Update the current user specialization."""
    supabase, user = dep
    data = {
        "user_id": user.id,
        "specialization": request.specialization
    }
    # Upsert using RLS
    res = supabase.table("user_settings").upsert(data).execute()
    return res.data[0]

@app.post("/maintenance/timeout-sweep")
def timeout_sweep():
    """Mark exams stuck in 'processing' for more than 15 minutes as failed. (Admin only - naturally works via cron)"""
    fifteen_mins_ago = (datetime.datetime.now() - datetime.timedelta(minutes=15)).isoformat()
    
    res = supabase_service.table("exams")\
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

# --- Background Task ---

def process_exam_background(exam_id: str, file_path: str, user_id: str):
    print(f"Processing exam {exam_id} for user {user_id}...")
    supabase_service.table("exams").update({"status": "processing"}).eq("id", exam_id).execute()

    try:
        raw_text = extract_text_from_pdf(file_path)
        if not raw_text:
            raise ValueError("Could not extract text from PDF")

        # --- NLP Pre-Processing Step ---
        candidate_questions = pre_extract_questions(raw_text)
        candidates_json_str = json.dumps(candidate_questions, indent=2) if candidate_questions else "(None found by pre-processor)"

        print(f"Calling Gemma for exam {exam_id}...")
        
        full_prompt = f"""{EXAM_SYSTEM_PROMPT}

--- CANDIDATE_QUESTIONS (from NLP pre-processor) ---
{candidates_json_str}

--- RAW TEXT (verify and find any missed questions) ---
{raw_text[:400000]}
"""
        
        response = client.models.generate_content(
            model=GEMMA_MODEL,
            contents=full_prompt,
            config={'response_mime_type': 'application/json'}
        )
        
        ai_output = parse_json_from_markdown(response.text)
        
        # Save solution
        study_plan_data = {
            "exam_id": exam_id,
            "user_id": user_id,
            "raw_json": ai_output,
            "markdown_plan": ai_output.get("summary", "Processed successfully")
        }
        
        supabase_service.table("study_plans").upsert(study_plan_data, on_conflict="exam_id").execute()

        # Get specialization from settings
        settings_res = supabase_service.table("user_settings").select("specialization").eq("user_id", user_id).execute()
        user_specialization = settings_res.data[0]['specialization'] if settings_res.data else None

        # Update exam record
        supabase_service.table("exams").update({
            "status": "completed",
            "qualification_area": ai_output.get("qualificationArea"),
            "handlungsbereich": ai_output.get("handlungsbereich"),
            "specialization": user_specialization
        }).eq("id", exam_id).execute()

        # Save Scenarios
        scenario_map = {}
        for ai_scenario in ai_output.get("scenarios", []):
            scenario_data = {
                "exam_id": exam_id,
                "user_id": user_id,
                "context_text": ai_scenario.get("contextText"),
                "order": ai_scenario.get("index", 0)
            }
            s_res = supabase_service.table("scenarios").insert(scenario_data).execute()
            if s_res.data:
                scenario_map[ai_scenario.get("index")] = s_res.data[0]['id']

        # Save Questions
        for ai_q in ai_output.get("questions", []):
            scenario_idx = ai_q.get("scenarioIndex")
            q_data = {
                "exam_id": exam_id,
                "user_id": user_id,
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
            supabase_service.table("questions").insert(q_data).execute()
            
    except Exception as e:
        error_msg = str(e)
        if "429" in error_msg:
            error_msg = "KI-Nutzungslimit überschritten (Quote). Bitte versuchen Sie es später erneut."
        elif "500" in error_msg and "Google" in error_msg:
            error_msg = "KI-Dienstfehler. Bitte versuchen Sie es erneut."
            
        supabase_service.table("exams").update({
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
@limiter.limit("10/hour")
async def upload_exam(
    request: Request,
    file: UploadFile = File(...), 
    background_tasks: BackgroundTasks = None,
    dep: tuple = Depends(get_supabase)
):
    supabase, user = dep
    declared_ct = (file.content_type or "").lower()
    if declared_ct and declared_ct not in ("application/pdf", "application/x-pdf"):
        raise HTTPException(status_code=415, detail="Nur PDF-Dateien werden unterstützt.")

    safe_name = _safe_filename(file.filename)

    os.makedirs("temp", exist_ok=True)
    local_path = f"temp/{uuid.uuid4()}_{safe_name}"

    total = 0
    header_checked = False
    try:
        with open(local_path, "wb") as f:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                if not header_checked:
                    if not chunk.startswith(PDF_MAGIC):
                        raise HTTPException(status_code=415, detail="Datei ist keine gültige PDF.")
                    header_checked = True
                total += len(chunk)
                if total > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="Datei zu groß.")
                f.write(chunk)

        storage_path = f"exams/{user.id}/{uuid.uuid4()}_{safe_name}"
        with open(local_path, "rb") as f:
            supabase_service.storage.from_("exams").upload(path=storage_path, file=f)

        exam_data = {
            "user_id": user.id,
            "filename": safe_name,
            "storage_path": storage_path,
            "status": "uploading",
        }
        res = supabase.table("exams").insert(exam_data).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to insert into DB")

        exam_id = res.data[0]["id"]
        background_tasks.add_task(process_exam_background, exam_id, local_path, user.id)

        return {"message": "Upload successful", "exam_id": exam_id}
    except Exception as e:
        if os.path.exists(local_path):
            os.remove(local_path)
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/exams")
def list_exams(dep: tuple = Depends(get_supabase)):
    supabase, user = dep
    res = supabase.table("exams").select("*").order("upload_date", desc=True).execute()
    return res.data

@app.post("/retry/{exam_id}")
async def retry_exam(exam_id: str, background_tasks: BackgroundTasks, dep: tuple = Depends(get_supabase)):
    supabase, user = dep
    res = supabase.table("exams").select("*").eq("id", exam_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    exam = res.data
    storage_path = exam['storage_path']
    
    if not os.path.exists("temp"):
        os.makedirs("temp")
    
    local_path = f"temp/retry_{uuid.uuid4()}_{exam['filename']}"
    try:
        # Download in thread to avoid blocking event loop
        content = await asyncio.to_thread(supabase_service.storage.from_("exams").download, storage_path)
        with open(local_path, "wb+") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download: {e}")

    supabase.table("exams").update({"status": "processing", "error_message": None}).eq("id", exam_id).execute()
    background_tasks.add_task(process_exam_background, exam_id, local_path, user.id)
    return {"message": "Retry started", "exam_id": exam_id}

@app.get("/solutions/{exam_id}")
def get_solution(exam_id: str, dep: tuple = Depends(get_supabase)):
    supabase, user = dep
    exam_res = supabase.table("exams").select("*").eq("id", exam_id).execute()
    if not exam_res.data:
        raise HTTPException(status_code=404, detail="Exam not found or no access")
    exam = exam_res.data[0]

    q_res = supabase.table("questions").select("*, scenarios(*)").eq("exam_id", exam_id).execute()
    
    if q_res.data:
        sp_res = supabase.table("study_plans").select("raw_json").eq("exam_id", exam_id).execute()
        raw_json = sp_res.data[0]['raw_json'] if sp_res.data else {}
        
        questions = []
        for q in q_res.data:
            scenario_text = q.get("scenarios", {}).get("context_text") if q.get("scenarios") else None
            pts_breakdown = q.get("points_breakdown")
            pts_str = ""
            if isinstance(pts_breakdown, list):
                pts_str = "\n".join([f"• {b.get('step')}: {b.get('pts')} Pkt" for b in pts_breakdown if isinstance(b, dict)])
            elif isinstance(pts_breakdown, str):
                pts_str = pts_breakdown
                
            questions.append({
                "id": q.get("id"),
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
        
        try:
            questions.sort(key=lambda x: int(re.sub(r'[^0-9]', '', x['questionNumber'])) if x['questionNumber'] else 999)
        except: pass

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

    sp_res = supabase.table("study_plans").select("raw_json").eq("exam_id", exam_id).execute()
    if sp_res.data:
        return sp_res.data[0]['raw_json']
    
    raise HTTPException(status_code=404, detail="Solution not found")

@app.post("/generate-plan")
@limiter.limit("5/hour")
async def generate_plan(request: Request, body: GeneratePlanRequest, dep: tuple = Depends(get_supabase)):
    supabase, user = dep
    papers_summary = ""
    for p in body.exam_solutions:
        papers_summary += f"Subject: {p.get('subject', 'Unknown')}, Topics: {', '.join(p.get('topics', []))}, Difficulty: {p.get('difficulty', 'Unknown')}\n"

    try:
        print(f"Generating plan for {user.id}...")
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=f"{PLAN_SYSTEM_PROMPT}\n\nData:\n{papers_summary}",
            config={'response_mime_type': 'application/json'}
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
def save_practice_session(session: Dict[str, Any], dep: tuple = Depends(get_supabase)):
    supabase, user = dep
    session["user_id"] = user.id
    res = supabase.table("practice_sessions").insert(session).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to save session")
    return {"session_id": res.data[0]["id"]}

@app.get("/progress")
def get_progress(dep: tuple = Depends(get_supabase)):
    supabase, user = dep
    # RLS ensures we only get our own sessions
    res = supabase.table("practice_sessions").select("*").order("session_date", desc=True).execute()
    sessions = res.data or []
    
    total_q = sum(s.get("total_questions", 0) for s in sessions)
    correct = sum(s.get("correct_count", 0) for s in sessions)
    
    return {
        "sessions": sessions,
        "questionsAttempted": total_q,
        "questionsMastered": correct
    }

@app.get("/progress/exam/{exam_id}")
def get_exam_progress(exam_id: str, dep: tuple = Depends(get_supabase)):
    supabase, user = dep
    res = supabase.table("practice_sessions").select("*").eq("exam_id", exam_id).order("session_date", desc=True).execute()
    return res.data or []

# --- Study Guide / Topic Summary Endpoints ---

@app.get("/topics")
def list_available_topics(dep: tuple = Depends(get_supabase)):
    supabase, user = dep
    res = supabase.table("questions").select("topic").execute()
    topics = sorted(list(set(q["topic"] for q in res.data if q.get("topic"))))
    return topics

@app.post("/study-guides/generate")
@limiter.limit("10/hour")
async def generate_study_guide(request: Request, body: Dict[str, Any], dep: tuple = Depends(get_supabase)):
    supabase, user = dep
    topic = body.get("topic")
    if not topic:
        raise HTTPException(status_code=400, detail="Topic required")

    # Fetch questions for context (RLS applies)
    q_res = supabase.table("questions").select("*").eq("topic", topic).limit(15).execute()
    if not q_res.data:
         raise HTTPException(status_code=404, detail="No questions found for this topic.")

    questions_context = ""
    for q in q_res.data:
        questions_context += f"Q: {q['question_text']}\nA: {q['solution']}\n\n"

    try:
        print(f"Generating study guide for {topic}...")
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=STUDY_GUIDE_PROMPT.format(topic=topic, questions=questions_context),
            config={'response_mime_type': 'application/json'}
        )
        guide_data = parse_json_from_markdown(response.text)
        
        # Save to database (Syncing with updated schema)
        db_data = {
            "user_id": user.id,
            "topic": topic,
            "subject": guide_data.get("subject"),
            "summary_markdown": guide_data.get("summary"),
            "key_concepts": guide_data.get("keyConcepts"),
            "formulas": guide_data.get("formulas"),
            "common_mistakes": guide_data.get("commonMistakes"),
            "example_questions": guide_data.get("exampleProblems"),
            "point_strategy": guide_data.get("point_strategy"),
            "quick_tips": guide_data.get("quickTips")
        }
        res = supabase.table("topic_summaries").upsert(db_data, on_conflict="user_id, topic").execute()
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/study-guides")
def list_study_guides(dep: tuple = Depends(get_supabase)):
    supabase, user = dep
    res = supabase.table("topic_summaries").select("id, topic, subject, created_at").order("updated_at", desc=True).execute()
    return res.data or []

@app.get("/study-guides/{id}")
def get_study_guide(id: str, dep: tuple = Depends(get_supabase)):
    supabase, user = dep
    res = supabase.table("topic_summaries").select("*").eq("id", id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Guide not found")
    return res.data[0]

@app.delete("/exams/{exam_id}")
async def delete_exam(exam_id: str, dep: tuple = Depends(get_supabase)):
    supabase, user = dep
    # 1. Verify existence/access
    res = supabase.table("exams").select("storage_path").eq("id", exam_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    storage_path = res.data['storage_path']
    
    # 2. Delete (Cascade handled by DB or explicit if needed)
    supabase.table("exams").delete().eq("id", exam_id).execute()
    
    # 3. Storage cleanup (service key needed for storage delete usually if owner check is complex)
    try:
        supabase_service.storage.from_("exams").remove([storage_path])
    except: pass
    
    return {"message": "Deleted successfully"}

@app.post("/fachgespraech")
@limiter.limit("30/hour")
async def chat_fachgespraech(request: Request, body: FachgespraechRequest, dep: tuple = Depends(get_supabase)):
    supabase, user = dep
    topic = body.context_topic or "Allgemeine Elektrotechnik"
    
    chat_history = []
    for msg in body.messages[:-1]:
        chat_history.append({
            "role": "user" if msg.role == "user" else "model",
            "parts": [{"text": msg.content}]
        })

    try:
        chat = client.chats.create(
            model=GEMINI_MODEL,
            config={'system_instruction': FACHGESPRAECH_SYSTEM_PROMPT.format(topic=topic)},
            history=chat_history
        )
        
        response = chat.send_message(body.messages[-1].content)
        return {"role": "assistant", "content": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
