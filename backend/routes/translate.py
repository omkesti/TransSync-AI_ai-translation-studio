"""
translate.py
------------
Route:  POST /api/translate

Responsibility:
    This is the most critical route you own.
    It receives a validated, sentencized list of strings from Devang's NLP module,
    calls Om's translate_pipeline(), and returns the result array to the frontend.

    You are the bridge. You do NOT write any translation logic.
    All translation intelligence lives in ai/rag_pipeline.py (Om's module).

Data flow:
    NLP module  →  POST /api/translate  →  translate_pipeline()  →  JSON response  →  Frontend review UI
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

# ── Om's interface contract ───────────────────────────────────────────────────
# This import works because the virtual environment is at the repo root level.
# Run the server from the repo root:  uvicorn backend.main:app --reload
from ai.rag_pipeline import translate_pipeline
from backend.services.supabase_client import fetch_verified_glossary_terms
from backend.utils.language_codes import normalize_lang_code

router = APIRouter()


# ── Request / Response schemas ────────────────────────────────────────────────

class TranslateRequest(BaseModel):
    sentences: list[str] = Field(
        ...,
        description="Array of validated plain-text sentences from Devang's NLP module.",
        min_length=1,
    )
    source_lang: str = Field(
        ...,
        description="BCP-47 language code for the source language. E.g. 'en', 'de', 'es', 'hi'.",
        min_length=2,
        max_length=10,
    )
    target_lang: str = Field(
        ...,
        description="BCP-47 language code for the target language. E.g. 'fr', 'de', 'es', 'hi'.",
        min_length=2,
        max_length=10,
    )

    class Config:
        json_schema_extra = {
            "example": {
                "sentences": [
                    "The contract is binding.",
                    "All parties must sign before the deadline.",
                ],
                "source_lang": "en",
                "target_lang": "fr",
            }
        }


class TranslationResult(BaseModel):
    source:      str
    translation: str
    match_type:  str   # "tm_exact" | "faiss_direct" | "llm_guided" | "llm_cold"


class TranslateResponse(BaseModel):
    target_lang:  str
    sentence_count: int
    results: list[TranslationResult]


# ── Route ─────────────────────────────────────────────────────────────────────

@router.post("/translate", response_model=TranslateResponse)
async def translate_document(body: TranslateRequest):
    """
    POST /api/translate

    Accepts:
        {
            "sentences":   ["sentence one", "sentence two", ...],
            "source_lang": "en",
            "target_lang": "fr"
        }

    Returns:
        {
            "target_lang":     "fr",
            "sentence_count":  2,
            "results": [
                {
                    "source":      "The contract is binding.",
                    "translation": "Le contrat est contraignant.",
                    "match_type":  "llm_cold"
                },
                ...
            ]
        }

    Errors:
        400  if sentences list is empty
        500  if Om's pipeline raises an unexpected error
    """
    if not body.sentences:
        raise HTTPException(status_code=400, detail="sentences list cannot be empty.")

    # ── Call Om's pipeline ────────────────────────────────────────────────────
    # This is the ONLY place translate_pipeline() is called.
    # Input:  list[str], str
    # Output: list[{"source": str, "translation": str, "match_type": str}]

    normalized_target = normalize_lang_code(body.target_lang)
    if not normalized_target:
        raise HTTPException(status_code=400, detail="target_lang is invalid or empty.")

    if normalized_target != body.target_lang.strip().lower():
        print(f"[glossary] Normalized target_lang '{body.target_lang}' → '{normalized_target}'")

    # ── Fetch verified glossary terms (non-blocking) ──────────────────────────
    # Only VERIFIED terms are injected into the LLM prompt.
    # PENDING terms are intentionally excluded.
    glossary_hints: dict = {}
    try:
        glossary_hints = fetch_verified_glossary_terms(normalized_target)
        if glossary_hints:
            print(f"[glossary] Enforcing {len(glossary_hints)} verified term(s) for '{normalized_target}'")
        else:
            print(f"[glossary] No verified terms for '{normalized_target}'")
    except Exception:
        pass  # Glossary failure must NEVER block translation

    input_json = {
        "sentences": body.sentences,
        "source_lang": body.source_lang,
        "target_lang": normalized_target,
        "glossary_hints": glossary_hints,
    }

    try:
        results = await translate_pipeline(input_json)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Translation pipeline error: {str(e)}",
        )


    return TranslateResponse(
        target_lang=normalized_target,
        sentence_count=len(results),
        results=[TranslationResult(**r) for r in results],
    )
