# Multi-Document Batch Translation — Technical Documentation

> TransSync AI · Feature Documentation · June 2025

---

## Overview

This document describes the **Multi-Document Batch Translation** feature added to TransSync AI. Users can now upload multiple PDF/DOCX files simultaneously, translate them all to a chosen target language, and download all translated documents as a ZIP archive from the Export page.

---

## Architecture

### Data Flow

```
UploadPage (N files)
  → uploadDocument(file) × N [sequential HTTP calls]
  → AppContext.addDocuments([{ docId, rawText, filename, status }])
  → navigate("/validation")

ValidationPage
  → Doc tab selector (when N > 1)
  → "Validate All" → validateText(rawText, docId) × N
  → updateDoc(docId, { sentences, status:"validated" })

ReviewPage
  → Doc tab selector (when N > 1)
  → "Translate All" → translateSentences(sentences, …) × N
  → Per-doc batch review → approveTranslations()
  → updateDoc(docId, { results, status:"approved" })

ExportPage
  → Document list table (when N > 1)
  → Individual ⬇ per doc → exportDocument(singleDoc) → .docx
  → "Download All as ZIP" → POST /api/export/batch → .zip
```

### State Management

The `AppContext` was redesigned from holding a single document's state to a **documents array**:

```js
documents = [
  {
    docId:     "uuid",
    filename:  "report.pdf",
    rawText:   "full extracted text…",
    sentences: ["sentence 1", "sentence 2", ...],
    results:   [{ source, translation, match_type }],
    status:    "uploaded" | "validated" | "translated" | "approved" | "error",
    error:     null | "error message",
  },
  // …more documents
]
```

An `activeDocIndex` integer tracks which document is currently focused. The legacy single-doc accessors (`docId`, `rawText`, `sentences`, `results`, `filename`) are derived from `documents[activeDocIndex]`, preserving full backward compatibility.

---

## Files Changed

### Backend

| File | Action | Purpose |
|------|--------|---------|
| `backend/services/docx_builder.py` | **NEW** | Shared DOCX reconstruction logic extracted from `export.py`. Contains: `reconstruct_docx()`, `reconstruct_paragraphs()`, `build_fuzzy_pattern()`, `is_heading()`, `add_horizontal_rule()`, `make_output_filename()`. Both single and batch export routes import from here. |
| `backend/routes/export.py` | **MODIFIED** | Simplified to import from `docx_builder`. Route logic unchanged. |
| `backend/routes/export_batch.py` | **NEW** | `POST /api/export/batch` — Accepts an array of documents, generates a DOCX for each, packs them into a ZIP archive using Python's `zipfile`, and streams it back. Handles duplicate filename collisions. |
| `backend/main.py` | **MODIFIED** | Registered the `export_batch` router. |

### Frontend

| File | Action | Purpose |
|------|--------|---------|
| `frontend_proto/src/context/AppContext.jsx` | **MODIFIED** | Redesigned to hold `documents[]` array + `activeDocIndex`. Added `addDocuments()`, `updateDoc()` helpers. Legacy single-doc setters delegate to `updateDoc()`. |
| `frontend_proto/src/pages/UploadPage.jsx` | **MODIFIED** | Multi-file input (`multiple` attribute). File list UI with remove buttons. Sequential upload loop with progress indicator. Calls `addDocuments()`. |
| `frontend_proto/src/pages/ValidationPage.jsx` | **MODIFIED** | Added document tab selector (shown when documents > 1). Added "Validate All" button that sequentially validates all uploaded documents. |
| `frontend_proto/src/pages/ReviewPage.jsx` | **MODIFIED** | Added document tab selector with status badges. Added "Translate All" button that sequentially translates all validated documents. |
| `frontend_proto/src/pages/ExportPage.jsx` | **MODIFIED** | Added document list table with per-doc sentence counts, TM/LLM breakdown, and individual download buttons. Added "Download All as ZIP" button using the batch export endpoint. |
| `frontend_proto/src/services/api.js` | **MODIFIED** | Added `exportBatch(documents)` function for the batch ZIP endpoint. |

---

## API Endpoints

### Existing (unchanged)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/upload-document` | Upload a single file |
| POST | `/api/validate` | Validate extracted text |
| POST | `/api/translate` | Translate sentences |
| POST | `/api/approve` | Approve translations and store in TM |
| POST | `/api/export` | Export single document as DOCX |

### New

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/export/batch` | Export multiple documents as a ZIP of DOCX files |

#### `POST /api/export/batch` — Request

```json
{
  "documents": [
    {
      "doc_id":       "uuid-1",
      "filename":     "report.pdf",
      "source_lang":  "en",
      "target_lang":  "hi",
      "raw_text":     "Full original text…",
      "translations": [
        { "source": "…", "translation": "…", "match_type": "tm_exact" }
      ]
    }
  ]
}
```

#### `POST /api/export/batch` — Response

- **Content-Type**: `application/zip`
- **Content-Disposition**: `attachment; filename="transsync_batch_export.zip"`
- **Body**: ZIP archive containing one `translated_<filename>_<lang>.docx` per document

---

## Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Single file uploaded | Same UX as before — no tabs shown, single doc flow |
| One file fails to upload | Marked `status:"error"`, rest proceed normally |
| Some docs validated, some not | "Translate All" skips non-validated docs |
| Duplicate filenames in ZIP | Collision suffix `_1`, `_2` appended automatically |
| User refreshes mid-flow | Context is reset (in-memory) — user must re-upload |

---

## Design Decisions

1. **Sequential processing, not parallel**: Uploads, validations, and translations are done one-at-a-time in a loop to avoid overwhelming the Groq API rate limits and Supabase connection pool.

2. **Backward-compatible context**: Instead of rewriting all pages to use `documents[i]`, the legacy single-doc getters/setters are derived from `documents[activeDocIndex]`. This means ValidationPage and ReviewPage work with minimal changes.

3. **Shared DOCX builder**: The reconstruction logic was extracted into `docx_builder.py` to avoid code duplication between single and batch export routes.

4. **In-memory ZIP**: The batch endpoint builds the entire ZIP in memory using Python's `zipfile.ZipFile(BytesIO())`. For the expected document sizes (< 50MB each), this is efficient and avoids temp file cleanup.
