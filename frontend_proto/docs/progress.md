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

## Next Step

All frontend-backend integration for the core workflow + dashboard + glossary is complete.

Remaining tasks before final demo:
1. Create the `glossary` table in Supabase using the SQL in backend/routes/glossary.py
2. End-to-end integration test: upload a DOCX → validate → translate → approve → confirm Dashboard stats update
3. (Optional) Add authentication / user sessions if required by the project scope
