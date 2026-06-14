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

from backend.utils.language_codes import glossary_lookup_codes, normalize_lang_code

# Load .env — first try the backend/ folder (where .env lives),
# then fall back to the repo root in case it's been moved there.
_this_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(_this_dir, '..', '.env'))        # backend/.env
load_dotenv(dotenv_path=os.path.join(_this_dir, '..', '..', '.env'))  # repo-root/.env (fallback)

SUPABASE_URL: str = os.environ.get("SUPABASE_URL")
SUPABASE_KEY: str = os.environ.get("SUPABASE_KEY")

_client: Client = None  # singleton — initialised on first call to get_client()

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

def fetch_all_memory(org_id: str, target_lang: Optional[str] = None) -> list[dict]:
    """
    Returns all rows from translation_memory for a given org.
    Optionally filter by target_lang (e.g. "fr").
    """
    client = get_client()
    query = client.table("translation_memory").select("*").eq("org_id", org_id).order("created_at", desc=True)

    if target_lang:
        query = query.eq("target_lang", target_lang)

    response = query.execute()
    return response.data


def fetch_exact_match(source_text: str, target_lang: str, org_id: str) -> Optional[dict]:
    """
    Looks up an exact source_text + target_lang match in Supabase, scoped to org.
    Returns the first matching row or None.
    """
    client = get_client()
    response = (
        client.table("translation_memory")
        .select("*")
        .eq("source_text", source_text)
        .eq("target_lang", target_lang)
        .eq("org_id", org_id)
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
            "org_id":          r["org_id"],
            **({("faiss_index"): r["faiss_index"]} if r.get("faiss_index") is not None else {}),
        }
        for r in rows
    ]
    response = client.table("translation_memory").insert(formatted).execute()
    return response.data


# ── Glossary ──────────────────────────────────────────────────────────────────
# Table: glossary
#   id          uuid (PK, auto)
#   source_term text
#   target_term text
#   source_lang varchar  (default "en")
#   target_lang varchar
#   category    varchar  ("TECHNICAL", "LEGAL", "ESG", ...)
#   status      varchar  ("PENDING" | "VERIFIED")
#   created_at  timestamp (auto)

def fetch_all_glossary(
    org_id: str,
    target_lang: Optional[str] = None,
    search: Optional[str] = None,
) -> list[dict]:
    """
    Returns all rows from the glossary table for a given org, newest first.
    Optionally filter by target_lang and/or search term (applied to source_term).
    """
    client = get_client()
    query = client.table("glossary").select("*").eq("org_id", org_id).order("created_at", desc=True)
    if target_lang:
        normalized = normalize_lang_code(target_lang)
        if normalized:
            query = query.eq("target_lang", normalized)
    if search:
        query = query.ilike("source_term", f"%{search}%")
    response = query.execute()
    return response.data


def insert_glossary_term(row: dict) -> dict:
    """
    Inserts a new term into the glossary table.
    row must contain: source_term, target_term, target_lang, org_id
    Optional: category, status, source_lang
    """
    client = get_client()
    payload = {
        "source_term": row["source_term"],
        "target_term": row["target_term"],
        "target_lang": normalize_lang_code(row["target_lang"]) or row["target_lang"],
        "source_lang": normalize_lang_code(row.get("source_lang", "en")) or row.get("source_lang", "en"),
        "category":    row.get("category", ""),
        "status":      row.get("status", "PENDING"),
        "org_id":      row["org_id"],
    }
    response = client.table("glossary").insert(payload).execute()
    return response.data[0]


def update_glossary_term(term_id: str, patch: dict) -> dict:
    """
    Partially updates a glossary term by id.
    patch may contain any subset of: target_term, category, status.
    """
    client = get_client()
    response = (
        client.table("glossary")
        .update(patch)
        .eq("id", term_id)
        .execute()
    )
    rows = response.data
    return rows[0] if rows else {}


def delete_glossary_term(term_id: str) -> bool:
    """
    Deletes a glossary term by id.
    Returns True if a row was deleted, False otherwise.
    """
    client = get_client()
    response = (
        client.table("glossary")
        .delete()
        .eq("id", term_id)
        .execute()
    )
    return len(response.data) > 0


def fetch_verified_glossary_terms(target_lang: str, org_id: str) -> dict:
    """
    Returns all VERIFIED glossary terms for the given target language and org
    as a flat dict: { source_term_lower: target_term }.

    Keys are lowercased so callers can do case-insensitive scanning without
    repeated .lower() calls on every lookup.

    Only VERIFIED terms are returned — PENDING terms are intentionally excluded
    so unreviewed translations are never forced on the LLM.

    Called by: backend/routes/translate.py before each translation job.
    """
    try:
        client = get_client()
        codes = glossary_lookup_codes(normalize_lang_code(target_lang))
        for code in codes:
            response = (
                client.table("glossary")
                .select("source_term, target_term")
                .eq("target_lang", code)
                .eq("status", "VERIFIED")
                .eq("org_id", org_id)
                .execute()
            )
            if response.data:
                return {
                    row["source_term"].lower(): row["target_term"]
                    for row in response.data
                }
        return {}
    except Exception as e:
        # Glossary fetch failure must never block translation
        print(f"[glossary] fetch_verified_glossary_terms failed (non-fatal): {e}")
        return {}
