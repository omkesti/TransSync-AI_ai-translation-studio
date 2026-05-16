import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

async def exact_match_lookup(sentence: str) -> str:
    """
    Check weather exact sentence exists is the database
    """

    try:
        response = supabase.from_("translation_memory")\
            .select("*")\
            .eq("source_text", sentence)\
            .execute()
    except Exception as e:
        print(f"Error fetching data from Supabase: {e}")
        return None
    
    if response.data:
        return response.data[0]['translated_text']
    else:        
        return None
