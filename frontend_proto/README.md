# TransSync Frontend Integration Notes

These notes describe how the frontend_proto UI should connect to the backend and how each page behaves. This is the source of truth while we wire the frontend to the FastAPI flow.

## Orchestration Rule

- The frontend orchestrates the pipeline step-by-step, and each backend step must be user-approved.
- The Start Translation button triggers the process, but the user remains in control between parse -> validate -> translate -> review.

## Core Flow

UploadPage -> ValidationPage -> ReviewPage

State handoff:
- UploadPage produces doc_id + raw_text
- ValidationPage produces sentences[] (and validation status/errors)
- ReviewPage uses results[] and lets the user approve or discard

Shared state (Context or Zustand) must persist:
- doc_id
- raw_text
- sentences[]
- results[]
- language selection

## Dashboard Requirements

- Show total documents uploaded
- Show in-progress (processing) documents
- Show completed translations
- Recent documents list with a progress bar per document showing pipeline stage

## Upload Page Requirements

- File upload control
- Language selection
- Start Translation button
- Start Translation must not skip steps; it should trigger parse -> validate -> translate in order, with user approval between stages

## Validation Page Requirements

- Show validation errors sorted by severity
- Validation summary: counts per severity level
- Document health bar showing percentage health score
- Proceed button enabled only when status == ok

## Review Page Requirements

- Show source and translated text side-by-side in batches
- User can approve or discard each batch
- On approval, save each sentence to Supabase
- On discard, skip that batch and move forward
- Show progress bar for how many batches are completed
- Show counts for pending vs reviewed

## Glossary

- Further instructions will be provided later

## Implementation Focus (Phase 1)

- First, connect frontend actions to backend APIs (clicking buttons triggers the correct pipeline step)
- Later, implement all dashboard metrics, counters, and progress bar data
