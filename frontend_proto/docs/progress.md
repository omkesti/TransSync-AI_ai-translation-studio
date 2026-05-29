# Frontend-Backend Integration Progress

## Summary

We have established the foundation for frontend-backend integration in frontend_proto, focusing on the upload step and shared state management. This sets up the first user-approved step in the upload -> validate -> translate flow.

## Completed

- API client created with standardized fetch handling and error normalization:
  - uploadDocument(file)
  - validateText(rawText, docId)
  - translateSentences(sentences, sourceLang, targetLang)
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
  - Loading overlay + basic error message
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
  - Renders source/translation with match_type badge
  - File: [frontend_proto/src/pages/ReviewPage.jsx](../src/pages/ReviewPage.jsx)

## Not Started Yet

- ReviewPage: approve to Supabase
- Dashboard: live counts, recent docs, progress bars
- Glossary: pending requirements

## Next Step

Wire ReviewPage approve flow to:
- POST approved sentences to /api/approve
- track reviewed vs pending counts
- advance batches after approve/discard
