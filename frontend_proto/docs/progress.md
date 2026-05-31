# Frontend-Backend Integration Progress

## Summary

We have established the foundation for frontend-backend integration in frontend_proto, focusing on the upload step and shared state management. This sets up the first user-approved step in the upload -> validate -> translate flow. The Dashboard and Glossary pages are now fully wired to live backend data.

## Completed

- API client created with standardized fetch handling and error normalization:
  - uploadDocument(file)
  - validateText(rawText, docId)
  - translateSentences(sentences, sourceLang, targetLang)
  - approveTranslations(reviewed)
  - fetchDashboardStats()
  - fetchGlossary({ targetLang, search })
  - addGlossaryTerm(term)
  - updateGlossaryTerm(id, patch)
  - deleteGlossaryTerm(id)
  - Upload timeout safeguard (60s) for long-running uploads
  - File: [frontend_proto/src/services/api.js](../src/services/api.js)

- Shared app state added using context for cross-page workflow data:
  - docId, rawText, sentences, results, sourceLang, targetLang
  - resetFlow helper
  - File: [frontend_proto/src/context/AppContext.jsx](../src/context/AppContext.jsx)

- App wrapped with AppProvider so all routes can access shared state:
  - File: [frontend_proto/src/main.jsx](../src/main.jsx)

- UploadPage wired to backend upload flow:
  - File input (click or drag/drop)
  - Start Translation triggers uploadDocument
  - On success: docId + rawText stored in context, route to /validation
  - Target language stored in context
  - Loading overlay + basic error message (button now surfaces missing file/lang errors)
  - Upload timeout now surfaces a clear error if backend stalls
  - File: [frontend_proto/src/pages/UploadPage.jsx](../src/pages/UploadPage.jsx)

- ValidationPage wired to backend validation flow:
  - Reads docId + rawText from context
  - Calls validateText on page load
  - Stores sentences in context
  - Displays validation errors and disables Proceed when status != ok
  - File: [frontend_proto/src/pages/ValidationPage.jsx](../src/pages/ValidationPage.jsx)

- ReviewPage wired to backend translation flow:
  - Reads sentences + language from context
  - Calls translateSentences on page load
  - Stores results in context
  - Renders results as a single batch container with match_type badges per sentence
  - File: [frontend_proto/src/pages/ReviewPage.jsx](../src/pages/ReviewPage.jsx)

- ReviewPage approve flow wired:
  - Batches results and tracks reviewed/pending counts
  - Displays one batch (multiple sentences) at a time
  - Discard advances batch without saving
  - Approve posts to /api/approve
  - Progress bar reflects reviewed percentage
  - File: [frontend_proto/src/pages/ReviewPage.jsx](../src/pages/ReviewPage.jsx)
  - File: [frontend_proto/src/services/api.js](../src/services/api.js)

- Dashboard wired to live backend data:
  - New GET /api/dashboard-stats backend route (backend/routes/memory.py)
  - Aggregates translation_memory rows: total count, match_type breakdown, unique languages, last-5 recent records
  - DashboardPage fetches on mount with loading skeleton + error + retry
  - Stat cards: Total Translations, Memory Hits (tm_exact + faiss_direct), LLM Calls (llm_guided + llm_cold)
  - "Pipeline Breakdown" section replaces decorative chart with live animated progress bars per tier
  - "Recent Translations" cards show last 3 real records with match_type badges and time-ago
  - Recent Activity table shows last 5 records (source, translation, lang, tier, time)
  - Active languages list rendered dynamically in sidebar
  - Manual refresh button in top nav
  - File: [frontend_proto/src/pages/DashboardPage.jsx](../src/pages/DashboardPage.jsx)
  - File: [backend/routes/memory.py](../../backend/routes/memory.py)

- Glossary fully wired to backend:
  - New Supabase table schema defined (glossary: id, source_term, target_term, source_lang, target_lang, category, status, created_at)
  - SQL creation comment embedded in backend/routes/glossary.py for easy setup
  - New glossary CRUD helpers in backend/services/supabase_client.py: fetch_all_glossary, insert_glossary_term, update_glossary_term, delete_glossary_term
  - New backend/routes/glossary.py: GET /api/glossary (with ?target_lang and ?search filters), POST /api/glossary, PATCH /api/glossary/{id}, DELETE /api/glossary/{id}
  - Glossary router registered in backend/main.py
  - GlossaryPage fetches live terms on mount with skeleton loading + empty state
  - "Add New Term" button opens a modal form (source, translation, target lang, category) → POST /api/glossary
  - Each row: click status badge to toggle PENDING ↔ VERIFIED → PATCH /api/glossary/{id}
  - Hover-reveal delete button per row → DELETE /api/glossary/{id}
  - Search input with 400ms debounce wired to API ?search= param + clear button
  - Sidebar stats: Verified Terms, Pending Review, Total Terms, Verify Rate — all computed from live data
  - Pagination: 8 items per page, client-side
  - Files: [frontend_proto/src/pages/GlossaryPage.jsx](../src/pages/GlossaryPage.jsx)
  - Files: [backend/routes/glossary.py](../../backend/routes/glossary.py)
  - Files: [backend/services/supabase_client.py](../../backend/services/supabase_client.py)
  - Files: [backend/main.py](../../backend/main.py)

## Not Started Yet

- ~~Dashboard: live counts, recent docs, progress bars~~ ✅ Done
- ~~Glossary: pending requirements~~ ✅ Done

- UX Flow Fixes and Live Validation UI:
  - **Duplicate insertion bug fixed** — `ReviewPage` now filters `tm_exact` and `faiss_direct` results out of the approve payload. Only `llm_guided` and `llm_cold` translations are sent to `POST /api/approve` (already-stored matches are skipped silently). Each batch header shows how many TM-hit rows were skipped.
  - **Auto-fire UX fixed (ValidationPage)** — Removed `useEffect` that auto-called `POST /api/validate` on mount. Page now shows an idle state with a prominent "Start Validation" button. Validation only fires on explicit user click.
  - **Auto-fire UX fixed (ReviewPage)** — Removed `useEffect` that auto-called `POST /api/translate` on mount. Page now shows an idle state with a "Start Translation" CTA. Translation only fires on explicit user click. If results exist in context (back-navigation), skips idle directly to done.
  - **Live Validation UI** — ValidationPage is fully data-driven from the API response:
    - `idle` → hero CTA card ("Start Validation") or "Go to Upload" if no doc loaded
    - `running` → spinner card with animated dots
    - `done (ok)` → SuccessBanner with real sentence count
    - `done (error)` → one `ErrorCard` per entry in `errors[]` array, auto-classified as High/Medium/Low by keyword scanning
    - Health score bar in header: `100 - highCount*20 - mediumCount*8`, color-coded green/yellow/red
    - Readability Index: proxy metric derived from sentence count
    - Sidebar summary: live counts for Critical Issues, Warnings, Info Notices, Sentences Extracted — all from real API response
    - "Proceed to Review" button only navigates — does NOT call any API
  - Files: [frontend_proto/src/pages/ReviewPage.jsx](../src/pages/ReviewPage.jsx), [frontend_proto/src/pages/ValidationPage.jsx](../src/pages/ValidationPage.jsx)

- Document Export & Download:
  - `pip install python-docx` (python-docx 1.2.0 + lxml 6.1.1)
  - New `POST /api/export` backend route (`backend/routes/export.py`):
    - Accepts `{ doc_id, filename, source_lang, target_lang, translations[] }` from frontend
    - Builds an in-memory DOCX via `python-docx`: title page (branding, filename, language pair, date, stats) + page break + translated paragraphs + appendix table (source | translation | match type)
    - Streams DOCX back as `Content-Disposition: attachment` file download
    - Output filename: `translated_<base>_<lang>.docx`
  - Registered in `backend/main.py`
  - `exportDocument()` added to `frontend_proto/src/services/api.js`: POST to `/api/export`, receives blob, creates object URL, triggers browser download dialog
  - `filename` state added to `AppContext` and reset in `resetFlow()`; `UploadPage` stores original filename after upload
  - `ReviewPage` completion state now shows "Download Translated Document →" button (lime CTA) navigating to `/export` alongside "Back to Dashboard"
  - New page `frontend_proto/src/pages/ExportPage.jsx` at route `/export`:
    - 4 stat cards: Total Sentences, TM Hits (with % reuse), LLM Translations, Language Pair
    - Download card: file info, filename, Download DOCX button (idle/exporting/done/error states)
    - Pipeline breakdown bars: TM Exact, FAISS Direct, LLM Guided, LLM Cold — live from results
    - Paginated translation preview table: source | translation | match badge (10 per page)
    - "New Translation" button resets context and navigates to `/upload`
    - Empty state: shown when no results in context, with prompt to start a translation
  - Route `/export` registered in `frontend_proto/src/App.jsx`
  - "Export" nav item (Download icon) added to all 6 sidebars: Dashboard, Upload, Validation, Review, Glossary, ExportPage (active state on ExportPage)
  - Files: [ExportPage.jsx](../src/pages/ExportPage.jsx), [backend/routes/export.py](../../backend/routes/export.py), [api.js](../src/services/api.js), [AppContext.jsx](../src/context/AppContext.jsx)

## Next Step

Remaining tasks before final demo:
1. Create the `glossary` table in Supabase using the SQL in `backend/routes/glossary.py`
2. End-to-end integration test: upload → validate → translate → approve → download DOCX → verify file
3. (Optional) Add authentication / user sessions if required by the project scope
