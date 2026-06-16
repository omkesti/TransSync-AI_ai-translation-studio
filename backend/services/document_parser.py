"""
document_parser.py
------------------
Extracts raw plain text from uploaded PDF or DOCX files.
For DOCX files, performs exhaustive extraction with ID assignment and formatting metadata.

Dependencies:
    pip install PyMuPDF python-docx

Called by:
    backend/routes/upload.py  →  parse_document(filepath)
"""

import os
import logging
from typing import Dict, Any, Optional, List
import fitz          # PyMuPDF — for PDF
import docx          # python-docx — for DOCX
from docx.text.paragraph import Paragraph
from docx.table import Table, _Cell

# Configure logging
logger = logging.getLogger(__name__)


def parse_document(filepath: str) -> str:
    """
    Accepts an absolute file path to a PDF or DOCX.
    Returns the extracted text as a single string.
    Raises ValueError if the file type is unsupported.
    """
    ext = os.path.splitext(filepath)[1].lower()

    try:
        if ext == ".pdf":
            return _parse_pdf(filepath)
        elif ext == ".docx":
            return _parse_docx(filepath)
        else:
            error_msg = f"Unsupported file type: '{ext}'. Only .pdf and .docx are accepted."
            logger.error(f"Extraction failed: {error_msg} (file: {filepath})")
            raise ValueError(error_msg)
    except Exception as e:
        logger.error(f"Document parsing failed for {filepath}: {str(e)}", exc_info=True)
        raise


def parse_document_structured(filepath: str) -> Dict[str, Any]:
    """
    Accepts an absolute file path to a PDF or DOCX.
    For DOCX files, returns structured extraction with IDs and formatting metadata.
    For PDF files, returns a simplified structure for backward compatibility.
    Raises ValueError if the file type is unsupported.
    """
    ext = os.path.splitext(filepath)[1].lower()

    try:
        if ext == ".pdf":
            # PDF extraction returns simplified structure for backward compatibility
            logger.info(f"Extracting PDF: {filepath}")
            text = _parse_pdf(filepath)
            return {
                "type": "pdf",
                "raw_text": text,
                "units": {}
            }
        elif ext == ".docx":
            logger.info(f"Extracting DOCX with structured format: {filepath}")
            return _parse_docx_structured(filepath)
        else:
            error_msg = f"Unsupported file type: '{ext}'. Only .pdf and .docx are accepted."
            logger.error(f"Structured extraction failed: {error_msg} (file: {filepath})")
            raise ValueError(error_msg)
    except Exception as e:
        logger.error(f"Structured document parsing failed for {filepath}: {str(e)}", exc_info=True)
        raise


def _parse_pdf(filepath: str) -> str:
    """
    Uses PyMuPDF (fitz) to extract text page by page.
    Joins pages with double newlines to preserve structure.
    """
    text_parts = []

    try:
        with fitz.open(filepath) as doc:
            for page_num, page in enumerate(doc):
                page_text = page.get_text("text")   # plain text, no HTML
                if page_text.strip():
                    text_parts.append(page_text.strip())
                else:
                    logger.warning(f"Page {page_num + 1} in PDF {filepath} appears to be empty")

        if not text_parts:
            error_msg = "PDF appears to be empty or is a scanned image (no extractable text)."
            logger.error(f"PDF extraction failed for {filepath}: {error_msg}")
            raise ValueError(error_msg)

        logger.info(f"Successfully extracted {len(text_parts)} pages from PDF: {filepath}")
        return "\n\n".join(text_parts)
    
    except Exception as e:
        logger.error(f"PDF extraction error for {filepath}: {str(e)}", exc_info=True)
        raise


def _parse_docx(filepath: str) -> str:
    """
    Uses python-docx to extract text paragraph by paragraph.
    Skips empty paragraphs.
    Returns plain text for backward compatibility.
    For structured extraction with IDs, use parse_document_structured().
    """
    # Use structured extraction internally but return plain text for compatibility
    structured = _parse_docx_structured(filepath)
    return structured.get("raw_text", "")


def _parse_docx_structured(filepath: str) -> Dict[str, Any]:
    """
    Exhaustively extracts all content from a DOCX file with ID assignment and formatting metadata.
    
    Returns a structured dictionary:
    {
        "type": "docx",
        "raw_text": str,  # backward compatibility
        "units": {
            id: {
                "text": str,
                "formatting": {...},
                "position": {...}
            }
        }
    }
    """
    try:
        doc = docx.Document(filepath)
        units = {}
        raw_text_parts = []
        
        # Extract body paragraphs
        para_count = 0
        for para_idx, paragraph in enumerate(doc.paragraphs):
            if paragraph.text.strip():
                unit_id = f"para_{para_idx}"
                try:
                    unit_data = _extract_paragraph_data(paragraph)
                    units[unit_id] = {
                        **unit_data,
                        "position": {"type": "body", "index": para_idx}
                    }
                    raw_text_parts.append(paragraph.text.strip())
                    para_count += 1
                except Exception as e:
                    logger.warning(f"Failed to extract paragraph {para_idx} from {filepath}: {str(e)}")
        
        logger.info(f"Extracted {para_count} body paragraphs from DOCX: {filepath}")
        
        # Extract tables
        table_count = 0
        for table_idx, table in enumerate(doc.tables):
            try:
                table_units = _extract_from_table(table, f"table_{table_idx}")
                units.update(table_units)
                # Add table content to raw_text for backward compatibility
                for unit_id, unit_data in table_units.items():
                    raw_text_parts.append(unit_data["text"])
                table_count += 1
            except Exception as e:
                logger.warning(f"Failed to extract table {table_idx} from {filepath}: {str(e)}")
        
        if table_count > 0:
            logger.info(f"Extracted {table_count} tables from DOCX: {filepath}")
        
        # Extract headers and footers
        header_count = 0
        footer_count = 0
        for section_idx, section in enumerate(doc.sections):
            # Extract header
            if section.header:
                for para_idx, paragraph in enumerate(section.header.paragraphs):
                    if paragraph.text.strip():
                        unit_id = f"header_{section_idx}_para_{para_idx}"
                        try:
                            unit_data = _extract_paragraph_data(paragraph)
                            units[unit_id] = {
                                **unit_data,
                                "position": {"type": "header", "section": section_idx, "index": para_idx}
                            }
                            raw_text_parts.append(paragraph.text.strip())
                            header_count += 1
                        except Exception as e:
                            logger.warning(f"Failed to extract header paragraph {para_idx} from section {section_idx} in {filepath}: {str(e)}")
            
            # Extract footer
            if section.footer:
                for para_idx, paragraph in enumerate(section.footer.paragraphs):
                    if paragraph.text.strip():
                        unit_id = f"footer_{section_idx}_para_{para_idx}"
                        try:
                            unit_data = _extract_paragraph_data(paragraph)
                            units[unit_id] = {
                                **unit_data,
                                "position": {"type": "footer", "section": section_idx, "index": para_idx}
                            }
                            raw_text_parts.append(paragraph.text.strip())
                            footer_count += 1
                        except Exception as e:
                            logger.warning(f"Failed to extract footer paragraph {para_idx} from section {section_idx} in {filepath}: {str(e)}")
        
        if header_count > 0:
            logger.info(f"Extracted {header_count} header paragraphs from DOCX: {filepath}")
        if footer_count > 0:
            logger.info(f"Extracted {footer_count} footer paragraphs from DOCX: {filepath}")
        
        if not units:
            error_msg = "DOCX file appears to be empty."
            logger.error(f"DOCX extraction failed for {filepath}: {error_msg}")
            raise ValueError(error_msg)
        
        logger.info(f"Successfully extracted {len(units)} total units from DOCX: {filepath}")
        
        return {
            "type": "docx",
            "raw_text": "\n\n".join(raw_text_parts),
            "units": units
        }
    
    except Exception as e:
        logger.error(f"DOCX structured extraction error for {filepath}: {str(e)}", exc_info=True)
        raise


def _extract_paragraph_data(paragraph: Paragraph) -> Dict[str, Any]:
    """
    Extracts text and formatting metadata from a paragraph.
    
    Returns:
    {
        "text": str,
        "formatting": {
            "paragraph": {...},
            "runs": [...]
        }
    }
    """
    text = paragraph.text.strip()
    
    # Capture paragraph-level formatting
    para_format = {
        "alignment": str(paragraph.alignment) if paragraph.alignment else None,
        "space_before": paragraph.paragraph_format.space_before,
        "space_after": paragraph.paragraph_format.space_after,
        "left_indent": paragraph.paragraph_format.left_indent,
        "style_name": paragraph.style.name if paragraph.style else None
    }
    
    # Capture run-level formatting
    runs_format = []
    for run in paragraph.runs:
        run_data = {
            "text": run.text,
            "bold": run.bold,
            "italic": run.italic,
            "font_name": run.font.name if run.font.name else None,
            "font_size": run.font.size,
            "font_color": _extract_font_color(run)
        }
        runs_format.append(run_data)
    
    return {
        "text": text,
        "formatting": {
            "paragraph": para_format,
            "runs": runs_format
        }
    }


def _extract_font_color(run) -> Optional[str]:
    """
    Extracts font color from a run as a hex string.
    Returns None if color is not set or is automatic.
    """
    try:
        if run.font.color and run.font.color.rgb:
            rgb = run.font.color.rgb
            return f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"
    except:
        pass
    return None


def _extract_from_table(table: Table, id_prefix: str) -> Dict[str, Dict[str, Any]]:
    """
    Recursively extracts text and formatting from table cells.
    
    Args:
        table: python-docx Table object
        id_prefix: Prefix for generating cell IDs (e.g., "table_0")
    
    Returns:
        Dictionary mapping cell IDs to cell data
    """
    units = {}
    
    for row_idx, row in enumerate(table.rows):
        for col_idx, cell in enumerate(row.cells):
            cell_id = f"{id_prefix}_cell_{row_idx}_{col_idx}"
            
            # Extract text from cell paragraphs
            cell_text_parts = []
            for para in cell.paragraphs:
                if para.text.strip():
                    cell_text_parts.append(para.text.strip())
            
            # Only add cell if it has content
            if cell_text_parts:
                cell_text = " ".join(cell_text_parts)
                
                # Get formatting from first paragraph
                if cell.paragraphs:
                    first_para = cell.paragraphs[0]
                    formatting = _extract_paragraph_data(first_para)["formatting"]
                else:
                    formatting = {"paragraph": {}, "runs": []}
                
                units[cell_id] = {
                    "text": cell_text,
                    "formatting": formatting,
                    "position": {
                        "type": "table_cell",
                        "table_id": id_prefix,
                        "row": row_idx,
                        "col": col_idx
                    }
                }
            
            # Recursively process nested tables
            if cell.tables:
                for nested_idx, nested_table in enumerate(cell.tables):
                    nested_prefix = f"{cell_id}_table_{nested_idx}"
                    nested_units = _extract_from_table(nested_table, nested_prefix)
                    units.update(nested_units)
    
    return units
