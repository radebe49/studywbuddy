
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

try:
    res = supabase.table("user_settings").select("*").limit(1).execute()
    print("Columns in user_settings:", res.data[0].keys() if res.data else "No data found")
except Exception as e:
    print("Error:", e)
