"""
export.py
---------
Route: POST /api/export

Responsibility:
    Receives the full list of translated sentences from the frontend,
    builds a formatted DOCX document in memory using python-docx,
    and streams it back as a file download.

The original uploaded file is not stored server-side after extraction,
so this endpoint reconstructs a clean translated document from the
sentence list provided by the client.

Output file format: .docx (Microsoft Word Open XML)
"""

import io
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH

router = APIRouter()


# ── Request schema ────────────────────────────────────────────────────────────

class TranslationItem(BaseModel):
    source:      str
    translation: str
    match_type:  Optional[str] = None


class ExportRequest(BaseModel):
    doc_id:      str
    filename:    str = "document"
    source_lang: str = "en"
    target_lang: str
    translations: List[TranslationItem]


# ── DOCX builder ──────────────────────────────────────────────────────────────

def _build_docx(req: ExportRequest) -> io.BytesIO:
    """
    Constructs a formatted DOCX from the translation data.

    Structure:
        - Title page  (TransSync AI branding + doc metadata)
        - Translation body (translated sentences as paragraphs)
        - Appendix table (source | translation | match type) — optional
    """
    doc = Document()

    # ── Page margins ─────────────────────────────────────────────────────────
    for section in doc.sections:
        section.top_margin    = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin   = Inches(1.2)
        section.right_margin  = Inches(1.2)

    # ── Title Page ────────────────────────────────────────────────────────────
    brand = doc.add_paragraph()
    brand.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = brand.add_run("TransSync AI")
    run.bold      = True
    run.font.size = Pt(11)
    run.font.color.rgb = RGBColor(0x55, 0x55, 0x55)

    doc.add_paragraph()  # spacer

    title_p = doc.add_paragraph()
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_run = title_p.add_run("Translated Document")
    title_run.bold      = True
    title_run.font.size = Pt(26)

    doc.add_paragraph()

    # Original filename
    orig_p = doc.add_paragraph()
    orig_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    orig_run = orig_p.add_run(f"Source: {req.filename}")
    orig_run.font.size  = Pt(11)
    orig_run.font.color.rgb = RGBColor(0x55, 0x55, 0x55)

    # Language pair
    lang_p = doc.add_paragraph()
    lang_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    lang_run = lang_p.add_run(
        f"Translation: {req.source_lang.upper()} → {req.target_lang.upper()}"
    )
    lang_run.bold       = True
    lang_run.font.size  = Pt(13)

    # Date
    date_p = doc.add_paragraph()
    date_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    date_run = date_p.add_run(
        f"Generated: {datetime.utcnow().strftime('%B %d, %Y')}"
    )
    date_run.font.size  = Pt(10)
    date_run.font.color.rgb = RGBColor(0x88, 0x88, 0x88)

    # Stats line
    total = len(req.translations)
    tm_hits = sum(
        1 for t in req.translations
        if t.match_type in ("tm_exact", "faiss_direct")
    )
    llm_count = total - tm_hits

    stats_p = doc.add_paragraph()
    stats_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    stats_run = stats_p.add_run(
        f"{total} sentences  ·  {tm_hits} TM hits  ·  {llm_count} LLM translations"
    )
    stats_run.font.size  = Pt(10)
    stats_run.font.color.rgb = RGBColor(0x88, 0x88, 0x88)

    # ── Divider ───────────────────────────────────────────────────────────────
    doc.add_page_break()

    # ── Translation Body ──────────────────────────────────────────────────────
    body_heading = doc.add_paragraph()
    h_run = body_heading.add_run("Translated Content")
    h_run.bold      = True
    h_run.font.size = Pt(14)

    doc.add_paragraph()  # spacer

    for item in req.translations:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(8)
        run = p.add_run(item.translation)
        run.font.size = Pt(11)

    # ── Source Reference Appendix ─────────────────────────────────────────────
    doc.add_page_break()

    appendix_heading = doc.add_paragraph()
    a_run = appendix_heading.add_run("Appendix — Source / Translation Reference")
    a_run.bold      = True
    a_run.font.size = Pt(13)

    doc.add_paragraph()

    # Table: Source | Translation | Match Type
    table = doc.add_table(rows=1, cols=3)
    table.style = "Table Grid"

    # Header row
    hdr_cells = table.rows[0].cells
    for cell, label in zip(hdr_cells, ["Source", "Translation", "Match Type"]):
        p = cell.paragraphs[0]
        run = p.add_run(label)
        run.bold      = True
        run.font.size = Pt(9)
        p.alignment   = WD_ALIGN_PARAGRAPH.CENTER

    # Data rows
    for item in req.translations:
        row_cells = table.add_row().cells
        for cell, text in zip(
            row_cells,
            [item.source, item.translation, item.match_type or "—"],
        ):
            p = cell.paragraphs[0]
            run = p.add_run(text)
            run.font.size = Pt(9)

    # ── Serialize to bytes ────────────────────────────────────────────────────
    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf


# ── Route ─────────────────────────────────────────────────────────────────────

@router.post("/export")
async def export_document(body: ExportRequest):
    """
    POST /api/export

    Accepts the full list of approved translations and returns a downloadable
    DOCX file with a title page and the translated text.

    Request body:
        {
            "doc_id":      "uuid...",
            "filename":    "annual_report.pdf",
            "source_lang": "en",
            "target_lang": "fr",
            "translations": [
                { "source": "...", "translation": "...", "match_type": "tm_exact" },
                ...
            ]
        }

    Response:
        Binary DOCX stream (Content-Disposition: attachment)
    """
    docx_buf = _build_docx(body)

    # Derive a clean output filename
    base = body.filename.rsplit(".", 1)[0] if "." in body.filename else body.filename
    out_name = f"translated_{base}_{body.target_lang}.docx"

    return StreamingResponse(
        docx_buf,
        media_type=(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ),
        headers={
            "Content-Disposition": f'attachment; filename="{out_name}"'
        },
    )
