"""
supabase_client.py
------------------
Single place for all Supabase interactions.
Reads credentials from .env at the repo root.

Dependencies:
    pip install supabase python-dotenv

Table used:  translation_memory
    id            uuid  (PK, auto)
    source_text   text
    translated_text text
    source_lang   varchar   (always "en")
    target_lang   varchar   (e.g. "fr", "de")
    faiss_index   int4      (position in Om's FAISS index file)
    match_type    varchar   ("tm_exact" | "faiss_direct" | "llm_guided" | "llm_cold")
    created_at    timestamp (auto)
"""

import os
from typing import Optional
from dotenv import load_dotenv
from supabase import create_client, Client

# Load .env from repo root (two levels up from this file)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

SUPABASE_URL: str = os.environ.get("SUPABASE_URL")
SUPABASE_KEY: str = os.environ.get("SUPABASE_KEY")

def get_client() -> Client:
    """Returns a singleton Supabase client (initialised once)."""
    global _client
    if _client is None:
        try:
            _client = create_client(SUPABASE_URL, SUPABASE_KEY)
            print("Supabase client created successfully.")
        except Exception as e:
            print(f"Error creating Supabase client: {e}")
            raise
    return _client


# ── Read ──────────────────────────────────────────────────────────────────────

def fetch_all_memory(target_lang: Optional[str] = None) -> list[dict]:
    """
    Returns all rows from translation_memory.
    Optionally filter by target_lang (e.g. "fr").
    """
    client = get_client()
    query = client.table("translation_memory").select("*").order("created_at", desc=True)

    if target_lang:
        query = query.eq("target_lang", target_lang)

    response = query.execute()
    return response.data


def fetch_exact_match(source_text: str, target_lang: str) -> Optional[dict]:
    """
    Looks up an exact source_text + target_lang match in Supabase.
    Returns the first matching row or None.

    Note: Om's tm_exact tier already handles this inside translate_pipeline().
    This helper is exposed in case you need it independently (e.g. for admin checks).
    """
    client = get_client()
    response = (
        client.table("translation_memory")
        .select("*")
        .eq("source_text", source_text)
        .eq("target_lang", target_lang)
        .limit(1)
        .execute()
    )
    rows = response.data
    return rows[0] if rows else None


# ── Write ─────────────────────────────────────────────────────────────────────

def insert_translation(
    source_text: str,
    translated_text: str,
    target_lang: str,
    match_type: str,
    faiss_index: Optional[int] = None,
    source_lang: str = "en",
) -> dict:
    """
    Inserts ONE approved/edited translation into translation_memory.

    Called by:  backend/routes/memory.py  →  POST /api/approve
    Only call this for human-approved or human-edited sentences.
    Never call for rejected sentences.
    """
    client = get_client()
    row = {
        "source_text":     source_text,
        "translated_text": translated_text,
        "source_lang":     source_lang,
        "target_lang":     target_lang,
        "match_type":      match_type,
    }
    if faiss_index is not None:
        row["faiss_index"] = faiss_index

    response = client.table("translation_memory").insert(row).execute()
    return response.data[0]


def bulk_insert_translations(rows: list[dict]) -> list[dict]:
    """
    Inserts multiple approved translations in one DB call.
    Each dict in rows must match the insert_translation() parameter shape:
        {source_text, translated_text, target_lang, match_type, faiss_index?, source_lang?}

    Called by:  backend/routes/memory.py  →  POST /api/approve  (batch mode)
    """
    client = get_client()
    formatted = [
        {
            "source_text":     r["source_text"],
            "translated_text": r["translated_text"],
            "source_lang":     r.get("source_lang", "en"),
            "target_lang":     r["target_lang"],
            "match_type":      r["match_type"],
            **({"faiss_index": r["faiss_index"]} if r.get("faiss_index") is not None else {}),
        }
        for r in rows
    ]
    response = client.table("translation_memory").insert(formatted).execute()
    return response.data
