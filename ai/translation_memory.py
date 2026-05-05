from dotenv import load_dotenv
load_dotenv()

import os
from supabase import create_client

key: str = os.environ.get("SUPABASE_KEY")
url: str = os.environ.get("SUPABASE_URL")

supabase: create_client = create_client(url, key)

async def exact_match_lookup(sentence: str) -> str:
    """
    Check weather exact sentence exists is the database
    """

    try:
        response = await supabase.from_("translation_memory")\
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
