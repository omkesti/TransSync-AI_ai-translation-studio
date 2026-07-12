# TransSync AI — Translation Studio

> An enterprise translation platform that pairs retrieval-augmented AI translation with NLP validation and a human-in-the-loop review workflow.

TransSync AI Translation Studio turns raw PDF/DOCX documents into professionally translated, **format-preserving** deliverables. It combines a translation memory (TM), semantic retrieval (FAISS + Sentence Transformers), and large language models — then routes every machine translation through an independent back-translation quality check and a human review step. Approved translations feed back into the translation memory, so the system gets more accurate and consistent with every document.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Technologies Used](#technologies-used)
- [Installation](#installation)
- [Usage](#usage)
- [Environment Variables](#environment-variables)
- [Running the Tests](#running-the-tests)
- [Future Improvements](#future-improvements)
- [Team](#team)
- [License](#license)

---

## Overview

Most machine translation tools give you a raw string and stop there. TransSync AI is built for real localization teams that need **consistency, quality assurance, and formatting fidelity** across many documents.

The core idea is a tiered translation pipeline. For each sentence, the system tries the cheapest, most trustworthy source first and only escalates when needed:

```
TM exact match  →  FAISS similarity  →  LLM (guided by retrieval)  →  LLM (cold)
```

Every LLM-generated translation is then verified by translating it *back* to the source language with a **different** model and measuring semantic similarity — flagging anything that drifts for human review. Reviewers edit and approve in a side-by-side UI, and approved pairs are re-indexed into both the translation memory and the vector store.

The result is a workflow that stays fast and cheap on repeat content, escalates intelligently on novel content, and never ships an unreviewed machine translation.

---

## Features

- **Document upload & parsing** — PDF (PyMuPDF) and DOCX (python-docx); text is extracted statelessly with nothing persisted to disk during parsing.
- **NLP validation** — automatic cleaning of extraction artifacts, spaCy sentence segmentation, and LanguageTool grammar/spelling checks before translation.
- **Hybrid tiered translation** — translation memory reuse → FAISS semantic retrieval → LLM translation, with identical sentences de-duplicated and batched for efficiency.
- **Independent back-translation QA** — machine translations are verified by a second, independent model and flagged when semantic similarity drops below a configurable threshold.
- **Glossary enforcement** — verified, org- and language-scoped terminology is enforced post-hoc across every translation tier for brand and domain consistency.
- **Human-in-the-loop review** — a side-by-side editor for reviewing, correcting, and approving translations before export.
- **Self-improving translation memory** — approved translations are re-indexed into Supabase TM and FAISS, and exact matches are reused org-wide across projects.
- **Format-preserving DOCX export** — translations are injected at the OOXML run level, preserving original formatting; PDF-sourced docs fall back to a clean reconstructed document.
- **Cross-session durability** — original `.docx` files are stored in private Supabase Storage so format-preserving export survives across sessions and devices.
- **Role-based access control** — invitation-only onboarding with `owner` / `admin` / `translator` / `reviewer` / `viewer` roles, enforced on every API request.
- **Analytics dashboard** — per-sentence pipeline events power Dashboard and Profile insights (translation tiers, throughput, QA flags).
- **Multilingual support** — source language auto-detection and normalized target-language handling across the pipeline.

---

## Architecture

TransSync AI is a three-part system: a React frontend, a FastAPI backend, and dedicated NLP and AI/RAG modules, backed by Supabase and a persisted FAISS index.

### End-to-end data flow (one document)

```
Upload (PDF / DOCX)
  → routes/upload.py            Extract raw text (stateless, no disk persistence)
  → routes/validate.py          NLP: clean → spaCy sentencize → LanguageTool
  → routes/translate.py         Glossary fetch → RAG pipeline → analytics logging
        ├─ TM exact match
        ├─ FAISS similarity (score ≥ 0.95)
        ├─ LLM guided (with retrieval reference)
        └─ LLM cold
        → back-translation QA (independent validator model)
  → ReviewPage                  Human edits / approves
  → routes/approve              FAISS-index → write to Supabase TM
  → routes/export               Format-preserving translated DOCX download
```

### Components

| Layer | Responsibility |
|-------|----------------|
| **Frontend** (`frontend_proto/`) | React + Vite SPA — upload, validation, review, glossary, dashboard, and export flows. Global multi-document state in `AppContext`, Supabase auth in `AuthContext`. |
| **Backend** (`backend/`) | FastAPI app; one router per domain (upload, validate, translate, memory, glossary, export, auth) mounted under `/api`. |
| **NLP** (`nlp/`) | `cleaner` → `sentencizer` (spaCy) → `validator` (LanguageTool) validation pipeline. |
| **AI / RAG** (`ai/`) | Tiered `translate_pipeline`, back-translation QA, embeddings, FAISS vector store, translation-memory lookup, and the LLM client with fallback. |
| **Data** | Supabase (Postgres) for structured data + private Storage bucket for original documents; on-disk FAISS index for semantic retrieval. |

### Translation model stack

- **Primary:** Gemini 2.5 Flash (via Google's OpenAI-compatible endpoint).
- **Fallback:** Groq Llama 3.3 70B — a rate-limit circuit breaker trips after 3 consecutive `429`s and routes to Groq for a 60s cooldown.
- **Back-translation validator:** Groq Llama 3.3 70B, always used independently of the generator (separation of duties — the validator is never the generator).

### DOCX export — two paths

| Source | Original DOCX available | Strategy |
|--------|-------------------------|----------|
| `.docx` | Yes | **Format-preserving** — OOXML run-level injection into the original document |
| `.pdf` | No | **Reconstructed** — a clean new DOCX built from translated strings |

---

## Technologies Used

**Frontend**
- React 19 + Vite
- React Router
- Tailwind CSS
- Motion (animations)
- Supabase JS client
- Lucide (icons)

**Backend**
- Python 3.11
- FastAPI + Uvicorn
- Pydantic
- python-dotenv

**AI / RAG**
- Sentence Transformers (embeddings, L2-normalized for cosine similarity)
- FAISS (`faiss-cpu`) vector search
- PyTorch + Hugging Face Transformers
- Google Gemini 2.5 Flash (primary LLM)
- Groq Llama 3.3 70B (fallback + back-translation validator)

**NLP**
- spaCy (sentence segmentation)
- LanguageTool (grammar / spelling validation)

**Document processing**
- PyMuPDF (PDF parsing)
- python-docx (DOCX parsing & OOXML injection)
- langdetect (source-language detection)

**Data & Auth**
- Supabase (Postgres, Auth, Storage)
- JWT verification via Supabase JWKS (ES256 / P-256)

---

## Installation

### Prerequisites

- Python **3.11**
- Node.js **18+** and npm
- A Supabase project (URL + service-role key)
- API keys: Google Gemini (required) and Groq (optional — enables fallback + back-translation QA)

### 1. Clone the repository

```bash
git clone <repository-url>
cd TransSync-AI_ai-translation-studio
```

### 2. Backend setup

Install PyTorch first (CPU build), then the backend requirements — install order matters:

```bash
# From the repo root
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

pip install torch==2.5.1 --index-url https://download.pytorch.org/whl/cpu
pip install -r backend/requirements.txt

# Download the spaCy English model used by the NLP pipeline
python -m spacy download en_core_web_sm
```

Create a `.env` file at the repo root (see [Environment Variables](#environment-variables)).

### 3. Frontend setup

```bash
cd frontend_proto
npm install
```

Create `frontend_proto/.env` with your `VITE_API_BASE_URL`.

### 4. Database

Apply the SQL migrations in `backend/migrations/` (`001`–`004`) to your Supabase project, and create a private Storage bucket named `document-originals`.

---

## Usage

### Run the backend

```bash
# From the repo root
uvicorn backend.main:app --reload
```

The API starts on `http://127.0.0.1:8000` (interactive docs at `/docs`).

### Run the frontend

```bash
cd frontend_proto
npm run dev
```

The dev server prints a local URL (Vite default `http://localhost:5173`).

### Typical workflow

1. **Sign in** — onboarding is invitation-only; an `owner`/`admin` invites you via email.
2. **Upload** a PDF or DOCX on the Upload page.
3. **Validate** — the document is cleaned, segmented into sentences, and grammar-checked.
4. **Translate** — pick a target language; the tiered pipeline translates each sentence and flags low-confidence results.
5. **Review** — edit and approve translations in the side-by-side editor.
6. **Export** — download the translated DOCX (format-preserving when the source was `.docx`).

### API quick reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/upload-document` | Parse a PDF/DOCX into raw text |
| `POST` | `/api/validate` | Clean + sentence-split source text |
| `POST` | `/api/translate` | Run the tiered translation pipeline |
| `POST` | `/api/approve` | Index + store approved translations |
| `POST` | `/api/export` | Download a translated DOCX |
| `GET`  | `/api/glossary` | Manage glossary terms (writes require `owner`/`admin`) |
| `GET`  | `/api/dashboard-stats` | Analytics for the dashboard |

---

## Environment Variables

### Backend (`.env` at repo root)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_KEY` | Yes | Service-role key (bypasses RLS for JWKS-verified requests) |
| `GEMINI_API_KEY` | Yes | Primary translation model (Gemini 2.5 Flash) |
| `GROQ_API_KEY` | Optional | Fallback model + back-translation validator; if unset, both are skipped |
| `BACK_TRANSLATION_THRESHOLD` | Optional | Cosine-similarity floor for QA flagging (default `0.85`) |
| `LLM_BATCH_CHUNK_SIZE` | Optional | Max items per batched LLM request (default `25`) |

### Frontend (`frontend_proto/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_BASE_URL` | Yes | Backend base URL, e.g. `http://127.0.0.1:8000` |

---

## Running the Tests

```bash
# From the repo root — run all backend tests
pytest backend/tests/

# Run a single test file
pytest backend/tests/test_ooxml_run_injection.py -v
```

Tests resolve project-root imports via `sys.path.insert`, so they must be run from the repo root.

---

## Future Improvements

- **ID-based document reconstruction** — a per-unit ID + formatting-metadata reconstruction design (sketched in the test suite) to make format preservation even more robust across complex layouts.
- **Broader file-format support** — PPTX, XLSX, subtitle formats (SRT/VTT), and Markdown.
- **GPU-accelerated embeddings** — optional CUDA build path for faster indexing on large corpora.
- **Expanded language coverage** — additional spaCy models and language-specific validation rules.
- **Real-time collaborative review** — multiple reviewers on a single document with live presence.
- **Retire the legacy frontend** — remove the unmaintained `frontend/` directory in favor of `frontend_proto/`.
- **CI/CD** — automated linting, tests, and deployment pipelines.
- **Term-suggestion automation** — auto-propose glossary candidates from approved translation memory.

---

## Team

| Member | Area |
|--------|------|
| Omkar | Backend |
| Devang | NLP |
| Om | Frontend & AI/RAG |

---

## License

This project was developed as an academic project for the Advanced Software Engineering course. No formal open-source license has been applied yet — please contact the maintainers before reuse or distribution.
