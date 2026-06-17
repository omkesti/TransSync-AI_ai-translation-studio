"""
document_parser.py
------------------
Extracts raw plain text from uploaded PDF or DOCX files.

For DOCX files, also provides structured extraction via extract_docx_units()
that walks the entire document (body paragraphs, tables, nested tables,
headers, and footers) and assigns each translatable unit a stable unique ID
along with its run-level formatting metadata.

Dependencies:
    pip install PyMuPDF python-docx

Called by:
    backend/routes/upload.py  →  parse_document(filepath)
    backend/routes/upload.py  →  extract_docx_units(filepath)
"""

import os
import logging
from dataclasses import dataclass, field, asdict

import fitz          # PyMuPDF — for PDF
import docx          # python-docx — for DOCX
from docx.table import Table
from docx.text.paragraph import Paragraph

logger = logging.getLogger(__name__)


# ── Data structures ───────────────────────────────────────────────────────────

@dataclass
class RunMeta:
    """Formatting metadata for a single run within a paragraph."""
    bold:      bool | None = None
    italic:    bool | None = None
    font_name: str | None = None
    font_size: float | None = None   # in Points (e.g. 12.0)
    color_rgb: str | None = None     # hex string e.g. "FF0000", or None


@dataclass
class ExtractionUnit:
    """
    One translatable unit extracted from a DOCX document.
    Each unit carries a stable unique ID, the plain text, its original
    formatting metadata, and positioning info for reconstruction.
    """
    unit_id:     str
    text:        str
    style_name:  str | None = None
    alignment:   str | None = None
    runs:        list[RunMeta] = field(default_factory=list)
    container:   str = "body"          # "body" | "table" | "header" | "footer"
    section_idx: int | None = None


# ── Public API ────────────────────────────────────────────────────────────────

def parse_document(filepath: str) -> str:
    """
    Accepts an absolute file path to a PDF or DOCX.
    Returns the extracted text as a single string.
    Raises ValueError if the file type is unsupported.

    This is the UNCHANGED public API — still returns plain text.
    """
    ext = os.path.splitext(filepath)[1].lower()

    if ext == ".pdf":
        return _parse_pdf(filepath)
    elif ext == ".docx":
        return _parse_docx(filepath)
    else:
        raise ValueError(f"Unsupported file type: '{ext}'. Only .pdf and .docx are accepted.")


def extract_docx_units(filepath: str) -> list[ExtractionUnit]:
    """
    Master extraction function for DOCX files.
    Walks the entire document — body paragraphs, tables (including nested),
    headers, and footers — and returns a flat ordered list of ExtractionUnits,
    each with a stable unique ID and formatting metadata.
    """
    doc = docx.Document(filepath)
    units: list[ExtractionUnit] = []

    # 1. Body content (paragraphs and tables in document order)
    units.extend(_extract_body_units(doc))

    # 2. Headers and footers from all sections
    units.extend(_extract_header_footer_units(doc))

    if not units:
        raise ValueError("DOCX file appears to be empty (no extractable text found).")

    return units


def extraction_units_to_dicts(units: list[ExtractionUnit]) -> list[dict]:
    """Serialize a list of ExtractionUnits to JSON-safe dicts."""
    return [asdict(u) for u in units]


# ── PDF extraction (unchanged) ───────────────────────────────────────────────

def _parse_pdf(filepath: str) -> str:
    """
    Uses PyMuPDF (fitz) to extract text page by page.
    Joins pages with double newlines to preserve structure.
    """
    text_parts = []

    with fitz.open(filepath) as doc:
        for page in doc:
            page_text = page.get_text("text")   # plain text, no HTML
            if page_text.strip():
                text_parts.append(page_text.strip())

    if not text_parts:
        raise ValueError("PDF appears to be empty or is a scanned image (no extractable text).")

    return "\n\n".join(text_parts)


# ── DOCX extraction (new ID-based) ──────────────────────────────────────────

def _parse_docx(filepath: str) -> str:
    """
    Backward-compatible DOCX extraction — returns plain text string.
    Now uses extract_docx_units() internally so tables/headers/footers
    are included in the raw text sent to the NLP pipeline.
    """
    try:
        units = extract_docx_units(filepath)
        return "\n\n".join(u.text for u in units)
    except ValueError:
        raise
    except Exception as e:
        logger.warning(f"extract_docx_units() failed, falling back to basic extraction: {e}")
        # Fallback to the old simple method
        doc = docx.Document(filepath)
        paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
        if not paragraphs:
            raise ValueError("DOCX file appears to be empty.")
        return "\n\n".join(paragraphs)


def _extract_body_units(doc) -> list[ExtractionUnit]:
    """
    Walks doc.element.body children in XML order, dispatching to
    _extract_paragraph_unit() for <w:p> elements and
    _extract_table_units() for <w:tbl> elements.

    This preserves the true interleaved order of paragraphs and tables,
    unlike doc.paragraphs which skips all tables.
    """
    units = []
    para_idx = 0
    table_idx = 0

    for child in doc.element.body:
        tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag

        if tag == 'p':
            para = Paragraph(child, doc)
            unit = _extract_paragraph_unit(para, f"para_{para_idx}", "body")
            para_idx += 1
            if unit:
                units.append(unit)

        elif tag == 'tbl':
            table = Table(child, doc)
            table_units = _extract_table_units(table, f"table_{table_idx}")
            table_idx += 1
            units.extend(table_units)

    return units


def _extract_paragraph_unit(
    para,
    unit_id: str,
    container: str,
    section_idx: int | None = None,
) -> ExtractionUnit | None:
    """
    Given a python-docx Paragraph object, builds one ExtractionUnit.
    Returns None if paragraph text is empty (skip silently).
    Captures: text, style_name, alignment, per-run RunMeta list.
    """
    text = para.text.strip()
    if not text:
        return None

    # Capture paragraph-level formatting
    style_name = None
    try:
        style_name = para.style.name if para.style else None
    except Exception:
        pass

    alignment = None
    try:
        if para.alignment is not None:
            alignment = str(para.alignment).split('.')[-1]  # e.g. "LEFT"
    except Exception:
        pass

    # Capture run-level formatting
    run_metas = []
    for run in para.runs:
        meta = RunMeta()
        try:
            meta.bold = run.bold
        except Exception:
            pass
        try:
            meta.italic = run.italic
        except Exception:
            pass
        try:
            meta.font_name = run.font.name
        except Exception:
            pass
        try:
            if run.font.size is not None:
                meta.font_size = run.font.size.pt
        except Exception:
            pass
        try:
            if run.font.color and run.font.color.rgb:
                meta.color_rgb = str(run.font.color.rgb)
        except Exception:
            pass
        run_metas.append(meta)

    return ExtractionUnit(
        unit_id=unit_id,
        text=text,
        style_name=style_name,
        alignment=alignment,
        runs=run_metas,
        container=container,
        section_idx=section_idx,
    )


def _extract_table_units(table, id_prefix: str) -> list[ExtractionUnit]:
    """
    Recursively walks all rows and cells of a table.
    For each cell, iterates cell.paragraphs and also recurses into
    any cell.tables (nested tables).
    Uses id_prefix to build stable IDs like:
        table_0_cell_1_2_para_0
        table_0_cell_0_0_table_0_cell_0_0_para_0
    """
    units = []

    for row_idx, row in enumerate(table.rows):
        for col_idx, cell in enumerate(row.cells):
            cell_prefix = f"{id_prefix}_cell_{row_idx}_{col_idx}"

            # Extract paragraphs within this cell
            for para_idx, para in enumerate(cell.paragraphs):
                unit = _extract_paragraph_unit(
                    para,
                    f"{cell_prefix}_para_{para_idx}",
                    "table",
                )
                if unit:
                    units.append(unit)

            # Recurse into nested tables within this cell
            for nested_idx, nested_table in enumerate(cell.tables):
                nested_prefix = f"{cell_prefix}_table_{nested_idx}"
                nested_units = _extract_table_units(nested_table, nested_prefix)
                units.extend(nested_units)

    return units


def _extract_header_footer_units(doc) -> list[ExtractionUnit]:
    """
    Iterates doc.sections.
    For each section, walks section.header.paragraphs and section.footer.paragraphs.
    Returns ExtractionUnits with container="header" or "footer".
    """
    units = []

    for section_idx, section in enumerate(doc.sections):
        # Headers
        try:
            if section.header and not section.header.is_linked_to_previous:
                for para_idx, para in enumerate(section.header.paragraphs):
                    unit = _extract_paragraph_unit(
                        para,
                        f"header_{section_idx}_para_{para_idx}",
                        "header",
                        section_idx=section_idx,
                    )
                    if unit:
                        units.append(unit)
        except Exception as e:
            logger.warning(f"Failed to extract header from section {section_idx}: {e}")

        # Footers
        try:
            if section.footer and not section.footer.is_linked_to_previous:
                for para_idx, para in enumerate(section.footer.paragraphs):
                    unit = _extract_paragraph_unit(
                        para,
                        f"footer_{section_idx}_para_{para_idx}",
                        "footer",
                        section_idx=section_idx,
                    )
                    if unit:
                        units.append(unit)
        except Exception as e:
            logger.warning(f"Failed to extract footer from section {section_idx}: {e}")

    return units
