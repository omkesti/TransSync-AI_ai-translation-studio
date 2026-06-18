"""
export_batch.py
───────────────
Route: POST /api/export/batch

Accepts an array of documents (each with raw_text + translations),
generates a DOCX for each using the shared docx_builder, packs them
all into a ZIP archive, and streams it back as a download.
"""

import io
import zipfile
from typing import List

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.services.docx_builder import (
    DocExportData,
    reconstruct_docx,
    build_translated_docx,
    make_output_filename,
)
from backend.auth.jwt_bearer import CurrentUser, get_current_user

router = APIRouter()


class BatchExportRequest(BaseModel):
    documents: List[DocExportData]


@router.post("/export/batch")
async def export_batch(body: BatchExportRequest, current_user: CurrentUser = Depends(get_current_user)):
    """
    POST /api/export/batch

    Request body:
        {
            "documents": [
                {
                    "doc_id":       "uuid-1",
                    "filename":     "report.pdf",
                    "source_lang":  "en",
                    "target_lang":  "hi",
                    "raw_text":     "Full original text…",
                    "translations": [{ "source": "…", "translation": "…", "match_type": "…" }]
                },
                { … }
            ]
        }

    Response:
        ZIP archive containing one translated DOCX per document.
    """
    zip_buf = io.BytesIO()

    # Track filenames to avoid duplicates inside the ZIP
    used_names: dict[str, int] = {}

    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for doc_data in body.documents:
            # Build the DOCX in memory. DOCX-sourced docs (original_docx_b64
            # present) get format-preserving OOXML injection; PDF-sourced docs
            # fall back to from-scratch reconstruction. A bad b64 for one doc
            # must not sink the whole batch — fall back gracefully.
            if doc_data.original_docx_b64:
                try:
                    docx_buf = build_translated_docx(doc_data)
                except ValueError:
                    docx_buf = reconstruct_docx(doc_data)
            else:
                docx_buf = reconstruct_docx(doc_data)

            # Generate a unique filename
            name = make_output_filename(doc_data.filename, doc_data.target_lang)
            if name in used_names:
                used_names[name] += 1
                base, ext = name.rsplit(".", 1)
                name = f"{base}_{used_names[name]}.{ext}"
            else:
                used_names[name] = 0

            zf.writestr(name, docx_buf.read())

    zip_buf.seek(0)

    return StreamingResponse(
        zip_buf,
        media_type="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="transsync_batch_export.zip"'
        },
    )
