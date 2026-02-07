import os
import json
import asyncio
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from pypdf import PdfReader
import google.generativeai as genai
import uvicorn
from dotenv import load_dotenv

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

app = FastAPI(title="DadTutor API")

# CORS (Allow all for development, restrict in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- PDF Extraction Logic ---
def extract_text_from_pdf(file_path: str) -> str:
    try:
        reader = PdfReader(file_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        print(f"Error extracting PDF text: {e}")
        return ""

# --- Helper to parse JSON from Markdown code block ---
def parse_json_from_markdown(text: str):
    try:
        # Try raw json first
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    
    try:
        # Look for ```json ... ```
        start = text.find("```json")
        if start != -1:
            end = text.find("```", start + 7)
            if end != -1:
                json_str = text[start+7:end].strip()
                return json.loads(json_str)
        # Look for just { ... }
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            json_str = text[start:end+1]
            return json.loads(json_str)
    except Exception as e:
        print(f"JSON Parsing failed: {e}")
    return {}

SYSTEM_PROMPT = """
You are an expert academic tutor with 20 years of experience in grading and exam prep.
Your goal is to analyze the provided exam paper text and generate a personalized study plan.

### Phase 1: Extraction & Solving
1. Identify every question in the exam.
2. For each question:
    - Determine the Topic/Category.
    - Solve it (generate the correct answer and a brief explanation).
    - Rate the difficulty (1-10).

### Phase 2: Analysis
1. Identify the "Critical Topics" (topics that appear most frequently or carry the most marks).
2. Identify "Trap Questions" (questions that commonly trick students).

### Phase 3: The Study Plan
Generate a structured weekly study plan.
- **Week 1:** Focus on the highest-weighted topics found in this exam.
- **Week 2:** Practice "Trap Questions" and medium-difficulty topics.
- **Week 3:** Mock exams and time management.

### Output Format (Strict JSON)
Please output ONLY the JSON object, no introductory text.
{
  "exam_title": "String",
  "total_marks": "Integer",
  "questions": [
    {
      "number": "String",
      "text": "String",
      "topic": "String",
      "difficulty": 1-10,
      "solution": "String",
      "explanation": "String"
    }
  ],
  "critical_topics": ["String"],
  "study_plan": "Markdown String"
}
"""

def process_exam_background(exam_id: str, file_path: str):
    print(f"Processing exam {exam_id}...")
    
    # 1. Update status to 'processing'
    supabase.table("exams").update({"status": "processing"}).eq("id", exam_id).execute()

    try:
        # 2. Extract Text
        raw_text = extract_text_from_pdf(file_path)
        if not raw_text:
            raise ValueError("Could not extract text from PDF")

        # 3. Call AI (Gemini 2.0 Flash)
        model = genai.GenerativeModel("gemini-2.0-flash")
        
        # Create prompt with context
        response = model.generate_content(
            f"{SYSTEM_PROMPT}\n\nHere is the exam text:\n\n{raw_text[:1000000]}",
            generation_config={"response_mime_type": "application/json"}
        )
        
        ai_output_text = response.text
        # Gemini with response_mime_type usually returns raw JSON, but good to be safe
        ai_output = parse_json_from_markdown(ai_output_text)

        if not ai_output or "study_plan" not in ai_output:
             print("Warning: AI output might be malformed or missing study_plan")

        # 4. Save Study Plan
        study_plan_data = {
            "exam_id": exam_id,
            "raw_json": ai_output,
            "markdown_plan": ai_output.get("study_plan", "Plan generation failed.")
        }
        supabase.table("study_plans").insert(study_plan_data).execute()

        # 5. Update Status to 'completed'
        supabase.table("exams").update({"status": "completed"}).eq("id", exam_id).execute()
        print(f"Exam {exam_id} processed successfully.")

        # Cleanup local file
        if os.path.exists(file_path):
            os.remove(file_path)

    except Exception as e:
        print(f"Error processing exam {exam_id}: {e}")
        supabase.table("exams").update({"status": "failed"}).eq("id", exam_id).execute()
        if os.path.exists(file_path):
            os.remove(file_path)

# --- Endpoints ---

@app.post("/upload")
async def upload_exam(file: UploadFile = File(...), background_tasks: BackgroundTasks = None):
    # 1. Save file temporarily
    temp_filename = f"temp_{file.filename}"
    with open(temp_filename, "wb") as buffer:
        buffer.write(await file.read())

    try:
        exam_data = {
            "filename": file.filename,
            "storage_path": temp_filename,
            "status": "uploading"
        }
        res = supabase.table("exams").insert(exam_data).execute()
        exam_id = res.data[0]['id']

        # 2. Trigger Background Processing
        background_tasks.add_task(process_exam_background, exam_id, temp_filename)
        
        return {"message": "Upload successful, processing started", "exam_id": exam_id}
    except Exception as e:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/exams")
def list_exams():
    res = supabase.table("exams").select("*").order("upload_date", desc=True).execute()
    return res.data

@app.get("/plans/{exam_id}")
def get_plan(exam_id: str):
    res = supabase.table("study_plans").select("*").eq("exam_id", exam_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Plan not found")
    return res.data[0]

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
