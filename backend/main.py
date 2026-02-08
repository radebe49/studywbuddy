import os
import json
import asyncio
import re
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from pypdf import PdfReader
import google.generativeai as genai
import uvicorn
from dotenv import load_dotenv
import uuid
import datetime

load_dotenv()

# Configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")

if not all([SUPABASE_URL, SUPABASE_KEY, GOOGLE_API_KEY]):
    raise ValueError("Missing environment variables: SUPABASE_URL, SUPABASE_KEY, GOOGLE_API_KEY")

# Initialize Clients
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
genai.configure(api_key=GOOGLE_API_KEY)

SELECTED_MODEL = "gemini-3-flash-preview"

app = FastAPI(title="DadTutor API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*", "https://studywbuddy.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
  "questions": [
    {
      "questionNumber": "String",
      "questionText": "String",
      "type": "Multiple Choice" | "True/False" | "Short Answer" | "Essay" | "Calculation",
      "qualificationArea": "BQ" | "HQ",
      "subject": "String (official IHK subject name)",
      "topic": "String (specific sub-topic)",
      "solution": "String",
      "explanation": "String"
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
5. **Example Problems**: 2-3 worked examples with step-by-step solutions.
6. **Quick Tips**: Memory tricks, shortcuts, or study strategies.

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

        print(f"Calling Gemini ({SELECTED_MODEL}) for exam {exam_id}...")
        model = genai.GenerativeModel(SELECTED_MODEL)
        
        # Enhanced prompt with pre-extracted candidates
        full_prompt = f"""{EXAM_SYSTEM_PROMPT}

--- CANDIDATE_QUESTIONS (from NLP pre-processor) ---
{candidates_json_str}

--- RAW TEXT (verify and find any missed questions) ---
{raw_text[:400000]}
"""
        
        response = model.generate_content(
            full_prompt, 
            generation_config={"response_mime_type": "application/json"}
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

        supabase.table("exams").update({"status": "completed"}).eq("id", exam_id).execute()
        print(f"Exam {exam_id} processed successfully.")

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
            "error_message": error_msg[:1000]  # Truncate to avoid DB errors
        }).eq("id", exam_id).execute()
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

# --- Endpoints ---

@app.post("/upload")
async def upload_exam(file: UploadFile = File(...), background_tasks: BackgroundTasks = None):
    # Ensure temp dir exists
    if not os.path.exists("temp"):
        os.makedirs("temp")
        
    temp_filename = f"temp/temp_{file.filename}"
    with open(temp_filename, "wb") as buffer:
        buffer.write(await file.read())

    try:
        exam_data = {
            "filename": file.filename,
            "storage_path": temp_filename,
            "status": "uploading"
        }
        res = supabase.table("exams").insert(exam_data).execute()
        if not res.data:
             raise HTTPException(status_code=500, detail="Failed to insert into DB")
             
        exam_id = res.data[0]['id']

        background_tasks.add_task(process_exam_background, exam_id, temp_filename)
        
        return {"message": "Upload successful", "exam_id": exam_id}
    except Exception as e:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/exams")
def list_exams():
    # Return exams with minimal info
    res = supabase.table("exams").select("*").order("upload_date", desc=True).execute()
    return res.data

@app.get("/solutions/{exam_id}")
def get_solution(exam_id: str):
    # Fetch the solution stored in 'study_plans' table (legacy name)
    res = supabase.table("study_plans").select("raw_json").eq("exam_id", exam_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Solution not found")
    return res.data[0]['raw_json']

@app.post("/generate-plan")
async def generate_plan(request: GeneratePlanRequest):
    # Takes in MULTIPLE exam solutions and generates a master plan
    papers_summary = ""
    for p in request.exam_solutions:
        papers_summary += f"Subject: {p.get('subject', 'Unknown')}, Topics: {', '.join(p.get('topics', []))}, Difficulty: {p.get('difficulty', 'Unknown')}\n"

    try:
        print(f"Generating plan with {SELECTED_MODEL}...")
        model = genai.GenerativeModel(SELECTED_MODEL)
        response = model.generate_content(
            f"{PLAN_SYSTEM_PROMPT}\n\nData:\n{papers_summary}",
            generation_config={"response_mime_type": "application/json"}
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
        # 1. Fetch exam solutions to aggregate questions by topic
        if request.exam_ids:
            # Filter to specific exams
            res = supabase.table("study_plans").select("*").in_("exam_id", request.exam_ids).execute()
        else:
            # Get all completed exams
            res = supabase.table("study_plans").select("*").execute()
        
        if not res.data:
            raise HTTPException(status_code=404, detail="No exam data found")
        
        # 2. Extract questions matching the topic
        topic_lower = request.topic.lower()
        related_questions = []
        subject = None
        source_exam_ids = []
        
        for row in res.data:
            raw_json = row.get("raw_json", {})
            if not subject:
                subject = raw_json.get("subject")
            
            questions = raw_json.get("questions", [])
            for q in questions:
                q_topic = q.get("topic", "").lower()
                if topic_lower in q_topic or q_topic in topic_lower:
                    related_questions.append({
                        "questionText": q.get("questionText", ""),
                        "solution": q.get("solution", ""),
                        "explanation": q.get("explanation", "")
                    })
                    if row.get("exam_id") not in source_exam_ids:
                        source_exam_ids.append(row.get("exam_id"))
        
        if not related_questions:
            raise HTTPException(status_code=404, detail=f"No questions found for topic: {request.topic}")
        
        # 3. Generate study guide using LLM
        questions_text = "\n\n".join([
            f"Q: {q['questionText']}\nA: {q['solution']}\nExplanation: {q['explanation']}"
            for q in related_questions[:10]  # Limit to 10 questions to avoid token overflow
        ])
        
        prompt = STUDY_GUIDE_PROMPT.format(topic=request.topic, questions=questions_text)
        
        print(f"Generating study guide for topic: {request.topic}...")
        model = genai.GenerativeModel(SELECTED_MODEL)
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
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
        model = genai.GenerativeModel(SELECTED_MODEL)
        
        # Prepare history for Gemini
        chat_history = []
        for msg in request.messages[:-1]: # All but the last one
            chat_history.append({
                "role": "user" if msg.role == "user" else "model",
                "parts": [msg.content]
            })
        
        system_instructions = FACHGESPRAECH_SYSTEM_PROMPT.format(
            topic=request.context_topic or "Elektrotechnik Allgemein"
        )
        
        # Start a chat session
        chat = model.start_chat(history=chat_history)
        
        # Send system prompt as the first message or personality instruction
        # Note: Gemini 1.5 prefers system_instruction in GenerativeModel init, 
        # but for this script's patterns we can prefix the first message or use it as a preamble.
        # However, to maintain flow, we'll just send the last message with the context.
        
        last_user_message = request.messages[-1].content
        prompt = f"{system_instructions}\n\nUser Question/Answer: {last_user_message}"
        
        response = chat.send_message(prompt)
        
        return {"role": "assistant", "content": response.text}
    except Exception as e:
        print(f"Error in fachgespraech: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
