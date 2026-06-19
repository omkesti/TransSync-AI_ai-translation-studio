# Project Context — TransSync AI

> A living overview of *what* TransSync AI is and *why* it is built the way it is.
> For *how to run it* and module-by-module wiring, see [`CLAUDE.md`](./CLAUDE.md).

## What it is

TransSync AI is an **enterprise AI translation studio**: an organization uploads a document
(PDF or DOCX), the system splits it into sentences, translates each one through a layered
retrieval-augmented pipeline, lets a human reviewer approve or edit every sentence, and exports a
**format-preserving** translated DOCX. Approved translations feed back into a per-organization
Translation Memory so quality compounds over time.

The product target is a "Precision Engine" — a high-end, editorial translation experience rather
than a generic utility. See [`frontend_proto/DESIGN.md`](./frontend_proto/DESIGN.md) for the full
design language (dark "void" theme, `#C6FF00` accent, no-line tonal layering).

## Why the architecture looks like this

### Layered translation (cost ↓, consistency ↑)
Every sentence is resolved through the cheapest sufficient tier before reaching the LLM:

1. **TM exact** — a previously approved, org-scoped translation of the same sentence.
2. **FAISS direct** — a vector-similar prior translation with cosine score ≥ 0.95.
3. **LLM guided** — Gemini, *given the closest FAISS match as a terminology/style reference*.
4. **LLM cold** — Gemini, no reference, for genuinely novel sentences.

Identical sentences are de-duplicated and LLM calls are batched, so a long document with repeated
boilerplate costs a handful of API calls, not one per line.

### Trust boundaries are deliberate
- **Separation of duties in QA.** The model that *produces* a translation never *validates* it.
  Forward translation is Gemini 2.5 Flash; back-translation verification is Groq's Llama 3.3 70B.
  An independent validator can't rubber-stamp its own output. Back-translation is an *informational*
  flag for the reviewer (cosine similarity below `BACK_TRANSLATION_THRESHOLD`), never a hard gate.
- **Resilience over a single provider.** Gemini is primary; a rate-limit circuit breaker trips
  after 3 consecutive 429s and routes straight to Groq for a cooldown, so large documents don't
  stall mid-run.
- **Human-in-the-loop is mandatory.** Only `approved`/`edited` sentences are stored; `rejected`
  ones are dropped. Approval also FAISS-indexes the row *before* the DB write, so the index and the
  TM table can never drift out of sync (a FAISS failure aborts the whole save).

### Format preservation is the hard requirement
For `.docx` sources, translations are injected at the **OOXML run level** so every formatting node
survives — the original file travels as base64 in the request body and the backend stays stateless
(no uploaded files retained on disk). PDF sources, which have no original `.docx`, fall back to a
from-scratch rebuild. See the "DOCX export — two paths" table in `CLAUDE.md`.

### Multi-tenant from the ground up
`memberships` is the single RBAC source of truth, resolved on *every* request from the Supabase JWT
— so a role change takes effect immediately, with no token refresh. Every TM lookup, glossary fetch,
and analytics query is scoped by `org_id`. Onboarding is invitation-only.

## Tech stack

| Layer        | Choice |
|--------------|--------|
| Backend      | FastAPI (Python), run with `uvicorn` |
| Frontend     | React + Vite + Tailwind (`frontend_proto/` — the maintained app) |
| Auth / DB    | Supabase (JWT auth, Postgres, RBAC via `memberships`) |
| Translation  | Gemini 2.5 Flash (primary) + Groq Llama 3.3 70B (fallback & validator) |
| Retrieval    | FAISS vector index + Sentence-Transformers embeddings |
| NLP          | spaCy (sentencization) + LanguageTool (grammar/spell QA) |
| Docs         | PyMuPDF (PDF) + python-docx (DOCX) |

## Repository layout

```
backend/        FastAPI app — routes/, services/, auth/, utils/, tests/
ai/             RAG pipeline, TM, FAISS, embeddings, LLM client, back-translation QA
nlp/            cleaner → sentencizer → validator pipeline
frontend_proto/ React/Vite app (THE maintained frontend)
frontend/       legacy — not maintained, slated for removal
```

## Status & conventions

- **`frontend_proto/` is the app.** The legacy `frontend/` directory is abandoned.
- **Backend is stateless.** Uploaded files are parsed in `/tmp` and immediately deleted; the
  original `.docx` round-trips as base64 through the client for export.
- **`pipeline_events` is best-effort.** It powers Dashboard/Profile analytics but is treated as
  optional — if the table or a column is missing, those views degrade to empty rather than erroring.
- **An unimplemented "ID-based reconstruction" design** is sketched in two test files that error on
  import *by design* (`test_bug_condition_exploration.py`, `test_upload_backward_compatibility.py`).
  The shipped export strategy is run-level injection, not that design.
- Tests run from the repo root: `pytest backend/tests/` (they use `sys.path.insert` for imports).
