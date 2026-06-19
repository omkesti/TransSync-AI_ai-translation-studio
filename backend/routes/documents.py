"""
documents.py
────────────
Routes (mounted under /api):
    GET    /api/documents/{document_id}   — fetch one document with full state
    PATCH  /api/documents/{document_id}   — persist stage and/or working state
    DELETE /api/documents/{document_id}   — delete a document

Documents are the per-file working records inside a project. Their `stage`
(uploaded → validating → validated → translating → in_review → approved →
exported) and full working state (sentences, results, validation_result,
review_offsets — all jsonb) are persisted here so a user can leave and return to
a project from any device and resume each document exactly where they left off.

Every endpoint resolves org_id from the JWT and scopes the row to it, so a user
can only ever touch documents in their own organization's projects.
"""

from typing import Optional, Any

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from backend.auth.jwt_bearer import CurrentUser, get_current_user, require_role
from backend.services.supabase_client import (
    fetch_document,
    update_document,
    delete_document,
)
from backend.utils.language_codes import normalize_lang_code

router = APIRouter()

_VALID_STAGES = {
    "uploaded", "validating", "validated", "translating",
    "in_review", "approved", "exported", "error",
}
_WRITE_ROLES = ("owner", "admin", "translator", "reviewer")


class DocumentPatch(BaseModel):
    filename: Optional[str] = None
    source_lang: Optional[str] = None
    target_lang: Optional[str] = None
    stage: Optional[str] = None
    sentence_count: Optional[int] = None
    reviewed_count: Optional[int] = None
    raw_text: Optional[str] = None
    sentences: Optional[list] = None
    results: Optional[list] = None
    validation_result: Optional[Any] = None
    review_offsets: Optional[dict] = None
    error: Optional[str] = None


@router.get("/documents/{document_id}")
async def get_document(document_id: str, current_user: CurrentUser = Depends(get_current_user)):
    document = fetch_document(document_id, current_user.org_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found.")
    return document


@router.patch("/documents/{document_id}")
async def patch_document(document_id: str, body: DocumentPatch, current_user: CurrentUser = Depends(get_current_user)):
    require_role(current_user, *_WRITE_ROLES)

    existing = fetch_document(document_id, current_user.org_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Document not found.")

    patch = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not patch:
        raise HTTPException(status_code=400, detail="No fields provided to update.")

    if "stage" in patch and patch["stage"] not in _VALID_STAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid stage. Must be one of: {', '.join(sorted(_VALID_STAGES))}",
        )
    if patch.get("target_lang"):
        patch["target_lang"] = normalize_lang_code(patch["target_lang"]) or patch["target_lang"]

    try:
        updated = update_document(document_id, current_user.org_id, patch)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update document: {str(e)}")
    return updated


@router.delete("/documents/{document_id}", status_code=204)
async def remove_document(document_id: str, current_user: CurrentUser = Depends(get_current_user)):
    require_role(current_user, *_WRITE_ROLES)
    existing = fetch_document(document_id, current_user.org_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Document not found.")
    try:
        delete_document(document_id, current_user.org_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {str(e)}")
