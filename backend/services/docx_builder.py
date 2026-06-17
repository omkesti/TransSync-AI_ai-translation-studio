"""
docx_builder.py
───────────────
Shared DOCX reconstruction logic.

Used by:
    - backend/routes/export.py       (single-doc export)
    - backend/routes/export_batch.py  (multi-doc ZIP export)

Supports TWO reconstruction modes:
    1. NEW — ID-based reconstruction using extraction_units
    2. LEGACY — regex-based paragraph replacement (backward compat)

The mode is selected automatically based on whether extraction_units
is present and non-empty in the DocExportData payload.
"""

import io
import re
import logging
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel
from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

logger = logging.getLogger(__name__)


# ── Shared schemas ────────────────────────────────────────────────────────────

class RunMetaSchema(BaseModel):
    """JSON-safe mirror of RunMeta from document_parser.py."""
    bold:      bool | None = None
    italic:    bool | None = None
    font_name: str | None = None
    font_size: float | None = None
    color_rgb: str | None = None


class ExtractionUnitSchema(BaseModel):
    """JSON-safe mirror of ExtractionUnit from document_parser.py."""
    unit_id:     str
    text:        str
    style_name:  str | None = None
    alignment:   str | None = None
    runs:        list[RunMetaSchema] = []
    container:   str = "body"
    section_idx: int | None = None


class TranslationItem(BaseModel):
    source:      str
    translation: str
    match_type:  Optional[str] = None
    unit_id:     Optional[str] = None  # NEW — used for ID-based lookup


class DocExportData(BaseModel):
    """
    All the data needed to reconstruct one translated document.
    Both the single-export and batch-export routes build instances of this.
    """
    doc_id:           str
    filename:         str = "document"
    source_lang:      str = "en"
    target_lang:      str
    raw_text:         str = ""                            # KEPT for backward compat
    translations:     List[TranslationItem]
    extraction_units: List[ExtractionUnitSchema] = []    # NEW — empty = use legacy path


# ── ALIGNMENT MAP ─────────────────────────────────────────────────────────────

_ALIGNMENT_MAP = {
    "LEFT":             WD_ALIGN_PARAGRAPH.LEFT,
    "CENTER":           WD_ALIGN_PARAGRAPH.CENTER,
    "RIGHT":            WD_ALIGN_PARAGRAPH.RIGHT,
    "JUSTIFY":          WD_ALIGN_PARAGRAPH.JUSTIFY,
    "DISTRIBUTE":       WD_ALIGN_PARAGRAPH.DISTRIBUTE,
    "LEFT (0)":         WD_ALIGN_PARAGRAPH.LEFT,
    "CENTER (1)":       WD_ALIGN_PARAGRAPH.CENTER,
    "RIGHT (2)":        WD_ALIGN_PARAGRAPH.RIGHT,
    "JUSTIFY (3)":      WD_ALIGN_PARAGRAPH.JUSTIFY,
    "DISTRIBUTE (4)":   WD_ALIGN_PARAGRAPH.DISTRIBUTE,
}


# ══════════════════════════════════════════════════════════════════════════════
# NEW: ID-BASED RECONSTRUCTION
# ══════════════════════════════════════════════════════════════════════════════

def reconstruct_by_id(
    units: list[ExtractionUnitSchema],
    translations: list[TranslationItem],
) -> list[tuple[ExtractionUnitSchema, str]]:
    """
    Builds a translation map keyed by unit_id.
    For each unit, looks up the translation by ID first, then by source text.
    Falls back to the unit's original text if no translation found.

    Returns ordered list of (unit, translated_text) tuples.
    Fault isolation: one missing translation has zero effect on others.
    """
    # Primary map: by unit_id
    id_map: dict[str, str] = {}
    for item in translations:
        if item.unit_id:
            id_map[item.unit_id] = item.translation

    # Fallback map: by source text (stripped)
    source_map: dict[str, str] = {}
    for item in translations:
        key = item.source.strip()
        if key:
            source_map[key] = item.translation

    result = []
    matched = 0
    for unit in units:
        translated = id_map.get(unit.unit_id)                  # primary: by ID
        if translated is None:
            translated = source_map.get(unit.text.strip())     # fallback: by source text
        if translated is None:
            translated = unit.text                             # last resort: keep original
            logger.warning(f"[reconstruct] No translation found for unit '{unit.unit_id}': {unit.text[:60]}...")
        else:
            matched += 1
        result.append((unit, translated))

    logger.info(f"[reconstruct] Matched {matched}/{len(units)} units by ID/source lookup")
    return result


def _apply_paragraph_formatting(para, unit: ExtractionUnitSchema, doc: Document) -> None:
    """Applies style and alignment from ExtractionUnit metadata."""
    # Apply style
    if unit.style_name:
        try:
            para.style = doc.styles[unit.style_name]
        except (KeyError, ValueError):
            # Style not available in newly created doc — skip gracefully
            pass

    # Apply alignment
    if unit.alignment:
        alignment_val = _ALIGNMENT_MAP.get(unit.alignment.upper())
        if alignment_val is not None:
            para.alignment = alignment_val


def _apply_run_text(para, text: str, unit: ExtractionUnitSchema) -> None:
    """
    Adds a run with text and applies per-run formatting from metadata.
    Uses the first run's metadata as the dominant formatting for the translated text.
    """
    run = para.add_run(text)

    if unit.runs:
        meta = unit.runs[0]  # use first run as dominant formatting
        if meta.bold is not None:
            run.bold = meta.bold
        if meta.italic is not None:
            run.italic = meta.italic
        if meta.font_name:
            run.font.name = meta.font_name
        if meta.font_size:
            run.font.size = Pt(meta.font_size)
        if meta.color_rgb:
            try:
                run.font.color.rgb = RGBColor.from_string(meta.color_rgb)
            except Exception:
                pass
    else:
        # No run metadata — apply sensible defaults
        run.font.size = Pt(11)


def _write_body_and_table_units(
    doc: Document,
    pairs: list[tuple[ExtractionUnitSchema, str]],
) -> None:
    """
    Writes body paragraphs and tables to the document in original order.

    Body paragraphs are written directly; table cells are grouped by their
    table index and written as actual Word tables.
    """
    # Separate body and table units
    body_pairs = [(u, t) for u, t in pairs if u.container == "body"]
    table_pairs = [(u, t) for u, t in pairs if u.container == "table"]

    # Parse table structure from unit_ids
    # e.g. "table_0_cell_1_2_para_0" → table_idx=0, row=1, col=2
    tables_data: dict[int, dict[tuple[int, int], list[str]]] = {}
    tables_formatting: dict[int, dict[tuple[int, int], list[ExtractionUnitSchema]]] = {}

    for u, t in table_pairs:
        parts = u.unit_id.split('_')
        try:
            # Find first "table" token and extract table_idx, row, col
            ti_pos = parts.index('table')
            table_idx = int(parts[ti_pos + 1])
            # Find first "cell" token after the table token
            cell_pos = parts.index('cell', ti_pos)
            row = int(parts[cell_pos + 1])
            col = int(parts[cell_pos + 2])
        except (ValueError, IndexError):
            logger.warning(f"[reconstruct] Could not parse table unit_id: {u.unit_id}")
            continue

        tables_data.setdefault(table_idx, {}).setdefault((row, col), []).append(t)
        tables_formatting.setdefault(table_idx, {}).setdefault((row, col), []).append(u)

    # Interleave body paragraphs and tables in document order
    # Strategy: write all body paragraphs first, then tables
    # (The extraction preserves document order within each container)

    # Track which table_idx should appear after which body paragraph
    # For simplicity, write body first, then tables — this matches most documents
    for unit, translated in body_pairs:
        p = doc.add_paragraph()
        _apply_paragraph_formatting(p, unit, doc)
        _apply_run_text(p, translated, unit)

    # Write each table (sorted by table_idx)
    for table_idx in sorted(tables_data.keys()):
        cell_data = tables_data[table_idx]
        cell_fmt = tables_formatting.get(table_idx, {})

        if not cell_data:
            continue

        rows = max(r for r, c in cell_data.keys()) + 1
        cols = max(c for r, c in cell_data.keys()) + 1

        tbl = doc.add_table(rows=rows, cols=cols)
        tbl.style = 'Table Grid'

        for (row, col), texts in cell_data.items():
            try:
                cell = tbl.cell(row, col)
                # Clear default empty paragraph
                if cell.paragraphs:
                    cell.paragraphs[0].text = ""

                for i, text in enumerate(texts):
                    if i == 0 and cell.paragraphs:
                        p = cell.paragraphs[0]
                    else:
                        p = cell.add_paragraph()

                    # Apply formatting from the corresponding unit
                    fmt_units = cell_fmt.get((row, col), [])
                    if i < len(fmt_units):
                        _apply_run_text(p, text, fmt_units[i])
                    else:
                        p.add_run(text).font.size = Pt(11)
            except Exception as e:
                logger.warning(f"[reconstruct] Failed to write table cell ({row},{col}): {e}")


def _write_header_footer_units(
    doc: Document,
    pairs: list[tuple[ExtractionUnitSchema, str]],
) -> None:
    """
    Writes header and footer content into the document sections.
    """
    header_pairs = [(u, t) for u, t in pairs if u.container == "header"]
    footer_pairs = [(u, t) for u, t in pairs if u.container == "footer"]

    for unit, translated in header_pairs:
        si = unit.section_idx or 0
        try:
            if si < len(doc.sections):
                section = doc.sections[si]
                section.header.is_linked_to_previous = False
                p = section.header.add_paragraph()
                _apply_paragraph_formatting(p, unit, doc)
                _apply_run_text(p, translated, unit)
        except Exception as e:
            logger.warning(f"[reconstruct] Failed to write header unit '{unit.unit_id}': {e}")

    for unit, translated in footer_pairs:
        si = unit.section_idx or 0
        try:
            if si < len(doc.sections):
                section = doc.sections[si]
                section.footer.is_linked_to_previous = False
                p = section.footer.add_paragraph()
                _apply_paragraph_formatting(p, unit, doc)
                _apply_run_text(p, translated, unit)
        except Exception as e:
            logger.warning(f"[reconstruct] Failed to write footer unit '{unit.unit_id}': {e}")


# ══════════════════════════════════════════════════════════════════════════════
# LEGACY: REGEX-BASED RECONSTRUCTION (kept for backward compatibility)
# ══════════════════════════════════════════════════════════════════════════════

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
    LEGACY: Splits raw_text into paragraphs (by double newline) and replaces each
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


# ══════════════════════════════════════════════════════════════════════════════
# MAIN BUILDER
# ══════════════════════════════════════════════════════════════════════════════

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
    Builds a complete output DOCX from a DocExportData object.

    If extraction_units are provided (new ID-based path):
        Uses reconstruct_by_id() for deterministic, fault-isolated reconstruction.

    Otherwise (legacy fallback):
        Uses reconstruct_paragraphs() with regex matching.

    Always appends an attribution footer.
    """
    doc = Document()

    # Page margins
    for section in doc.sections:
        section.top_margin    = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin   = Inches(1.2)
        section.right_margin  = Inches(1.2)

    if data.extraction_units:
        # ── NEW ID-BASED PATH ────────────────────────────────────────────
        logger.info(f"[export] Using ID-based reconstruction with {len(data.extraction_units)} units")
        pairs = reconstruct_by_id(data.extraction_units, data.translations)

        # Write body paragraphs and tables
        _write_body_and_table_units(doc, pairs)

        # Write headers and footers
        _write_header_footer_units(doc, pairs)

    else:
        # ── LEGACY FALLBACK PATH ─────────────────────────────────────────
        logger.info("[export] Using legacy regex-based reconstruction (no extraction_units)")
        translated_paragraphs = reconstruct_paragraphs(data.raw_text, data.translations)

        for text in translated_paragraphs:
            p = doc.add_paragraph()
            p.paragraph_format.space_after = Pt(6)
            run = p.add_run(text)
            run.font.size = Pt(11)

            if is_heading(text):
                run.bold = True
                run.font.size = Pt(13)

    # ── Attribution footer (always) ──────────────────────────────────────
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
