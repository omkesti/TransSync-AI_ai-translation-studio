# TransSync AI Translation Studio

TransSync AI Translation Studio is a web-based platform designed to modernize enterprise translation workflows by combining Artificial Intelligence (AI), Natural Language Processing (NLP), retrieval-based translation, and human-in-the-loop review in a single system.

The platform helps teams move from raw source documents to high-quality approved translations with better consistency, reuse, and turnaround time.

## Project Highlights

- Upload and process source documents such as PDF and DOCX files
- Extract and segment text into manageable units (for example, sentence-level segments)
- Run source quality validation before translation
- Reuse approved translations through translation memory lookup
- Use Retrieval-Augmented Generation (RAG) with embeddings + vector search for semantic reuse
- Generate new translations via LLM when no strong match exists
- Apply glossary and style guidance to improve consistency
- Provide side-by-side review, editing, and approval workflows
- Continuously improve the system by feeding approved translations back into memory and vector storage

## End-to-End Workflow

1. User uploads a PDF/DOCX document.
2. Backend parses and extracts text while preserving logical structure.
3. Text is segmented into translation units (primarily sentence-level).
4. NLP validation checks source quality:
   - Spelling
   - Grammar
   - Punctuation
   - Terminology and formatting consistency
5. For each segment, the AI layer runs hybrid translation:
   - Check translation memory for exact/high-confidence reuse
   - Run embedding similarity search via vector DB (RAG retrieval)
   - If no suitable match, call LLM to generate translation
   - Apply glossary/style constraints during generation
6. Frontend presents side-by-side source/target for human review.
7. User edits/approves translations and manages glossary terms.
8. Approved outputs are written back to translation memory + vector index for future reuse.

## System Architecture

### Frontend (React)

- Interactive user interface for upload, validation display, translation review, and glossary management
- Side-by-side translation editor for human-in-the-loop quality control
- API integration layer for backend communication

### Backend (FastAPI)

- API entry point and route orchestration
- Document upload and parsing pipeline integration
- Translation and memory endpoints
- Database communication through Supabase client services

### NLP Module

- Source-language quality checks using tools such as spaCy and LanguageTool
- Modular checks for spelling, grammar, and terminology

### AI Module

- Sentence embedding generation using Sentence Transformers
- Vector search and index management via FAISS
- RAG orchestration pipeline
- LLM integration and prompt conditioning
- Translation memory lookup/store logic

### Data Layer (Supabase + Vector Store)

- Supabase stores structured metadata (documents, glossary entries, translation records)
- Vector database/index stores semantic representations for retrieval

## Team and Module Ownership

Project size: 4 members

- Ajinkya: Frontend
- Omkar: Backend
- Devang: NLP
- Om (AI Engineer): AI module (embeddings, FAISS vector store, RAG pipeline, LLM client, translation memory)

## Repository Structure

```text
ai-translation-studio/
|
|-- frontend/                        # Ajinkya
|   |-- src/
|   |   |-- components/
|   |   |   |-- UploadDocument.jsx
|   |   |   |-- ValidationResults.jsx
|   |   |   |-- TranslationEditor.jsx
|   |   |   |-- GlossaryManager.jsx
|   |   |-- pages/
|   |   |-- store/                   # Zustand state
|   |   |-- api/                     # axios calls to backend
|   |-- package.json
|
|-- backend/                         # Omkar
|   |-- main.py                      # FastAPI entry point
|   |-- routes/
|   |   |-- upload.py                # POST /upload-document
|   |   |-- translate.py             # POST /translate
|   |   |-- memory.py                # GET /translation-memory
|   |-- services/
|   |   |-- document_parser.py       # PDF/DOCX extraction
|   |   |-- supabase_client.py       # DB connection
|   |-- requirements.txt
|
|-- nlp/                             # Devang
|   |-- validator.py                 # spaCy + LanguageTool checks
|   |-- checks/
|   |   |-- spelling.py
|   |   |-- grammar.py
|   |   |-- terminology.py
|   |-- requirements.txt
|
|-- ai/                              # Om (AI Engineer)
|   |-- embeddings.py                # Sentence Transformers
|   |-- vector_store.py              # FAISS index management
|   |-- rag_pipeline.py              # Core RAG logic
|   |-- llm_client.py                # LLM API calls + prompts
|   |-- translation_memory.py        # TM lookup and storage
|   |-- requirements.txt
|
|-- frontend_proto/                  # Prebuilt prototype frontend
|                                    # Planned for phased integration
|
|-- README.md
```

## Important Note on `frontend_proto`

This repository contains an extra `frontend_proto` directory that serves as a pre-created/prototype frontend. It is currently kept for reference and incremental integration into the primary `frontend` application.

## Core Technology Stack

- Frontend: React, Vite, Zustand, Axios
- Backend: Python, FastAPI
- NLP: spaCy, LanguageTool
- AI/RAG: Sentence Transformers, FAISS, LLM APIs
- Database: Supabase

## Why This Project Matters

TransSync demonstrates a practical production-style AI architecture that combines:

- LLM generation
- Retrieval and semantic reuse
- Quality validation pipelines
- Glossary/style enforcement
- Human feedback loops

The result is a scalable translation workflow focused on consistency, efficiency, and continuous improvement.
