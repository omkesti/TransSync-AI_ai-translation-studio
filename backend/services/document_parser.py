"""
document_parser.py
------------------
Extracts raw plain text from uploaded PDF or DOCX files.

Dependencies:
    pip install PyMuPDF python-docx

Called by:
    backend/routes/upload.py  →  parse_document(filepath)
"""

import os
import fitz          # PyMuPDF — for PDF
import docx          # python-docx — for DOCX


def parse_document(filepath: str) -> str:
    """
    Accepts an absolute file path to a PDF or DOCX.
    Returns the extracted text as a single string.
    Raises ValueError if the file type is unsupported.
    """
    ext = os.path.splitext(filepath)[1].lower()

    if ext == ".pdf":
        return _parse_pdf(filepath)
    elif ext == ".docx":
        return _parse_docx(filepath)
    else:
        raise ValueError(f"Unsupported file type: '{ext}'. Only .pdf and .docx are accepted.")


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


def _parse_docx(filepath: str) -> str:
    """
    Uses python-docx to extract text paragraph by paragraph.
    Skips empty paragraphs.
    """
    doc = docx.Document(filepath)
    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]

    if not paragraphs:
        raise ValueError("DOCX file appears to be empty.")

    return "\n\n".join(paragraphs)
