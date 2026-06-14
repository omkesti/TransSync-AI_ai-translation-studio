"""
export.py
---------
Route: POST /api/export

Single-document export. Delegates DOCX reconstruction to the shared
docx_builder service.
"""

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from backend.services.docx_builder import DocExportData, reconstruct_docx, make_output_filename
from backend.auth.jwt_bearer import CurrentUser, get_current_user

router = APIRouter()


@router.post("/export")
async def export_document(body: DocExportData, current_user: CurrentUser = Depends(get_current_user)):
    """
    POST /api/export

    Accepts the original raw_text and the list of approved translations,
    reconstructs the document paragraph by paragraph with translated text,
    and returns a downloadable DOCX file.

    Request body:
        {
            "doc_id":      "uuid...",
            "filename":    "annual_report.pdf",
            "source_lang": "en",
            "target_lang": "fr",
            "raw_text":    "Full original extracted text with \\n\\n paragraph breaks...",
            "translations": [
                { "source": "...", "translation": "...", "match_type": "tm_exact" },
                ...
            ]
        }

    Response:
        Binary DOCX stream (Content-Disposition: attachment)
    """
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
