# TransSync AI Translation Studio

TransSync AI Translation Studio is a web platform for enterprise translation workflows that combines retrieval-augmented translation, NLP validation, and human review. It supports document upload, quality checks, hybrid translation (TM + RAG + LLM), and approval workflows that feed back into translation memory.

## Features

- Upload PDF and DOCX documents
- Automatic parsing and sentence-level segmentation
- Source validation (spelling, grammar, formatting)
- Hybrid translation: TM reuse + FAISS similarity + LLM fallback
- Side-by-side review and approval workflow
- Translation memory and vector index updates after approval

## Architecture Overview

- **Frontend:** React (Vite) UI for upload, validation, review, and glossary
- **Backend:** FastAPI routes for upload, validation, translation, and approvals
- **NLP:** spaCy + LanguageTool validation pipeline
- **AI/RAG:** Sentence Transformers + FAISS + LLM
- **Data:** Supabase for structured data, FAISS index for semantic retrieval

## Workflow

1. Upload a PDF/DOCX
2. Parse and extract raw text
3. Run validation and produce sentence list
4. Translate sentences via TM/RAG/LLM
5. Review and approve translations
6. Store approved results in Supabase + FAISS

## Repository Layout

```text
ai-translation-studio/
|
|-- frontend_proto/                  # Primary frontend (React + Vite)
|   |-- src/
|   |-- public/
|   |-- docs/
|
|-- frontend/                        # Legacy frontend (not primary)
|
|-- backend/                         # FastAPI backend
|   |-- main.py
|   |-- routes/
|   |-- services/
|
|-- nlp/                             # NLP validation pipeline
|-- ai/                              # Embeddings, FAISS, RAG, LLM
|-- README.md
```

## Team Ownership

- Omkar: Backend
- Devang: NLP
- Om (AI Engineer): Frontend, AI/RAG module

## Local Development

### Backend

```bash
uvicorn backend.main:app --reload
```

### Frontend (primary)

```bash
cd frontend_proto
npm install
npm run dev
```

## Environment Variables

Backend:

- `SUPABASE_URL`
- `SUPABASE_KEY`
- `GROK_API_KEY`

Frontend:

- `VITE_API_BASE_URL` (e.g. `http://127.0.0.1:8000`)

## Notes

- `frontend_proto` is the primary UI source. The `frontend/` directory is legacy and will be discarded later.
