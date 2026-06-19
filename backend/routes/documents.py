"""
documents.py
────────────
Routes (mounted under /api):
    GET    /api/documents/{document_id}            — fetch one document with full state
    PATCH  /api/documents/{document_id}            — persist stage and/or working state
    POST   /api/documents/{document_id}/original   — store original .docx in Storage
    DELETE /api/documents/{document_id}            — delete a document

Documents are the per-file working records inside a project. Their `stage`
(uploaded → validating → validated → translating → in_review → approved →
exported) and full working state (sentences, results, validation_result,
review_offsets — all jsonb) are persisted here so a user can leave and return to
a project from any device and resume each document exactly where they left off.

Every endpoint resolves org_id from the JWT and scopes the row to it, so a user
can only ever touch documents in their own organization's projects.
"""

import base64
from typing import Optional, Any

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from backend.auth.jwt_bearer import CurrentUser, get_current_user, require_role
from backend.services.supabase_client import (
    fetch_document,
    update_document,
    delete_document,
    upload_original_docx,
    delete_original_docx,
)
from backend.utils.language_codes import normalize_lang_code

router = APIRouter()

_VALID_STAGES = {
    "uploaded", "validating", "validated", "translating",
    "in_review", "approved", "exported", "error",
}
_WRITE_ROLES = ("owner", "admin", "translator", "reviewer")


class OriginalDocxBody(BaseModel):
    original_docx_b64: str


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


@router.post("/documents/{document_id}/original")
async def upload_document_original(
    document_id: str,
    body: OriginalDocxBody,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Store the ORIGINAL uploaded .docx (base64 in the body) in Supabase Storage so
    format-preserving export survives the user leaving and returning to the
    project. The path is recorded on the document row (original_docx_path).

    Best-effort from the client's perspective: a failure here only means export
    later falls back to raw reconstruction — it never blocks the upload flow.
    """
    require_role(current_user, *_WRITE_ROLES)

    existing = fetch_document(document_id, current_user.org_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Document not found.")

    try:
        raw_bytes = base64.b64decode(body.original_docx_b64)
    except Exception:
        raise HTTPException(status_code=400, detail="original_docx_b64 is not valid base64.")

    try:
        path = upload_original_docx(document_id, current_user.org_id, raw_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store original document: {str(e)}")
    return {"original_docx_path": path}


@router.delete("/documents/{document_id}", status_code=204)
async def remove_document(document_id: str, current_user: CurrentUser = Depends(get_current_user)):
    require_role(current_user, *_WRITE_ROLES)
    existing = fetch_document(document_id, current_user.org_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Document not found.")
    # Remove the stored original .docx from Storage first (best-effort) so we
    # don't leave orphaned objects behind.
    delete_original_docx(existing.get("original_docx_path"))
    try:
        delete_document(document_id, current_user.org_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {str(e)}")
