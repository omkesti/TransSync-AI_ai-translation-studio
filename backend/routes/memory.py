"""
memory.py
---------
Routes:
    GET  /api/translation-memory       — fetch stored translations (for Ajinkya's UI)
    POST /api/approve                  — write human-approved translations to Supabase

Responsibility:
    This file handles the storage side of the human review loop.

    When Ajinkya's reviewer approves or edits a sentence, the frontend
    calls POST /api/approve with the final translations.
    You write those rows to Supabase.

    IMPORTANT: Only approved or edited translations are stored.
               Rejected sentences must NOT be sent here and will be ignored
               if they are (guarded by the 'action' field check below).

    Om's rebuild_index.py will later read from Supabase to rebuild the FAISS index.
    Your Supabase writes are what feed Om's vector store over time.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional
from backend.services.supabase_client import fetch_all_memory, bulk_insert_translations

router = APIRouter()


# ── Request / Response schemas ────────────────────────────────────────────────

class ReviewedSentence(BaseModel):
    source_text:     str
    translated_text: str
    target_lang:     str
    match_type:      str
    action:          str = Field(
        ...,
        description="Must be 'approved' or 'edited'. 'rejected' entries are ignored.",
    )
    faiss_index: Optional[int] = Field(
        default=None,
        description="Set by Om's pipeline if a FAISS match was used. Pass it through as-is.",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "source_text":     "The contract is binding.",
                "translated_text": "Le contrat est contraignant.",
                "target_lang":     "fr",
                "match_type":      "llm_cold",
                "action":          "approved",
                "faiss_index":     None,
            }
        }


class ApproveRequest(BaseModel):
    reviewed: list[ReviewedSentence] = Field(
        ...,
        description="Full list of reviewed sentences. Rejected ones are filtered server-side.",
    )


class ApproveResponse(BaseModel):
    saved_count:    int
    rejected_count: int
    message:        str


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/dashboard-stats")
async def get_dashboard_stats():
    """
    GET /api/dashboard-stats

    Returns aggregated metrics computed from translation_memory for the
    Dashboard page.  All aggregation is done in Python from a single DB
    fetch so we don't need extra Supabase queries.

    Response shape:
        {
            "total_translations": 312,
            "match_type_breakdown": {
                "tm_exact":    45,
                "faiss_direct": 80,
                "llm_guided":  90,
                "llm_cold":    97
            },
            "languages": ["fr", "de", "es"],
            "recent": [
                {
                    "source_text":     "The contract is binding.",
                    "translated_text": "Le contrat est contraignant.",
                    "target_lang":     "fr",
                    "match_type":      "llm_cold",
                    "created_at":      "2024-06-01T..."
                },
                ...  (up to 5 records)
            ]
        }
    """
    try:
        records = fetch_all_memory()  # already sorted newest-first
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch translation memory stats: {str(e)}",
        )

    # ── Aggregate ─────────────────────────────────────────────────────────────
    breakdown = {"tm_exact": 0, "faiss_direct": 0, "llm_guided": 0, "llm_cold": 0}
    seen_langs: set[str] = set()

    for r in records:
        mt = r.get("match_type", "")
        if mt in breakdown:
            breakdown[mt] += 1
        lang = r.get("target_lang")
        if lang:
            seen_langs.add(lang)

    recent = [
        {
            "source_text":     r.get("source_text", ""),
            "translated_text": r.get("translated_text", ""),
            "target_lang":     r.get("target_lang", ""),
            "match_type":      r.get("match_type", ""),
            "created_at":      r.get("created_at", ""),
        }
        for r in records[:5]
    ]

    return {
        "total_translations":  len(records),
        "match_type_breakdown": breakdown,
        "languages":           sorted(seen_langs),
        "recent":              recent,
    }


@router.get("/translation-memory")
async def get_translation_memory(
    target_lang: Optional[str] = Query(
        default=None,
        description="Filter by language code, e.g. 'fr'. Omit for all languages.",
    )
):
    """
    GET /api/translation-memory
    GET /api/translation-memory?target_lang=fr

    Returns all stored approved translations, newest first.
    Optionally filtered by target_lang.

    Response shape:
        {
            "count": 42,
            "records": [
                {
                    "id":             "uuid...",
                    "source_text":    "The contract is binding.",
                    "translated_text":"Le contrat est contraignant.",
                    "source_lang":    "en",
                    "target_lang":    "fr",
                    "match_type":     "llm_cold",
                    "faiss_index":    null,
                    "created_at":     "2024-01-01T..."
                },
                ...
            ]
        }
    """
    try:
        records = fetch_all_memory(target_lang=target_lang)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch translation memory: {str(e)}")

    return {"count": len(records), "records": records}


@router.post("/approve", response_model=ApproveResponse)
async def approve_translations(body: ApproveRequest):
    """
    POST /api/approve

    Called by Ajinkya's review UI after the human reviewer finishes.
    Receives the full reviewed batch; filters to approved/edited only;
    writes them to Supabase translation_memory table.

    Accepts:
        {
            "reviewed": [
                {
                    "source_text":     "The contract is binding.",
                    "translated_text": "Le contrat est contraignant.",
                    "target_lang":     "fr",
                    "match_type":      "llm_cold",
                    "action":          "approved",
                    "faiss_index":     null
                },
                {
                    "source_text":     "All parties must sign.",
                    "translated_text": "Toutes les parties doivent signer.",
                    "target_lang":     "fr",
                    "match_type":      "llm_cold",
                    "action":          "edited",      ← human changed the translation
                    "faiss_index":     null
                },
                {
                    "source_text":     "Some sentence.",
                    "translated_text": "Quelque phrase.",
                    "target_lang":     "fr",
                    "match_type":      "llm_cold",
                    "action":          "rejected",    ← will be filtered out, not stored
                    "faiss_index":     null
                }
            ]
        }

    Returns:
        {
            "saved_count":    2,
            "rejected_count": 1,
            "message":        "2 translations saved. 1 rejected (not stored)."
        }
    """
    # ── Filter: only approved or edited go to storage ─────────────────────────
    to_save = [s for s in body.reviewed if s.action in ("approved", "edited")]
    rejected = [s for s in body.reviewed if s.action == "rejected"]

    if not to_save:
        return ApproveResponse(
            saved_count=0,
            rejected_count=len(rejected),
            message=f"No translations to save. {len(rejected)} rejected (not stored).",
        )

    # ── Write to Supabase ─────────────────────────────────────────────────────
    rows = [
        {
            "source_text":     s.source_text,
            "translated_text": s.translated_text,
            "target_lang":     s.target_lang,
            "match_type":      s.match_type,
            "faiss_index":     s.faiss_index,
            "source_lang":     "en",
        }
        for s in to_save
    ]

    try:
        bulk_insert_translations(rows)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save translations to Supabase: {str(e)}",
        )

    return ApproveResponse(
        saved_count=len(to_save),
        rejected_count=len(rejected),
        message=f"{len(to_save)} translations saved. {len(rejected)} rejected (not stored).",
    )
