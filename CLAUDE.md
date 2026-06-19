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
- `SUPABASE_KEY` — service-role key (bypasses RLS; used for JWKS-verified requests).
- `GEMINI_API_KEY` — primary translation model (Gemini 2.5 Flash, via Google's OpenAI-compatible API).
- `GROQ_API_KEY` — fallback model **and** the independent back-translation validator (Llama 3.3 70B). Optional: if unset, the fallback and back-translation QA are silently skipped.
- `BACK_TRANSLATION_THRESHOLD` (optional, default `0.85`) — cosine-similarity floor below which a sentence is flagged for review.
- `LLM_BATCH_CHUNK_SIZE` (optional, default `25`) — max items per batched LLM request.

Frontend (`frontend_proto/.env`):
- `VITE_API_BASE_URL` — e.g. `http://127.0.0.1:8000`

## Architecture

### Data flow (one document)
```
Upload (PDF/DOCX)
  → backend/routes/upload.py          — extracts raw text via document_parser.py (stateless, no disk persistence)
  → frontend: ValidationPage          — calls POST /api/validate
  → nlp/nlp_pipeline.py               — cleaner → spaCy sentencizer → LanguageTool, returns sentences[]
  → frontend: ReviewPage (translate)  — calls POST /api/translate
  → ai/rag_pipeline.translate_pipeline() — TM exact → FAISS similarity → LLM guided/cold → back-translation QA
  → frontend: ReviewPage              — human edits/approves, calls POST /api/approve
  → POST /api/approve                 — FAISS-indexes approved rows, then writes to Supabase TM
  → POST /api/export (or /api/export/batch) — returns translated DOCX download
```
`POST /api/translate` also fetches **verified** glossary terms for the org+target language and records each
processed sentence in `pipeline_events` (best-effort analytics that power the Dashboard/Profile pages).

### Backend (`backend/`)
- **`main.py`** — FastAPI app; registers all routers under `/api` (CORS open to all origins).
- **`routes/`** — one file per domain:
  - `upload` — `POST /api/upload-document`: parse PDF/DOCX → raw text (temp file is deleted after extraction; nothing persists server-side).
  - `validate` — `POST /api/validate`: NLP clean + sentencize.
  - `translate` — `POST /api/translate`: glossary fetch → `translate_pipeline` → `pipeline_events` logging.
  - `memory` — `POST /api/approve` (FAISS-index + store), `GET /api/translation-memory`, `GET /api/dashboard-stats`.
  - `glossary` — `GET/POST/PATCH/DELETE /api/glossary` (write ops require `owner`/`admin`).
  - `export` / `export_batch` — `POST /api/export`, `POST /api/export/batch`: translated DOCX download.
  - `auth` — invite flow (`/api/auth/invite`, `/api/auth/accept-invite`), `/api/auth/me`, `/api/auth/profile`, `/api/auth/my-documents`.
- **`utils/language_codes.py`** — `normalize_lang_code()`; every route normalizes `target_lang` before it reaches the pipeline or TM (a blank/invalid code is rejected, never stored).
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
- **`rag_pipeline.py`** — `translate_pipeline(obj: dict)` is the single entry point from the backend. `obj` carries `{sentences, source_lang, target_lang, org_id, glossary_hints}`; returns a list of `{source, translation, match_type, score, back_translation_score, back_translation_failed}`. Priority per sentence: TM exact → FAISS direct (score ≥ 0.95) → LLM guided (with FAISS reference) → LLM cold. TM/FAISS run per-sentence; LLM calls are **batched and de-duplicated** (identical sentences translated once, fanned back out by index). Glossary terms are enforced post-hoc on every tier via `_apply_glossary_posthoc`.
- **`back_translation.py`** — QA annotation layer (`verify_back_translations`). Runs **only** on `llm_guided`/`llm_cold` tiers: translates the result back to the source language with the **independent** validator model, embeds both, and flags the sentence when cosine similarity falls below `BACK_TRANSLATION_THRESHOLD`. Best-effort and never blocks — failures leave a sentence un-annotated.
- **`tm_indexing.py`** — `index_approved_rows()`: approve-time FAISS indexing. Called by `POST /api/approve` **before** the Supabase insert so every new LLM-translated row gets a `faiss_index`; rows that already have one are passed through. A FAISS write failure aborts the Supabase write (no orphan rows).
- **`translation_memory.py`** — Supabase-backed TM lookup (org-scoped, language-aware; exact + batch).
- **`vector_store.py`** — FAISS index operations (search + incremental add, persisted to disk).
- **`embeddings.py`** — Sentence Transformers; L2-normalised vectors (dot product = cosine similarity).
- **`llm_client.py`** — **Gemini 2.5 Flash** (primary, via Google's OpenAI-compatible endpoint) with a **Groq Llama 3.3 70B** fallback. A rate-limit **circuit breaker** trips after 3 consecutive Gemini 429s and routes straight to Groq for a 60s cooldown. `back_translate` / `back_translate_batch` always use Groq directly (separation of duties — the validator is never the generator).

### NLP (`nlp/`)
- **`nlp_pipeline.py`** — `validate_and_split(raw_text)`: orchestrates `cleaner.py` → `sentencizer.py` → `validator.py`. Called by `POST /api/validate`.
- **`cleaner.py`** — conservative PDF/DOCX artifact removal; preserves hard paragraph/cell boundaries (blank-line splits) so sentences never span paragraphs and stay reconstructable at export.
- **`sentencizer.py`** — spaCy sentence splitting. **`validator.py`** — LanguageTool grammar/spelling check.

### Frontend (`frontend_proto/src/`)
- **`context/AppContext.jsx`** — global multi-document state. Shape: `documents[]` with per-doc `{ docId, filename, rawText, sentences, results, validationResult, targetLang, status, error }`. Persisted to `localStorage`.
- **`context/AuthContext.jsx`** — Supabase auth session.
- **`services/api.js`** — all backend calls. Auth header injected automatically from the Supabase session. 401 responses sign out and redirect to `/login`.
- **`components/ProtectedRoute.jsx`** — gate for authenticated routes; `Avatar` / `NavAvatar` / `UserProfileBlock` render the signed-in user.
- Routes (`App.jsx`):
  - Public: `/` (LandingPage), `/login` (LoginPage), `/invite/:token` (InviteAcceptPage).
  - Protected: `/dashboard`, `/upload`, `/validation`, `/review`, `/glossary`, `/export`, `/profile`.
  - Core document workflow: `UploadPage → ValidationPage → ReviewPage → ExportPage`.

### Auth model
- Auth is Supabase (magic link / email+password); onboarding is **invitation-only** (`invitations` table + `/api/auth/invite`).
- The `memberships` table is the RBAC source of truth: `{ user_id, org_id, role, display_name }`.
- Roles: `owner`, `admin`, `translator`, `reviewer`, `viewer`. Resolved on every API request from `memberships` (service-role client, bypasses RLS) — no token refresh needed after role changes.
- `require_role(user, *allowed_roles)` helper in `jwt_bearer.py` (raises 403). Glossary writes and invites require `owner`/`admin`.
- JWTs verified via Supabase JWKS (ES256 / P-256), cached in module memory with a rotate-and-retry on `kid` miss.

### Supabase tables
`memberships` (RBAC), `organizations`, `invitations` (onboarding), `translation_memory` (approved TM, carries `faiss_index`), `glossary` (`PENDING`/`VERIFIED` terms), `pipeline_events` (per-sentence analytics for Dashboard/Profile — treated as optional; absence degrades gracefully).
