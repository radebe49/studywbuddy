import os
import httpx
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")

if not url or not key:
    print("Missing Supabase config")
    exit(1)

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}"
}

with httpx.Client(headers=headers) as client:
    res = client.get(f"{url}/rest/v1/exams?select=*&order=upload_date.desc&limit=5")
    print(res.text)
