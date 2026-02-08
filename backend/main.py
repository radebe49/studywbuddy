import os
import json
import asyncio
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

app = FastAPI(title="StudyWBuddy API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "online", "message": "StudyWBuddy API is running"}

# --- Models ---

class GeneratePlanRequest(BaseModel):
    exam_solutions: List[Dict[str, Any]]

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

EXAM_SYSTEM_PROMPT = """
You are an expert academic tutor. Analyze the following extracted text from an exam paper.

1. Identify the subject and approximate year/level.
2. Extract the main questions.
3. Solve each question concisely but clearly.
4. Provide a brief explanation for the solution.
5. Categorize each question into a specific topic.
6. Summarize the overall difficulty and key topics covered.

Return the result strictly as a valid JSON object matching this schema:
{
  "subject": "String",
  "year": "String",
  "difficulty": "Easy" | "Medium" | "Hard",
  "topics": ["String"],
  "summary": "String",
  "questions": [
    {
      "questionNumber": "String",
      "questionText": "String",
      "solution": "String",
      "explanation": "String",
      "topic": "String"
    }
  ]
}
"""

PLAN_SYSTEM_PROMPT = """
Based on the following analysis of past exam papers, create a comprehensive 7-day study plan to help a student master these subjects.

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

# --- Background Task ---

def process_exam_background(exam_id: str, file_path: str):
    print(f"Processing exam {exam_id}...")
    supabase.table("exams").update({"status": "processing"}).eq("id", exam_id).execute()

    try:
        raw_text = extract_text_from_pdf(file_path)
        if not raw_text:
            raise ValueError("Could not extract text from PDF")

        print(f"Calling Gemini ({SELECTED_MODEL}) for exam {exam_id}...")
        model = genai.GenerativeModel(SELECTED_MODEL)
        
        response = model.generate_content(
            f"{EXAM_SYSTEM_PROMPT}\n\nText content:\n{raw_text[:500000]}", 
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
        print(f"Error processing exam {exam_id}: {e}")
        supabase.table("exams").update({"status": "failed"}).eq("id", exam_id).execute()
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

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
