"""
export.py
---------
Route: POST /api/export

Single-document export. Delegates DOCX reconstruction to the shared
docx_builder service.
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from backend.services.docx_builder import (
    DocExportData,
    reconstruct_docx,
    build_translated_docx,
    make_output_filename,
)
from backend.services.supabase_client import fetch_document_original_b64
from backend.auth.jwt_bearer import CurrentUser, get_current_user

router = APIRouter()


@router.post("/export")
async def export_document(body: DocExportData, current_user: CurrentUser = Depends(get_current_user)):
    """
    POST /api/export

    Returns a downloadable translated DOCX. Two strategies, chosen by payload:

      - original_docx_b64 present (source was a .docx):
            Format-preserving OOXML run-level injection — opens the original
            file and writes translations into existing runs, keeping every
            table, image, style and inline format intact.

      - original_docx_b64 absent (source was a PDF):
            Legacy from-scratch reconstruction using raw_text.

    Request body:
        {
            "doc_id":      "uuid...",
            "filename":    "annual_report.docx",
            "source_lang": "en",
            "target_lang": "fr",
            "raw_text":    "Full original extracted text...",   # legacy/PDF path
            "original_docx_b64": "<base64 of original .docx>",  # DOCX path
            "translations": [
                { "source": "...", "translation": "...", "match_type": "tm_exact" },
                ...
            ]
        }

    Response:
        Binary DOCX stream (Content-Disposition: attachment)
    """
    # When the client no longer holds the original .docx (e.g. it left and
    # returned to the project, so the in-memory base64 is gone), restore it from
    # Supabase Storage by document id so format-preserving export still works.
    if not body.original_docx_b64 and body.doc_id:
        body.original_docx_b64 = fetch_document_original_b64(body.doc_id, current_user.org_id)

    if body.original_docx_b64:
        try:
            docx_buf = build_translated_docx(body)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))
    else:
        docx_buf = reconstruct_docx(body)

    out_name = make_output_filename(body.filename, body.target_lang)

    return StreamingResponse(
        docx_buf,
        media_type=(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ),
        headers={
            "Content-Disposition": f'attachment; filename="{out_name}"'
        },
    )
