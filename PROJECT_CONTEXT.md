# TransSync‑AI — Project Context (for presentation generation)

> A single source of truth describing the project. Hand this to a slide‑generation
> assistant to produce a deck. Each section maps cleanly to one or more slides.

---

## 1. One‑line pitch
**TransSync‑AI is an AI‑powered translation studio that translates whole documents (PDF/DOCX) while preserving their original formatting, learns from every human‑approved translation, and keeps a human in the loop for quality.**

## 2. The problem it solves
Professional document translation today forces an ugly trade‑off:

- **Generic machine translation (Google Translate, DeepL):** fast and cheap, but
  it ignores your organisation's terminology, forgets every translation the
  moment it's done, destroys document formatting on export, and gives you no way
  to review/correct before shipping.
- **Human translation agencies:** accurate and context‑aware, but slow,
  expensive, and inconsistent across translators and over time.
- **Raw LLM translation:** capable, but unguided — it hallucinates terminology,
  has no memory of prior decisions, no glossary enforcement, and no quality gate.

Specific pain points TransSync‑AI targets:
1. **No institutional memory** — the same sentence gets re‑translated (and paid
   for) again and again, often differently each time.
2. **Terminology drift** — "neural interface" becomes three different things
   across one document.
3. **Formatting loss** — translating a DOCX usually means rebuilding it by hand;
   tables, styles, headings and inline formatting are destroyed.
4. **No quality signal** — you can't tell which sentences the AI was unsure about.
5. **No governance** — no roles, no org boundaries, no audit of what was approved.

## 3. Who it's for
Organisations that translate documents repeatedly and care about consistency and
formatting: legal teams, technical‑documentation teams, localisation departments,
compliance, and multi‑office enterprises. Multi‑tenant by design (per‑organisation
isolation via RBAC).

---

## 4. The core idea (what makes it work)
TransSync‑AI treats translation as a **retrieval‑augmented, memory‑building,
human‑supervised** process rather than a one‑shot API call. Three pillars:

1. **Translation Memory (TM) that grows** — every translation a human approves is
   stored and reused. The system gets cheaper and more consistent the more you
   use it.
2. **A 4‑tier translation cascade** — each sentence is resolved by the cheapest,
   most‑trusted method that applies (exact memory → semantic similarity →
   guided LLM → cold LLM), instead of sending everything to an LLM.
3. **Quality built in, not bolted on** — glossary enforcement on every tier,
   plus independent back‑translation verification that flags low‑confidence
   sentences for the human reviewer.

---

## 5. The translation pipeline (the heart of the system)

For every sentence, in priority order:

| Tier | Method | When it fires | Trust |
|------|--------|---------------|-------|
| **1. TM Exact** | Exact lookup in the org's Translation Memory (Supabase) | This exact sentence was translated & approved before | Highest — human‑approved |
| **2. FAISS Direct** | Vector similarity search; reuse if ≥ 0.95 similar | A near‑identical sentence exists | High |
| **3. LLM Guided** | LLM translates *with* the closest TM match as a style/terminology reference | A moderately similar sentence exists | Medium |
| **4. LLM Cold** | LLM translates from scratch | Nothing similar exists | Baseline |

**Supporting mechanisms:**
- **Semantic search:** sentences are embedded with `all‑MiniLM‑L6‑v2`
  (384‑dimensional vectors) and indexed in **FAISS** for fast nearest‑neighbour
  lookup. Vectors are language‑agnostic source embeddings; the target language &
  organisation are resolved separately so a German vector can never return a
  French translation or another tenant's data.
- **Glossary enforcement:** verified terminology is injected into the LLM prompt
  *and* re‑applied as a guaranteed post‑processing pass on **every** tier — so
  approved terms are enforced even on memory hits.
- **Back‑translation QA:** for LLM tiers, an *independent* model (Groq Llama 3.3
  70B) translates the result back to the source language; cosine similarity below
  a threshold (default 0.85) flags the sentence for reviewer attention. This is
  an annotation, never a blocker — separation of duties means the model that
  *checks* is never the model that *produced* the translation.

**Human‑in‑the‑loop:** translated sentences go to a Review page where editors
correct them. Approved translations feed back into the Translation Memory, so the
system continuously improves.

---

## 6. Format‑preserving export (a key differentiator)
Most tools rebuild a translated document from scratch and lose everything.
TransSync‑AI has **two export strategies**, chosen automatically by source type:

- **DOCX source → OOXML run‑level injection.** The original `.docx` is reopened
  and translations are injected directly into existing text runs. Tables (incl.
  nested), images, styles, headers/footers, and inline formatting all survive
  untouched. Paragraphs with no match are left exactly as they were.
- **PDF source → clean reconstruction.** A new, tidy DOCX is built from the
  translated text (with an attribution footer), since no original `.docx` exists.

The backend is **stateless** — the original document travels as base64 in the
request and is never persisted on disk, simplifying privacy and scaling.

---

## 7. The document journey (end‑to‑end workflow)
```
Upload (PDF/DOCX)
  → Text extraction (PyMuPDF / python‑docx) + conservative cleanup
  → Validation: spaCy sentence splitting + LanguageTool grammar/spell check
  → Translation: 4‑tier RAG cascade (TM → FAISS → LLM guided → LLM cold)
  → Review: human edits, low‑confidence sentences flagged
  → Approve: approved pairs written back to Translation Memory + FAISS index
  → Export: format‑preserving DOCX (or batch ZIP for multiple docs)
```
The frontend supports **multi‑document** workflows — many files in flight at once,
each with its own state.

---

## 8. Technical architecture

**Frontend** (`frontend_proto/`)
- React + Vite single‑page app.
- Global multi‑document state in `AppContext`; auth session in `AuthContext`.
- Pages follow the workflow: Landing → Login → Dashboard → Upload → Validation →
  Review → Export, plus Glossary management and team Invite/Accept.
- All backend calls centralised in `services/api.js`; auth header injected
  automatically; 401 signs the user out.

**Backend** (`backend/`, FastAPI)
- One router per domain: `upload`, `validate`, `translate`, `memory`, `glossary`,
  `export`, `export_batch`, `auth`. All mounted under `/api`.
- `services/document_parser.py` — text extraction + the OOXML run‑level injection
  helper that preserves formatting.
- `services/docx_builder.py` — the two export strategies.
- `auth/jwt_bearer.py` — verifies Supabase JWTs (ES256/JWKS), resolves role + org
  on every request.

**AI / RAG layer** (`ai/`)
- `rag_pipeline.py` — the 4‑tier cascade orchestrator (single entry point).
- `translation_memory.py` — Supabase‑backed TM lookups.
- `vector_store.py` — FAISS index operations.
- `embeddings.py` — Sentence‑Transformers embedding generation.
- `llm_client.py` — Gemini (primary) with Groq Llama fallback.
- `back_translation.py` — independent back‑translation QA layer.

**NLP layer** (`nlp/`)
- `cleaner.py` — conservative cleanup (de‑hyphenation, page‑number/caption/noise
  removal, paragraph‑boundary preservation so sentences never cross cells).
- `sentencizer.py` — spaCy sentence segmentation.
- `validator.py` — LanguageTool grammar/spelling checks.

**Data & infra**
- **Supabase** (Postgres) — Translation Memory, glossary, auth, memberships.
- **FAISS** — on‑disk vector index for semantic similarity.
- **LLMs** — Google Gemini 2.5 Flash (primary), Groq Llama 3.3 70B (fallback &
  independent verifier).

---

## 9. Multi‑tenancy, security & governance
- **Supabase auth** (magic link / email+password).
- **RBAC** via a `memberships` table (`user_id`, `org_id`, `role`) — the source
  of truth, resolved on **every** request, so role changes take effect instantly
  with no token refresh.
- **Tenant isolation:** every TM and FAISS lookup is scoped by `org_id`, so one
  organisation can never see another's translations.
- **Team management:** invite/accept flow for adding members.

---

## 10. Engineering quality & performance optimizations
The system is built for correctness first, then optimized without changing output:

- **Batched embeddings** — all sentences embedded in one vectorized model call
  instead of one call each.
- **Batched FAISS resolution** — one search + one database round‑trip resolves all
  candidates, replaying the exact same neighbour‑selection logic.
- **Batched LLM calls** — the entire "guided" queue and the entire "cold" queue
  each go out as a single API call (not one call per sentence), with per‑item
  fallback if the batch JSON fails to parse.
- **Non‑blocking Translation Memory lookups** — moved off the async event loop.
- **Rate‑limit circuit breaker** — after repeated Gemini rate‑limit errors, the
  system automatically stops calling Gemini for a cooldown window and routes
  straight to the Groq fallback, then probes Gemini again.
- **Robust export** — XML‑incompatible control characters are stripped so exports
  never crash on messy PDF text.

> Design principle: every optimization above is **accuracy‑neutral** — it changes
> *how fast* the same result is produced, never the translated text itself.

---

## 11. What makes TransSync‑AI unique
| Capability | Generic MT (Google/DeepL) | Raw LLM call | **TransSync‑AI** |
|---|---|---|---|
| Reuses approved translations (memory) | ❌ | ❌ | ✅ Growing TM, org‑scoped |
| Semantic reuse of *similar* sentences | ❌ | ❌ | ✅ FAISS vector search |
| Enforced organisation terminology | ⚠️ limited | ❌ | ✅ Glossary, every tier |
| Independent quality verification | ❌ | ❌ | ✅ Back‑translation, separate model |
| Human‑in‑the‑loop review & approval | ❌ | ❌ | ✅ Review → approve → learn |
| Format‑preserving DOCX export | ❌ | ❌ | ✅ OOXML run‑level injection |
| Multi‑tenant RBAC & isolation | ❌ | ❌ | ✅ Per‑org roles |
| Provider resilience (auto‑fallback) | n/a | ❌ | ✅ Gemini→Groq + circuit breaker |
| Cost efficiency that improves over time | ❌ | ❌ | ✅ Cheaper as TM grows |

**The one‑sentence differentiator:** TransSync‑AI is not "an LLM that translates" —
it's a *system around* translation that remembers, enforces consistency,
verifies itself, preserves formatting, and keeps humans in control.

---

## 12. Tech stack summary (for an architecture slide)
- **Frontend:** React, Vite, Context API
- **Backend:** FastAPI (Python), stateless
- **Auth/DB:** Supabase (Postgres, JWT/JWKS, RBAC)
- **Vector search:** FAISS (`IndexFlatL2`, 384‑dim)
- **Embeddings:** Sentence‑Transformers `all‑MiniLM‑L6‑v2`
- **LLMs:** Google Gemini 2.5 Flash (primary) + Groq Llama 3.3 70B (fallback/verifier)
- **NLP:** spaCy (segmentation), LanguageTool (grammar/spell)
- **Documents:** PyMuPDF (PDF), python‑docx (DOCX/OOXML)

---

## 13. Suggested slide outline
1. Title + one‑line pitch
2. The problem (the three bad options today)
3. The big idea (memory + cascade + human‑in‑the‑loop)
4. The 4‑tier translation cascade (diagram)
5. How quality is guaranteed (glossary + back‑translation)
6. Format‑preserving export (before/after visual)
7. End‑to‑end workflow (the document journey diagram)
8. Architecture overview (frontend / backend / AI / data)
9. Multi‑tenancy & security
10. Performance & resilience engineering
11. What makes us unique (comparison table)
12. Tech stack
13. Roadmap / future work (optional — see below)

## 14. Possible future work (optional slide)
- Server‑side batched TM matching via a database RPC (single round‑trip).
- Source‑language‑aware validation (currently English‑centric grammar checks).
- Approximate FAISS indexes (IVF/HNSW) for very large translation memories.
- Additional document formats and richer PDF layout reconstruction.
