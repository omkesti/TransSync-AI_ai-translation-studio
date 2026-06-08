# Active Glossary Enforcement — Technical Documentation

> TransSync AI · Feature Documentation · June 2025

---

## Overview

The **Active Glossary Enforcement** feature ensures that verified brand terms in the Glossary database are **always respected by the LLM** when generating translations. Previously, the Glossary was a management UI only — terms were stored but the translation engine had no knowledge of them. Now, before each translation job, the backend fetches all `VERIFIED` terms for the target language and injects them as a hard constraint into every LLM prompt.

---

## Key Design Principles

1. **Only `VERIFIED` terms are enforced.** `PENDING` terms are intentionally excluded — the Glossary's verification workflow now has real, system-level meaning.
2. **Glossary failure never blocks translation.** The DB fetch is wrapped in a `try/except`. If Supabase is unavailable, translation proceeds normally without glossary enforcement.
3. **TM and FAISS paths are unaffected.** When a sentence hits `tm_exact` or `faiss_direct`, it already has a human-approved translation — no LLM prompt injection is needed.
4. **Per-sentence scanning.** Each sentence is individually scanned for matching glossary terms before being queued. Only *relevant* terms are injected into each prompt, keeping prompts lean.

---

## Files Changed

| File | Action | Purpose |
|------|--------|---------|
| `backend/services/supabase_client.py` | **MODIFIED** | New `fetch_verified_glossary_terms(target_lang)` — returns `{ source_term_lower: target_term }` for all VERIFIED terms |
| `backend/routes/translate.py` | **MODIFIED** | Fetches glossary before calling `translate_pipeline()`, passes hints as `glossary_hints` |
| `ai/rag_pipeline.py` | **MODIFIED** | New `_find_glossary_matches()` helper; attaches per-sentence hints to `guided_queue` and `cold_queue` items; passes hints through to all LLM batch and fallback calls |
| `ai/llm_client.py` | **MODIFIED** | New `_build_glossary_block()` helper; all 4 LLM functions (`cold_llm_search`, `cold_llm_batch`, `llm_guided_search`, `llm_guided_batch`) accept and inject `glossary_hints` into their prompts |

---

## Data Flow

```
POST /api/translate
  │
  ├── [translate.py] fetch_verified_glossary_terms(target_lang)
  │        → { "neural interface": "Interface Neurale", "data breach": "violation de données" }
  │
  └── translate_pipeline({…, "glossary_hints": {…}})
          │
          ├── Per sentence: _find_glossary_matches(sentence, glossary_hints)
          │        → { "neural interface": "Interface Neurale" }  ← only terms found in THIS sentence
          │
          ├── tm_exact       → returns immediately, skips LLM (already correct)
          ├── faiss_direct   → returns immediately, skips LLM (already correct)
          │
          ├── guided_queue item: { index, sentence, ref_src, ref_tgt, glossary_hints }
          │
          └── cold_queue item:  { index, sentence, glossary_hints }
                   │
                   ├── llm_guided_batch(items, target_lang)
                   │        → aggregates all hints in batch
                   │        → injects into prompt:
                   │           "Mandatory Terminology (MUST be followed exactly):
                   │              - 'neural interface' MUST be translated as 'Interface Neurale'"
                   │
                   └── cold_llm_batch(items, target_lang)
                            → same mandatory terminology block injected
```

---

## LLM Prompt Injection (Example)

**Before (no glossary terms):**
```
You are a professional translator. Translate the following sentence into French.

Rules:
- Output ONLY the translated sentence, nothing else
…

Sentence: The neural interface connects to the cloud system.
```

**After (with matched glossary term):**
```
You are a professional translator. Translate the following sentence into French.

Mandatory Terminology (MUST be followed exactly):
  - "neural interface" MUST be translated as "Interface Neurale"

Rules:
- Output ONLY the translated sentence, nothing else
…

Sentence: The neural interface connects to the cloud system.
```

---

## How to Test

1. Open the **Glossary** page and add a term:
   - Source Term: `Neural Interface`
   - Target Term: `Interface Neurale`
   - Language: `French`
   - Status: **VERIFIED** ← critical, PENDING terms are ignored
2. Upload a document containing the phrase "Neural Interface" and translate to French.
3. In the Review page, verify the sentence containing "Neural Interface" uses exactly "Interface Neurale".
4. Check the backend server logs for the line:
   ```
   [glossary] Enforcing 1 verified term(s) for 'French'
   ```

---

## Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| No VERIFIED terms for target_lang | Empty `glossary_hints` dict, LLM prompts unchanged |
| Glossary DB fetch fails | Silently swallowed, translation proceeds normally |
| Sentence hits TM exact / FAISS direct | Glossary injection skipped (already a correct translation) |
| Sentence has no matching glossary terms | `glossary_hints` is `{}`, no block injected into prompt |
| Multiple matching terms in one sentence | All matched terms injected as separate bullet points |
