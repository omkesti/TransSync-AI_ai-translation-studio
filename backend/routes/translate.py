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

from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

# ── Om's interface contract ───────────────────────────────────────────────────
from ai.rag_pipeline import translate_pipeline
from backend.services.supabase_client import fetch_verified_glossary_terms, log_pipeline_events, fetch_project
from backend.utils.language_codes import normalize_lang_code
from backend.auth.jwt_bearer import CurrentUser, get_current_user, require_role

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
    source_document: Optional[str] = Field(
        default=None,
        description="Original upload filename. Recorded in pipeline_events for the Dashboard's "
                    "'recent documents' view. Optional — analytics only, never affects translation.",
    )
    project_id: Optional[str] = Field(
        default=None,
        description="Optional project scope. When set, TM + FAISS + glossary lookups search the "
                    "project's data first and fall through to org-scoped data. Translation logic "
                    "is identical with or without it.",
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
    score:       float | None = None
    # Back-translation QA annotation (llm_guided / llm_cold only). Computed by an
    # independent validator model; informational signal for the reviewer, not a
    # blocker. score is None when the check was skipped or did not apply.
    back_translation_score:  float | None = None
    back_translation_failed: bool = False


class TranslateResponse(BaseModel):
    target_lang:  str
    sentence_count: int
    results: list[TranslationResult]


# ── Route ─────────────────────────────────────────────────────────────────────

@router.post("/translate", response_model=TranslateResponse)
async def translate_document(body: TranslateRequest, current_user: CurrentUser = Depends(get_current_user)):
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

    # Normalize the source language too — it scopes TM/FAISS reuse to the same
    # language pair in the pipeline (defaults to "en" if blank/unknown).
    normalized_source = normalize_lang_code(body.source_lang) or "en"

    if normalized_target != body.target_lang.strip().lower():
        print(f"[glossary] Normalized target_lang '{body.target_lang}' → '{normalized_target}'")

    # ── Resolve project scope (optional) ──────────────────────────────────────
    # When a project_id is supplied, confirm it belongs to the caller's org and
    # read its inherit_org_glossary flag so glossary enforcement respects it.
    project_id = body.project_id or None
    inherit_org_glossary = True
    if project_id:
        project = fetch_project(project_id, current_user.org_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found for this organization.")
        inherit_org_glossary = bool(project.get("inherit_org_glossary", True))

    # ── Fetch verified glossary terms (non-blocking) ──────────────────────────
    # Only VERIFIED terms are injected into the LLM prompt. PENDING terms are
    # excluded. With a project scope, project terms override org terms (and org
    # terms are skipped entirely when the project opted out of inheritance).
    glossary_hints: dict = {}
    try:
        glossary_hints = fetch_verified_glossary_terms(
            normalized_target,
            current_user.org_id,
            project_id=project_id,
            inherit_org_glossary=inherit_org_glossary,
        )
        if glossary_hints:
            print(f"[glossary] Enforcing {len(glossary_hints)} verified term(s) for '{normalized_target}'")
        else:
            print(f"[glossary] No verified terms for '{normalized_target}'")
    except Exception:
        pass  # Glossary failure must NEVER block translation

    input_json = {
        "sentences": body.sentences,
        "source_lang": normalized_source,
        "target_lang": normalized_target,
        "org_id": current_user.org_id,
        "project_id": project_id,
        "glossary_hints": glossary_hints,
    }

    try:
        results = await translate_pipeline(input_json)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Translation pipeline error: {str(e)}",
        )

    # ── Log pipeline analytics (best-effort, never blocks the response) ────────
    # Records every processed sentence with its match_type so the Dashboard can
    # report the true tier distribution (incl. TM/FAISS hits that are never
    # re-stored in translation_memory) and the most recently translated documents.
    _VALID_TIERS = {"tm_exact", "faiss_direct", "llm_guided", "llm_cold"}
    log_pipeline_events([
        {
            "org_id":          current_user.org_id,
            "user_id":         current_user.user_id,
            "source_text":     r.get("source", ""),
            "translated_text": r.get("translation", ""),
            "source_lang":     normalized_source,
            "target_lang":     normalized_target,
            "match_type":      r.get("match_type", ""),
            "source_document": body.source_document or "",
        }
        for r in results
        if r.get("match_type") in _VALID_TIERS
    ])

    return TranslateResponse(
        target_lang=normalized_target,
        sentence_count=len(results),
        results=[TranslationResult(**r) for r in results],
    )
