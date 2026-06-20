import numpy as np

from ai.embeddings import generate_embeddings, generate_embeddings_batch
from ai.translation_memory import exact_match_lookup, exact_match_lookup_batch
from ai.vector_store import faiss_search, faiss_search_batch
from ai.llm_client import (
    llm_guided_search,
    llm_guided_batch,
    cold_llm_search,
    cold_llm_batch,
)
from ai.back_translation import verify_back_translations

test_obj: dict = {
    "sentences": [
        'This is an example sentence', 
        'Each sentence is converted to a vector',
        'This is another example sentence'
    ],
    "source_lang": 'en',
    "target_lang": 'fr'
}

# sentences: list[str] = ['This is an example sentence', 'Each sentence is converted to a vector', 'This is another example sentence']

"""
# E.g. [
    {
        "source_text": "This is an example sentence",
        "translated_text": "Ceci est une phrase d'exemple"
        "match_type": "tm_exact" | "faiss_direct" | "llm_guided" | "llm_cold"
    },
    ...
]
"""


def _build_result(sentence: str, translation: str, match_type: str, score: float | None = None) -> dict:
    return {
        "source": sentence,
        "translation": translation,
        "match_type": match_type,
        "score": score,
        # Back-translation QA fields — populated later for llm_guided / llm_cold
        # tiers only (see ai/back_translation.py). Default to "not checked".
        "back_translation_score": None,
        "back_translation_failed": False,
    }


def _find_glossary_matches(sentence: str, glossary_hints: dict) -> dict:
    """
    Scans a sentence for any verified glossary terms (case-insensitive).
    Returns { source_term: target_term } for every match found in the sentence.

    Args:
        sentence:       The source sentence to scan.
        glossary_hints: Flat dict of { source_term_lower: target_term } fetched
                        from Supabase before the pipeline runs.
    Returns:
        A (possibly empty) dict of matched terms relevant to this sentence.
    """
    if not glossary_hints:
        return {}
    sentence_lower = sentence.lower()
    return {
        source: target
        for source, target in glossary_hints.items()
        if source in sentence_lower
    }


def _apply_glossary_posthoc(source_sentence: str, translation: str, sentence_hints: dict) -> str:
    """
    Post-processing step that GUARANTEES glossary enforcement.

    Strategy:
        For each glossary term found in the source sentence, do a
        case-insensitive regex search for the source term in the source sentence
        to find its original casing. Then use that casing to build a pattern
        that also catches the LLM's likely transliteration attempt in the
        translation. Since we cannot reliably detect the transliteration in
        the target script, we instead do a simpler check: scan the translation
        for the expected target term and if it's already there exactly, skip;
        otherwise append a direct substitution pass.

        For Latin-script targets (fr, de, es, etc.) we can do a word-boundary
        replace of any LLM-produced variant. For script-switching targets
        (hi, mar, etc.) we do a two-phase approach:
          1. Search the TRANSLATION for the source word (LLM may leave it in Latin)
             and replace it with the target term.
          2. If the target term is already present, nothing to do.

    This is a best-effort guarantee:
    - If the LLM left the source word untranslated (e.g. "Ajinkya" still
      appears in the Hindi output): replace it with the target term.
    - If the target term is already correct: no-op.
    - If the LLM used an unexpected variant in a different script: we cannot
      detect it without a second LLM call, but the prompt enforcement above
      should cover that case.
    """
    import re
    if not sentence_hints or not translation:
        return translation

    result = translation
    for src_lower, tgt in sentence_hints.items():
        # If the exact target term is already in the translation, do nothing
        if tgt in result:
            continue

        # Find original casing of the source term in the source sentence
        pattern = re.compile(re.escape(src_lower), re.IGNORECASE)

        # Replace any leftover untranslated source word in the translation
        # (common when LLM skips proper nouns in script-switching translations)
        result = pattern.sub(tgt, result)

    return result


async def translate_pipeline(obj: dict) -> list[dict]:
    """
    Run TM/FAISS checks per sentence and batch only LLM translations.
    Results are merged by index to preserve original order.
    """

    sentences = obj.get("sentences", [])
    target_lang = obj.get("target_lang")
    # Source language scopes TM + FAISS reuse to the SAME language pair, so a
    # Hindi→fr job never reuses an English→fr row (exact string collision) or a
    # loosely-similar English→fr neighbour. Defaults to "en" for back-compat.
    source_lang = obj.get("source_lang") or "en"
    org_id = obj.get("org_id", "")
    # Optional project scope. When present, TM + FAISS lookups search the
    # project's data first and fall through to org-scoped data. Pure pass-through
    # parameter — the translation logic itself is unchanged.
    project_id = obj.get("project_id") or None
    glossary_hints: dict = obj.get("glossary_hints") or {}

    results: list[dict | None] = [None] * len(sentences)
    guided_queue: list[dict] = []
    cold_queue: list[dict] = []

    # Glossary matches per sentence (computed once, reused throughout).
    hints_by_index = [_find_glossary_matches(s, glossary_hints) for s in sentences]

    # ── Stage 1: Exact TM lookup for ALL sentences in one Supabase query ────────
    # Behaviour is identical to a per-sentence exact_match_lookup loop; this just
    # collapses N round-trips into one (and is language-aware + org-scoped).
    exact_map = await exact_match_lookup_batch(sentences, target_lang, org_id, project_id, source_lang)

    remaining_indices: list[int] = []
    for index, sentence in enumerate(sentences):
        exact = exact_map.get(sentence)
        if exact:
            # Apply post-hoc glossary enforcement even on TM hits
            enforced = _apply_glossary_posthoc(sentence, exact, hints_by_index[index])
            results[index] = _build_result(sentence, enforced, "tm_exact", score=0.0)
            continue
        remaining_indices.append(index)

    # ── Stage 2: Batch-embed + batch-FAISS for everything that missed TM ────────
    # generate_embeddings_batch yields per-row vectors identical to encoding one
    # at a time; faiss_search_batch replays the same neighbour-selection logic as
    # faiss_search. Pure round-trip / model-call reduction, no accuracy change.
    if remaining_indices:
        remaining_sentences = [sentences[i] for i in remaining_indices]
        embeddings = generate_embeddings_batch(remaining_sentences)
        faiss_results = faiss_search_batch(embeddings, target_lang, org_id, project_id, source_lang)

        for position, index in enumerate(remaining_indices):
            sentence = sentences[index]
            sentence_hints = hints_by_index[index]
            faiss_result = faiss_results[position]

            if faiss_result:
                if faiss_result["score"] >= 0.95:
                    faiss_translation = faiss_result["translated_text"]
                    # Apply post-hoc glossary enforcement on FAISS direct hits too
                    enforced = _apply_glossary_posthoc(sentence, faiss_translation, sentence_hints)
                    results[index] = _build_result(sentence, enforced, "faiss_direct", score=faiss_result["score"])
                    continue

                guided_queue.append({
                    "index": index,
                    "sentence": sentence,
                    "reference_source": faiss_result["source_text"],
                    "reference_translation": faiss_result["translated_text"],
                    "glossary_hints": sentence_hints,
                    "faiss_score": faiss_result["score"],
                })
                continue

            cold_queue.append({
                "index": index,
                "sentence": sentence,
                "glossary_hints": sentence_hints,
            })

    # ── Guided LLM ──────────────────────────────────────────────────────────────
    # Identical sentences are de-duplicated: each UNIQUE sentence is translated
    # once (smaller request, fewer tokens) and the result fanned back out to every
    # index that shares that sentence. Identical sentences also share the same
    # FAISS reference + glossary hints (both deterministic on the text), so the
    # output is identical to translating each occurrence separately.
    if guided_queue:
        # sentence -> {indices, reference_source, reference_translation, hints, faiss_score}
        guided_groups: dict[str, dict] = {}
        for item in guided_queue:
            group = guided_groups.get(item["sentence"])
            if group is None:
                guided_groups[item["sentence"]] = {
                    "rep_index": item["index"],
                    "indices": [item["index"]],
                    "reference_source": item["reference_source"],
                    "reference_translation": item["reference_translation"],
                    "glossary_hints": item.get("glossary_hints") or {},
                    "faiss_score": item.get("faiss_score"),
                }
            else:
                group["indices"].append(item["index"])

        llm_items = [
            {
                "index": group["rep_index"],
                "sentence": sentence,
                "reference_source": group["reference_source"],
                "reference_translation": group["reference_translation"],
                "glossary_hints": group["glossary_hints"],
            }
            for sentence, group in guided_groups.items()
        ]
        responses = await llm_guided_batch(llm_items, target_lang)
        response_map = {r["index"]: r["translation"] for r in responses}

        for sentence, group in guided_groups.items():
            rep = group["rep_index"]
            hints = group["glossary_hints"]
            score = group["faiss_score"]

            raw = response_map.get(rep)
            if raw is None:
                # Per-item fallback: single call if this sentence missed the batch
                fallback = await llm_guided_search(
                    sentence,
                    group["reference_source"],
                    group["reference_translation"],
                    target_lang,
                    glossary_hints=hints,
                )
                raw = fallback["translation"] if fallback else None

            if raw is not None:
                enforced = _apply_glossary_posthoc(sentence, raw, hints)
                for idx in group["indices"]:
                    results[idx] = _build_result(sentence, enforced, "llm_guided", score=score)
            else:
                for idx in group["indices"]:
                    results[idx] = _build_result(sentence, f"[Translation failed for: {sentence}]", "error")

    # ── Cold LLM ────────────────────────────────────────────────────────────────
    # De-duplicated the same way as the guided queue.
    if cold_queue:
        cold_groups: dict[str, dict] = {}
        for item in cold_queue:
            group = cold_groups.get(item["sentence"])
            if group is None:
                cold_groups[item["sentence"]] = {
                    "rep_index": item["index"],
                    "indices": [item["index"]],
                    "glossary_hints": item.get("glossary_hints") or {},
                }
            else:
                group["indices"].append(item["index"])

        llm_items = [
            {
                "index": group["rep_index"],
                "sentence": sentence,
                "glossary_hints": group["glossary_hints"],
            }
            for sentence, group in cold_groups.items()
        ]
        responses = await cold_llm_batch(llm_items, target_lang)
        response_map = {r["index"]: r["translation"] for r in responses}

        for sentence, group in cold_groups.items():
            rep = group["rep_index"]
            hints = group["glossary_hints"]

            raw = response_map.get(rep)
            if raw is None:
                # Per-item fallback: single call if this sentence missed the batch
                fallback = await cold_llm_search(
                    sentence,
                    target_lang,
                    glossary_hints=hints,
                )
                raw = fallback["translation"] if fallback else None

            if raw is not None:
                enforced = _apply_glossary_posthoc(sentence, raw, hints)
                for idx in group["indices"]:
                    results[idx] = _build_result(sentence, enforced, "llm_cold")
            else:
                for idx in group["indices"]:
                    results[idx] = _build_result(sentence, f"[Translation failed for: {sentence}]", "error")

    # Ensure every slot is filled.
    for idx, item in enumerate(results):
        if item is None:
            results[idx] = _build_result(sentences[idx], f"[Translation failed for: {sentences[idx]}]", "error")

    # ── Back-translation verification (QA annotation) ───────────────────────────
    # Runs ONLY on llm_guided / llm_cold tiers via an independent validator model.
    # Best-effort: any failure leaves sentences un-annotated, never blocks.
    await verify_back_translations(results, obj.get("source_lang"))

    return results

async def translate_sentence(
    sentence: str,
    target_lang: str,
    org_id: str = "",
    glossary_hints: dict | None = None,
    project_id: str | None = None,
) -> dict:
    """
    Legacy single-sentence helper; prefer translate_pipeline via POST /api/translate.
    """
    results = await translate_pipeline({
        "sentences": [sentence],
        "target_lang": target_lang,
        "org_id": org_id,
        "project_id": project_id,
        "glossary_hints": glossary_hints or {},
    })
    return results[0]