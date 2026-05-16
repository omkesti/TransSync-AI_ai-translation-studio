"""
upload.py
---------
Route:  POST /api/upload-document

Responsibility:
    1. Receive a PDF or DOCX file from Ajinkya's frontend.
    2. Save it temporarily to disk.
    3. Extract raw text using document_parser.
    4. Store document metadata in Supabase (optional, extend as needed).
    5. Return the extracted raw text to the caller.

The raw text is then expected to be passed to Devang's NLP module
(POST /validate on the NLP side) before coming back here as sentences
via POST /api/translate.
"""

import os
import uuid
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from backend.services.document_parser import parse_document

router = APIRouter()

# Temp folder to hold uploaded files during processing
# In production, swap this for cloud storage (e.g. Supabase Storage)
UPLOAD_DIR = "/tmp/transsync_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".docx"}


@router.post("/upload-document")
async def upload_document(file: UploadFile = File(...)):
    """
    POST /api/upload-document

    Accepts:
        file  — multipart/form-data  (.pdf or .docx)

    Returns:
        {
            "filename":    "contract.pdf",
            "doc_id":      "a1b2c3...",          # unique ID for this upload
            "raw_text":    "The contract is...", # full extracted text
            "char_count":  1234
        }

    Errors:
        400  if file type is not .pdf or .docx
        422  if text extraction fails (scanned image PDF, corrupt file, etc.)
    """
    # ── 1. Validate file type ────────────────────────────────────────────────
    original_name = file.filename or "upload"
    ext = os.path.splitext(original_name)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Please upload a .pdf or .docx file.",
        )

    # ── 2. Save to disk with a unique name ───────────────────────────────────
    doc_id = str(uuid.uuid4())
    save_path = os.path.join(UPLOAD_DIR, f"{doc_id}{ext}")

    try:
        with open(save_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
    finally:
        file.file.close()

    # ── 3. Extract text ──────────────────────────────────────────────────────
    try:
        raw_text = parse_document(save_path)
    except ValueError as e:
        # Clean up the saved file before returning error
        os.remove(save_path)
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        os.remove(save_path)
        raise HTTPException(status_code=500, detail=f"Text extraction failed: {str(e)}")

    # ── 4. Cleanup temp file (text is now in memory) ─────────────────────────
    # Remove after extraction — we don't persist raw files server-side for now.
    # If you need to keep files (e.g. for re-processing), comment this out.
    os.remove(save_path)

    # ── 5. Return extracted text ─────────────────────────────────────────────
    return JSONResponse(content={
        "filename":   original_name,
        "doc_id":     doc_id,
        "raw_text":   raw_text,
        "char_count": len(raw_text),
    })
