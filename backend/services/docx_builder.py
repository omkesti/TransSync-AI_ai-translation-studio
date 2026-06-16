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
    
    Now supports ID-based reconstruction with formatting preservation.
"""

import io
import re
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any

from pydantic import BaseModel
from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

# Configure logging
logger = logging.getLogger(__name__)


# ── Text sanitization ─────────────────────────────────────────────────────────

def sanitize_xml_text(text: str) -> str:
    """
    Sanitizes text to be XML-compatible by removing NULL bytes and control characters.
    
    Args:
        text: Input text that may contain invalid XML characters
    
    Returns:
        Sanitized text safe for XML/DOCX
    """
    if not text:
        return ""
    
    # Remove NULL bytes
    text = text.replace('\x00', '')
    
    # Remove control characters except for tab, newline, and carriage return
    # XML 1.0 allows: #x9 | #xA | #xD | [#x20-#xD7FF] | [#xE000-#xFFFD] | [#x10000-#x10FFFF]
    sanitized = []
    for char in text:
        code = ord(char)
        # Allow tab (9), newline (10), carriage return (13), and normal characters (>= 32)
        if code in (9, 10, 13) or code >= 32:
            # Exclude the invalid range #xD800-#xDFFF (surrogate pairs)
            if not (0xD800 <= code <= 0xDFFF):
                sanitized.append(char)
    
    return ''.join(sanitized)


# ── Shared schemas ────────────────────────────────────────────────────────────

class TranslationItem(BaseModel):
    source:      str
    translation: str
    match_type:  Optional[str] = None
    id:          Optional[str] = None  # ID for ID-based reconstruction


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
    extraction_data: Optional[Dict[str, Any]] = None  # Structured extraction with IDs and formatting


# ── ID-based reconstruction functions ─────────────────────────────────────────

def reconstruct_by_id(
    extraction_data: Optional[Dict[str, Any]],
    translations: List[TranslationItem],
    raw_text: str = ""
) -> Dict[str, Any]:
    """
    Reconstructs document structure using ID-based lookup instead of regex matching.
    
    Args:
        extraction_data: Structured extraction from parse_document_structured()
        translations: List of translation items (may include IDs)
        raw_text: Fallback raw text for backward compatibility
    
    Returns:
        Dictionary with reconstructed document structure:
        {
            "units": {id: {text, formatting, position}},
            "structure": information about document organization
        }
    """
    try:
        # Create translation map from IDs
        translation_map = {}
        for item in translations:
            if item.id:
                translation_map[item.id] = item.translation
            # Also map by source text for fallback
            translation_map[item.source.strip()] = item.translation
        
        logger.info(f"Reconstruction: {len(translations)} translations provided, {len(translation_map)} unique mappings created")
        
        # If we have structured extraction data, use ID-based reconstruction
        if extraction_data and "units" in extraction_data:
            logger.info(f"Using ID-based reconstruction with {len(extraction_data['units'])} units")
            reconstructed_units = {}
            
            for unit_id, unit_data in extraction_data["units"].items():
                try:
                    # Look up translation by ID first, then by source text
                    original_text = unit_data.get("text", "")
                    translated_text = translation_map.get(unit_id, 
                                                         translation_map.get(original_text.strip(), 
                                                                            original_text))
                    
                    # Preserve formatting and position information
                    reconstructed_units[unit_id] = {
                        "text": translated_text,
                        "formatting": unit_data.get("formatting", {}),
                        "position": unit_data.get("position", {})
                    }
                except Exception as e:
                    logger.warning(f"Failed to reconstruct unit {unit_id}: {str(e)}")
                    # Keep original text if reconstruction fails
                    reconstructed_units[unit_id] = unit_data
            
            logger.info(f"Successfully reconstructed {len(reconstructed_units)} units using ID-based method")
            return {
                "type": "structured",
                "units": reconstructed_units
            }
        
        # Fallback to legacy regex-based reconstruction for backward compatibility
        else:
            logger.info("Falling back to legacy regex-based reconstruction")
            paragraphs = reconstruct_paragraphs(raw_text, translations)
            return {
                "type": "legacy",
                "paragraphs": paragraphs
            }
    
    except Exception as e:
        logger.error(f"Reconstruction failed: {str(e)}", exc_info=True)
        raise


def _apply_run_formatting(run, run_format: Dict[str, Any]):
    """
    Applies run-level formatting to a text run.
    
    Args:
        run: python-docx Run object
        run_format: Dictionary with formatting properties (bold, italic, font_name, font_size, font_color)
    """
    try:
        if run_format.get("bold") is not None:
            run.bold = run_format["bold"]
        
        if run_format.get("italic") is not None:
            run.italic = run_format["italic"]
        
        if run_format.get("font_name"):
            run.font.name = run_format["font_name"]
        
        if run_format.get("font_size"):
            run.font.size = run_format["font_size"]
        
        if run_format.get("font_color"):
            try:
                # Parse hex color string like "#ff0000"
                color_str = run_format["font_color"].lstrip("#")
                if len(color_str) == 6:
                    r = int(color_str[0:2], 16)
                    g = int(color_str[2:4], 16)
                    b = int(color_str[4:6], 16)
                    run.font.color.rgb = RGBColor(r, g, b)
            except Exception as e:
                logger.warning(f"Failed to apply font color: {str(e)}")
    except Exception as e:
        logger.warning(f"Failed to apply run formatting: {str(e)}")


def _apply_paragraph_formatting(paragraph, para_format: Dict[str, Any], doc: Document):
    """
    Applies paragraph-level formatting to a paragraph.
    
    Args:
        paragraph: python-docx Paragraph object
        para_format: Dictionary with formatting properties (alignment, spacing, indentation, style_name)
        doc: Document object (needed for style lookup)
    """
    try:
        if para_format.get("alignment"):
            try:
                # Parse alignment string like "WD_ALIGN_PARAGRAPH.CENTER"
                alignment_str = para_format["alignment"]
                if "CENTER" in alignment_str:
                    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
                elif "RIGHT" in alignment_str:
                    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
                elif "JUSTIFY" in alignment_str:
                    paragraph.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
                # LEFT is default, no need to set explicitly
            except Exception as e:
                logger.warning(f"Failed to apply paragraph alignment: {str(e)}")
        
        if para_format.get("space_before"):
            paragraph.paragraph_format.space_before = para_format["space_before"]
        
        if para_format.get("space_after"):
            paragraph.paragraph_format.space_after = para_format["space_after"]
        
        if para_format.get("left_indent"):
            paragraph.paragraph_format.left_indent = para_format["left_indent"]
        
        if para_format.get("style_name"):
            try:
                # Apply original style if it exists in document
                style_name = para_format["style_name"]
                if style_name in doc.styles:
                    paragraph.style = doc.styles[style_name]
            except Exception as e:
                logger.warning(f"Failed to apply paragraph style '{para_format.get('style_name')}': {str(e)}")
    except Exception as e:
        logger.warning(f"Failed to apply paragraph formatting: {str(e)}")


def _reconstruct_paragraph_with_formatting(doc: Document, unit_data: Dict[str, Any]) -> Any:
    """
    Reconstructs a single paragraph with formatting preserved.
    
    Args:
        doc: Document object
        unit_data: Unit data with text and formatting
    
    Returns:
        The created paragraph object
    """
    text = sanitize_xml_text(unit_data.get("text", ""))
    formatting = unit_data.get("formatting", {})
    
    paragraph = doc.add_paragraph()
    
    # Apply paragraph-level formatting
    para_format = formatting.get("paragraph", {})
    _apply_paragraph_formatting(paragraph, para_format, doc)
    
    # Apply run-level formatting
    runs_format = formatting.get("runs", [])
    
    if runs_format and len(runs_format) > 1:
        # We have multiple runs with different formatting
        # Try to reconstruct them based on the original run structure
        # Note: This is an approximation since translated text may have different length
        
        # Calculate relative positions of each run
        total_original_length = sum(len(r.get("text", "")) for r in runs_format)
        
        if total_original_length > 0:
            current_pos = 0
            for run_fmt in runs_format:
                run_text = run_fmt.get("text", "")
                run_length = len(run_text)
                run_ratio = run_length / total_original_length
                
                # Calculate corresponding position in translated text
                translated_length = int(len(text) * run_ratio)
                if current_pos + translated_length > len(text):
                    translated_length = len(text) - current_pos
                
                if translated_length > 0:
                    run_text_translated = text[current_pos:current_pos + translated_length]
                    run = paragraph.add_run(run_text_translated)
                    _apply_run_formatting(run, run_fmt)
                    current_pos += translated_length
            
            # Add any remaining text as final run
            if current_pos < len(text):
                run = paragraph.add_run(text[current_pos:])
                _apply_run_formatting(run, runs_format[-1])
        else:
            # Fallback: apply first run formatting to entire text
            run = paragraph.add_run(text)
            _apply_run_formatting(run, runs_format[0])
    
    elif runs_format and len(runs_format) == 1:
        # Single run - apply its formatting to the entire text
        run = paragraph.add_run(text)
        _apply_run_formatting(run, runs_format[0])
    else:
        # No specific formatting - add as plain text
        run = paragraph.add_run(text)
        run.font.size = Pt(11)
    
    return paragraph


def _reconstruct_table(doc: Document, table_units: Dict[str, Dict[str, Any]]) -> Any:
    """
    Reconstructs a table from extracted table cell data.
    
    Args:
        doc: Document object
        table_units: Dictionary of table cell units with position information
    
    Returns:
        The created table object
    """
    # Determine table dimensions from cell positions
    max_row = 0
    max_col = 0
    
    for unit_id, unit_data in table_units.items():
        position = unit_data.get("position", {})
        if position.get("type") == "table_cell":
            max_row = max(max_row, position.get("row", 0))
            max_col = max(max_col, position.get("col", 0))
    
    # Create table with appropriate dimensions
    table = doc.add_table(rows=max_row + 1, cols=max_col + 1)
    
    # Populate cells
    for unit_id, unit_data in table_units.items():
        position = unit_data.get("position", {})
        if position.get("type") == "table_cell":
            row = position.get("row", 0)
            col = position.get("col", 0)
            text = sanitize_xml_text(unit_data.get("text", ""))
            
            cell = table.cell(row, col)
            cell.text = text
            
            # Apply formatting to cell paragraph
            if cell.paragraphs:
                formatting = unit_data.get("formatting", {})
                para_format = formatting.get("paragraph", {})
                _apply_paragraph_formatting(cell.paragraphs[0], para_format, doc)
                
                # Apply run formatting
                runs_format = formatting.get("runs", [])
                if runs_format and cell.paragraphs[0].runs:
                    _apply_run_formatting(cell.paragraphs[0].runs[0], runs_format[0])
    
    return table
    
    return table


# ── Legacy paragraph reconstruction (for backward compatibility) ─────────────

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
    LEGACY FUNCTION: Kept for backward compatibility.
    
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
        1. Translated content in original document order with formatting preserved
        2. A thin horizontal rule separator
        3. One-line italic attribution footer
    
    Supports both ID-based reconstruction (new) and legacy regex-based reconstruction.
    """
    doc = Document()

    # Page margins
    for section in doc.sections:
        section.top_margin    = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin   = Inches(1.2)
        section.right_margin  = Inches(1.2)

    # Try ID-based reconstruction first
    reconstruction = reconstruct_by_id(data.extraction_data, data.translations, data.raw_text)
    
    if reconstruction["type"] == "structured":
        # ID-based reconstruction with formatting preservation
        units = reconstruction["units"]
        
        # Group units by position type
        body_units = []
        table_units_by_table = {}
        header_units_by_section = {}
        footer_units_by_section = {}
        
        for unit_id, unit_data in units.items():
            position = unit_data.get("position", {})
            pos_type = position.get("type", "body")
            
            if pos_type == "body":
                body_units.append((position.get("index", 0), unit_id, unit_data))
            elif pos_type == "table_cell":
                table_id = position.get("table_id", "table_0")
                if table_id not in table_units_by_table:
                    table_units_by_table[table_id] = {}
                table_units_by_table[table_id][unit_id] = unit_data
            elif pos_type == "header":
                section = position.get("section", 0)
                if section not in header_units_by_section:
                    header_units_by_section[section] = []
                header_units_by_section[section].append((position.get("index", 0), unit_id, unit_data))
            elif pos_type == "footer":
                section = position.get("section", 0)
                if section not in footer_units_by_section:
                    footer_units_by_section[section] = []
                footer_units_by_section[section].append((position.get("index", 0), unit_id, unit_data))
        
        # Reconstruct headers (for first section)
        if 0 in header_units_by_section and doc.sections:
            header = doc.sections[0].header
            header_units_by_section[0].sort(key=lambda x: x[0])  # Sort by index
            for _, unit_id, unit_data in header_units_by_section[0]:
                # Add to header with sanitized text
                text = sanitize_xml_text(unit_data.get("text", ""))
                para = header.add_paragraph(text)
                formatting = unit_data.get("formatting", {})
                para_format = formatting.get("paragraph", {})
                _apply_paragraph_formatting(para, para_format, doc)
        
        # Reconstruct body paragraphs and tables in order
        body_units.sort(key=lambda x: x[0])  # Sort by index
        
        # We need to interleave body paragraphs and tables correctly
        # For simplicity, add body paragraphs first, then tables
        for _, unit_id, unit_data in body_units:
            _reconstruct_paragraph_with_formatting(doc, unit_data)
        
        # Add tables
        for table_id in sorted(table_units_by_table.keys()):
            _reconstruct_table(doc, table_units_by_table[table_id])
        
        # Reconstruct footers (for first section)
        if 0 in footer_units_by_section and doc.sections:
            footer = doc.sections[0].footer
            footer_units_by_section[0].sort(key=lambda x: x[0])  # Sort by index
            for _, unit_id, unit_data in footer_units_by_section[0]:
                # Add to footer with sanitized text
                text = sanitize_xml_text(unit_data.get("text", ""))
                para = footer.add_paragraph(text)
                formatting = unit_data.get("formatting", {})
                para_format = formatting.get("paragraph", {})
                _apply_paragraph_formatting(para, para_format, doc)
    
    else:
        # Legacy reconstruction - use old behavior
        translated_paragraphs = reconstruction["paragraphs"]
        
        for text in translated_paragraphs:
            # Sanitize text before adding to document
            text = sanitize_xml_text(text)
            
            p = doc.add_paragraph()
            p.paragraph_format.space_after = Pt(6)
            run = p.add_run(text)
            run.font.size = Pt(11)
            
            # Note: is_heading() heuristic removed in favor of style-based formatting
            # For legacy mode, we keep simple formatting
            if len(text) <= 80 and not text.endswith(('.', '!', '?', ',', ';', ':')):
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
