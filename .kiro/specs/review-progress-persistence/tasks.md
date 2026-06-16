# Implementation Tasks

## Tasks

- [x] 1. Add `reviewOffsets` and `reviewedCount` fields to each document in AppContext
  - In `AppProvider`, add `reviewOffsets` and `reviewedCount` to the default document shape inside `addDocuments()`
  - `reviewOffsets` defaults to `{ llm_cold: 0, llm_guided: 0, faiss_direct: 0, tm_exact: 0 }`
  - `reviewedCount` defaults to `0`
  - **File**: `frontend_proto/src/context/AppContext.jsx`

- [x] 2. Persist review progress to AppContext on every approve/discard action
  - In `ReviewPage.jsx`, after updating local `offsets` and `reviewedCount` state in `handleApproveBatch` and `handleDiscardBatch`, also call `updateDoc(docId, { reviewOffsets: newOffsets, reviewedCount: newCount })` to mirror the values into the active document's context entry
  - **File**: `frontend_proto/src/pages/ReviewPage.jsx`

- [x] 3. Restore review progress from AppContext when switching document tabs
  - In the multi-doc tab `onClick` handler in `ReviewPage.jsx`, replace the hard-coded reset of `offsets` and `reviewedCount` with values read from the target document's `reviewOffsets` and `reviewedCount` fields in `documents[i]`
  - Fall back to zero defaults if those fields are absent
  - **File**: `frontend_proto/src/pages/ReviewPage.jsx`

- [x] 4. Reset stored review progress when a new translation is started
  - In `handleStartTranslation`, when calling `updateDoc` for each translated document, include `reviewOffsets: { llm_cold: 0, llm_guided: 0, faiss_direct: 0, tm_exact: 0 }` and `reviewedCount: 0` in the patch so stale progress is cleared alongside new results
  - **File**: `frontend_proto/src/pages/ReviewPage.jsx`
