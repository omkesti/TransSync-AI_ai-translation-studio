"""
docx_builder.py
───────────────
Shared DOCX reconstruction logic.

Used by:
    - backend/routes/export.py       (single-doc export)
    - backend/routes/export_batch.py  (multi-doc ZIP export)

Responsibility:
    Given raw_text (paragraph-separated by \\n\\n) and a list of
    { source, translation } items, rebuild a clean DOCX that mirrors
    the original document structure with translated content in place.
"""

import io
import re
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel
from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement


# ── Shared schemas ────────────────────────────────────────────────────────────

class TranslationItem(BaseModel):
    source:      str
    translation: str
    match_type:  Optional[str] = None


class DocExportData(BaseModel):
    """
    All the data needed to reconstruct one translated document.
    Both the single-export and batch-export routes build instances of this.
    """
    doc_id:      str
    filename:    str = "document"
    source_lang: str = "en"
    target_lang: str
    raw_text:    str = ""
    translations: List[TranslationItem]


# ── Heading detection heuristic ───────────────────────────────────────────────

def is_heading(text: str) -> bool:
    """
    Heuristically detect heading-like paragraphs.
    A paragraph is treated as a heading if it:
      - Is short (≤ 80 chars)
      - Does not end with sentence-ending punctuation
      - Is not just a number
    """
    text = text.strip()
    if not text or len(text) > 80:
        return False
    if text[-1] in ".!?,;:":
        return False
    if re.match(r"^\d+\.?$", text):
        return False
    return True


# ── Paragraph reconstruction ─────────────────────────────────────────────────

def build_fuzzy_pattern(source: str) -> re.Pattern:
    """
    Builds a case-insensitive regex that matches the source sentence
    while tolerating whitespace variations (e.g., extra spaces or line breaks).
    """
    words = source.strip().split()
    if not words:
        return re.compile(re.escape(source.strip()), flags=re.IGNORECASE)
    pattern_str = r"\s+".join(re.escape(word) for word in words)
    return re.compile(pattern_str, flags=re.IGNORECASE)


def reconstruct_paragraphs(
    raw_text: str,
    translations: List[TranslationItem],
) -> List[str]:
    """
    Splits raw_text into paragraphs (by double newline) and replaces each
    source sentence with its translation using fuzzy whitespace matching.

    Returns a list of translated paragraph strings in original order.
    Falls back to flat sentence list if raw_text is empty.
    """
    lookup = {item.source.strip(): item.translation for item in translations}

    if not raw_text.strip():
        return [item.translation for item in translations]

    paragraphs = [p.strip() for p in re.split(r"\n{2,}", raw_text) if p.strip()]

    result = []
    for paragraph in paragraphs:
        translated = paragraph
        for source, translation in lookup.items():
            if not source:
                continue
            pattern = build_fuzzy_pattern(source)
            translated = pattern.sub(translation, translated, count=1)
        result.append(translated)

    return result


# ── DOCX builder ──────────────────────────────────────────────────────────────

def add_horizontal_rule(doc: Document) -> None:
    """Inserts a thin horizontal rule paragraph."""
    p = doc.add_paragraph()
    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "6")
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), "CCCCCC")
    pBdr.append(bottom)
    pPr.append(pBdr)


def reconstruct_docx(data: DocExportData) -> io.BytesIO:
    """
    Builds a complete output DOCX from a DocExportData object:
        1. Translated paragraphs in original document order
        2. A thin horizontal rule separator
        3. One-line italic attribution footer
    """
    doc = Document()

    # Page margins
    for section in doc.sections:
        section.top_margin    = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin   = Inches(1.2)
        section.right_margin  = Inches(1.2)

    # Reconstruct paragraphs
    translated_paragraphs = reconstruct_paragraphs(data.raw_text, data.translations)

    for text in translated_paragraphs:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(6)
        run = p.add_run(text)
        run.font.size = Pt(11)

        if is_heading(text):
            run.bold = True
            run.font.size = Pt(13)

    # Footer separator
    doc.add_paragraph()
    add_horizontal_rule(doc)

    footer_p = doc.add_paragraph()
    footer_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    footer_run = footer_p.add_run(
        f"Translated by TransSync AI  ·  "
        f"{data.source_lang.upper()} → {data.target_lang.upper()}  ·  "
        f"{datetime.utcnow().strftime('%B %d, %Y')}"
    )
    footer_run.italic    = True
    footer_run.font.size = Pt(9)
    footer_run.font.color.rgb = RGBColor(0x99, 0x99, 0x99)

    # Serialize
    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf


def make_output_filename(filename: str, target_lang: str) -> str:
    """Derives a clean output filename like translated_report_fr.docx"""
    base = filename.rsplit(".", 1)[0] if "." in filename else filename
    return f"translated_{base}_{target_lang}.docx"
