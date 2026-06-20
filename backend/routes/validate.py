"""
validate.py
-----------
Route: POST /api/validate

Responsibility:
    Receives raw text from the frontend (after upload).
    Calls Devang's NLP module to quality-check and sentencize.
    Returns either errors (rejected) or a clean sentence array.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from nlp.nlp_pipeline import validate_and_split
from backend.utils.language_codes import normalize_lang_code
from backend.utils.language_detect import detect_source_lang
from backend.auth.jwt_bearer import CurrentUser, get_current_user

router = APIRouter()


class ValidateRequest(BaseModel):
    raw_text: str
    doc_id: str  # pass through from upload response
    source_lang: str | None = None  # canonical/alias code; auto-detected if absent


class ValidateResponse(BaseModel):
    status: str          # "ok" or "error"
    doc_id: str
    sentences: list[str] = []
    errors: list[str] = []
    sentence_count: int = 0
    source_lang: str = "en"   # the language actually used for validation


@router.post("/validate", response_model=ValidateResponse)
async def validate_document(body: ValidateRequest, current_user: CurrentUser = Depends(get_current_user)):
    """
    POST /api/validate

    Accepts:
        { "raw_text": "Full document text...", "doc_id": "abc123" }

    Returns on success:
        { "status": "ok", "doc_id": "abc123", "sentences": [...], "sentence_count": 42 }

    Returns on failure:
        { "status": "error", "doc_id": "abc123", "errors": ["..."], "sentences": [] }
    """
    # Resolve the source language: explicit override wins, else auto-detect.
    source_lang = normalize_lang_code(body.source_lang or "") or detect_source_lang(body.raw_text)

    result = validate_and_split(body.raw_text, source_lang)

    if result["status"] == "error":
        return ValidateResponse(
            status="error",
            doc_id=body.doc_id,
            errors=result["errors"],
            source_lang=source_lang,
        )

    return ValidateResponse(
        status="ok",
        doc_id=body.doc_id,
        sentences=result["sentences"],
        sentence_count=len(result["sentences"]),
        source_lang=result.get("source_lang", source_lang),
    )