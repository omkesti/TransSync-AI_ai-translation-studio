# Bugfix Requirements Document

## Introduction

In multi-document review mode, switching between document tabs in `ReviewPage` destroys the user's review progress for the previously active document. The local React state variables `offsets` (tracking how many items have been approved or discarded per match type) and `reviewedCount` (tracking total reviewed sentences) are both explicitly reset to zero inside the tab `onClick` handler. Because this state is never stored per document, returning to a previously-visited tab always presents a clean slate, making batches the user already approved or discarded appear as if they were never actioned. The fix is to persist `offsets` and `reviewedCount` inside each document's entry in `AppContext` so that switching tabs saves and restores progress correctly.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the user is in multi-document mode AND has approved or discarded one or more batches for the active document AND then clicks a different document tab THEN the system resets `offsets` to `{ llm_cold: 0, llm_guided: 0, faiss_direct: 0, tm_exact: 0 }` for the newly active document, discarding any previously saved progress.

1.2 WHEN the user is in multi-document mode AND has reviewed one or more sentences for the active document AND then clicks a different document tab THEN the system resets `reviewedCount` to 0 for the newly active document, making the progress bar and reviewed-sentence count appear as if no review has occurred.

1.3 WHEN the user is in multi-document mode AND switches back to a document they had previously partially reviewed THEN the system displays that document's review UI from the beginning (batch 1) instead of from where the user left off, causing already-approved or discarded batches to appear undone visually.

### Expected Behavior (Correct)

2.1 WHEN the user is in multi-document mode AND has approved or discarded batches for a document AND then switches to a different tab THEN the system SHALL persist the current `offsets` for the departing document before activating the new one.

2.2 WHEN the user is in multi-document mode AND switches to a document tab THEN the system SHALL restore `offsets` from that document's saved state in `AppContext` (defaulting to `{ llm_cold: 0, llm_guided: 0, faiss_direct: 0, tm_exact: 0 }` if no progress exists yet).

2.3 WHEN the user is in multi-document mode AND switches to a document tab THEN the system SHALL restore `reviewedCount` from that document's saved state in `AppContext` (defaulting to 0 if no progress exists yet).

2.4 WHEN the user approves or discards a batch THEN the system SHALL update both the local `offsets` / `reviewedCount` state AND the corresponding document's entry in `AppContext` so that progress survives any subsequent tab switch.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the application is in single-document mode (only one document loaded) THEN the system SHALL CONTINUE TO manage `offsets` and `reviewedCount` as local state with no change to behaviour.

3.2 WHEN a fresh translation is started (the "Start Translation" button is clicked) THEN the system SHALL CONTINUE TO reset `offsets` to `{ llm_cold: 0, llm_guided: 0, faiss_direct: 0, tm_exact: 0 }` and `reviewedCount` to 0 for all translated documents, clearing any stale progress.

3.3 WHEN the user approves a batch in multi-document mode THEN the system SHALL CONTINUE TO call the `approveTranslations` API and update `results` in `AppContext` exactly as before.

3.4 WHEN the user discards a batch in multi-document mode THEN the system SHALL CONTINUE TO advance the offset for that match type without making any API call, exactly as before.

3.5 WHEN a document tab is active and the user completes review of all match-type sections THEN the system SHALL CONTINUE TO display the "All Sections Reviewed" completion state for that document.
