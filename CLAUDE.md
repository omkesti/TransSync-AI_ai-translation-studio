# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend
```bash
uvicorn backend.main:app --reload
```
Run from the repo root. The backend starts on `http://127.0.0.1:8000`.

### Frontend (primary: `frontend_proto/`)
```bash
cd frontend_proto
npm install
npm run dev
```
The legacy `frontend/` directory is not maintained and will be discarded.

### Tests
```bash
# From repo root — run all backend tests
pytest backend/tests/

# Run a single test file
pytest backend/tests/test_ooxml_run_injection.py -v
```
Tests use `sys.path.insert` to resolve project-root imports, so they must be run from the repo root.

## Environment Variables

Backend (`.env` at repo root, loaded by `python-dotenv`):
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `GROK_API_KEY`

Frontend (`frontend_proto/.env`):
- `VITE_API_BASE_URL` — e.g. `http://127.0.0.1:8000`

## Architecture

### Data flow (one document)
```
Upload (PDF/DOCX)
  → backend/routes/upload.py          — saves file, extracts raw text via document_parser.py
  → frontend: ValidationPage          — calls POST /api/validate
  → nlp/nlp_pipeline.py               — spaCy + LanguageTool, returns sentences[]
  → frontend: TranslationPage         — calls POST /api/translate
  → ai/rag_pipeline.translate_pipeline() — TM exact → FAISS similarity → LLM fallback
  → frontend: ReviewPage              — human edits, calls POST /api/approve
  → POST /api/export (or /api/export/batch) — returns translated DOCX download
```

### Backend (`backend/`)
- **`main.py`** — FastAPI app; registers all routers under `/api`.
- **`routes/`** — one file per domain: `upload`, `translate`, `validate`, `memory`, `glossary`, `export`, `export_batch`, `auth`.
- **`services/document_parser.py`** — extracts plain text from PDF (PyMuPDF) or DOCX (python-docx); `parse_document()` returns a `str`. Also hosts `inject_translation_into_paragraph(paragraph, text)`, the OOXML run-level helper: sets `runs[0].text` and blanks `runs[1:].text` without removing run nodes, so every `<w:rPr>` formatting node survives. Never use `paragraph.text = ...` (it deletes all runs and their formatting).
- **`services/docx_builder.py`** — two export strategies live here:
  - `build_translated_docx(data)` — **format-preserving** path. Decodes `data.original_docx_b64`, opens the original DOCX, walks every paragraph (body + table cells, nested tables included), and injects translations via `inject_translation_into_paragraph`. Matches by whole-paragraph text first, then falls back to per-sentence fuzzy substitution within the paragraph. Unmatched paragraphs are left untouched.
  - `reconstruct_docx(data)` — **legacy** from-scratch builder (adds attribution footer + horizontal rule). Used for PDF-sourced docs where no original `.docx` exists.
- **`auth/jwt_bearer.py`** — verifies Supabase JWTs (ES256 / JWKS). Resolves `org_id` + `role` from the `memberships` Supabase table on every request. Use `Depends(get_current_user)` in all protected routes.

### DOCX export — two paths (one route, branched by payload)
`POST /api/export` and `POST /api/export/batch` both branch on whether `original_docx_b64` is present in the request body:

| Source | `original_docx_b64` | Strategy |
|--------|---------------------|----------|
| `.docx` | present | `build_translated_docx` — OOXML run-level injection (format-preserving) |
| `.pdf` | absent | `reconstruct_docx` — new DOCX built from translated strings |

The original `.docx` travels as **base64 in the request body** — the backend is stateless and retains no files on disk. The frontend captures the upload as base64 in `UploadPage` (`fileToBase64`), holds it in `AppContext` (runtime-only — stripped before `localStorage` persistence to avoid the ~5MB quota), and sends it back at export time.

> Note: a second, more ambitious "ID-based reconstruction" design is sketched in `test_bug_condition_exploration.py` / `test_upload_backward_compatibility.py` (`parse_document_structured`, `reconstruct_by_id`, per-unit IDs + formatting metadata). It is **not implemented** — those test files error on import by design. The shipped approach is the run-level injection above.

### AI/RAG (`ai/`)
- **`rag_pipeline.py`** — `translate_pipeline(sentences, source_lang, target_lang, glossary_hints)` is the single entry point from the backend. Priority: TM exact match → FAISS vector similarity → LLM guided → LLM cold.
- **`translation_memory.py`** — Supabase-backed TM lookup.
- **`vector_store.py`** — FAISS index operations.
- **`embeddings.py`** — Sentence Transformers for embedding generation.
- **`llm_client.py`** — wraps the Grok LLM API.

### NLP (`nlp/`)
- **`nlp_pipeline.py`** — orchestrates `validator.py` (LanguageTool grammar/spelling) and `sentencizer.py` (spaCy sentence splitting). Called by `POST /api/validate`.

### Frontend (`frontend_proto/src/`)
- **`context/AppContext.jsx`** — global multi-document state. Shape: `documents[]` with per-doc `{ docId, filename, rawText, sentences, results, validationResult, targetLang, status, error }`. Persisted to `localStorage`.
- **`context/AuthContext.jsx`** — Supabase auth session.
- **`services/api.js`** — all backend calls. Auth header injected automatically from Supabase session. 401 responses sign out and redirect to `/login`.
- Pages follow the workflow order: `UploadPage → ValidationPage → ReviewPage → ExportPage`.

### Auth model
- Auth is Supabase (magic link / email+password).
- The `memberships` table is the RBAC source of truth: `{ user_id, org_id, role }`.
- Roles resolved on every API request — no token refresh needed after role changes.
- `require_role(user, "admin", "editor")` helper in `jwt_bearer.py` for route-level RBAC.
