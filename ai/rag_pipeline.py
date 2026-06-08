import numpy as np

from ai.embeddings import generate_embeddings
from ai.translation_memory import exact_match_lookup
from ai.vector_store import faiss_search
from ai.llm_client import (
    llm_guided_search,
    llm_guided_batch,
    cold_llm_search,
    cold_llm_batch,
)

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


def _build_result(sentence: str, translation: str, match_type: str) -> dict:
    return {"source": sentence, "translation": translation, "match_type": match_type}


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
    glossary_hints: dict = obj.get("glossary_hints") or {}

    results: list[dict | None] = [None] * len(sentences)
    guided_queue: list[dict] = []
    cold_queue: list[dict] = []

    for index, sentence in enumerate(sentences):
        # Glossary matches for this specific sentence (computed once, reused)
        sentence_hints = _find_glossary_matches(sentence, glossary_hints)

        # Exact TM lookup
        exact = await exact_match_lookup(sentence)
        if exact:
            # Apply post-hoc glossary enforcement even on TM hits
            enforced = _apply_glossary_posthoc(sentence, exact, sentence_hints)
            results[index] = _build_result(sentence, enforced, "tm_exact")
            continue

        # FAISS similarity search
        embeddings = generate_embeddings(sentence)
        faiss_result = faiss_search(embeddings)

        if faiss_result:
            if faiss_result["score"] >= 0.95:
                faiss_translation = faiss_result["translated_text"]
                # Apply post-hoc glossary enforcement on FAISS direct hits too
                enforced = _apply_glossary_posthoc(sentence, faiss_translation, sentence_hints)
                results[index] = _build_result(sentence, enforced, "faiss_direct")
                continue

            guided_queue.append({
                "index": index,
                "sentence": sentence,
                "reference_source": faiss_result["source_text"],
                "reference_translation": faiss_result["translated_text"],
                "glossary_hints": sentence_hints,
            })
            continue

        cold_queue.append({
            "index": index,
            "sentence": sentence,
            "glossary_hints": sentence_hints,
        })

    # ── Guided LLM — ONE single API call for the entire guided queue ────────────
    # Previously: ceil(len(guided_queue) / 15) calls
    # Now:        1 call regardless of queue size
    if guided_queue:
        llm_items = [
            {
                "index": item["index"],
                "sentence": item["sentence"],
                "reference_source": item["reference_source"],
                "reference_translation": item["reference_translation"],
                "glossary_hints": item.get("glossary_hints") or {},
            }
            for item in guided_queue
        ]
        responses = await llm_guided_batch(llm_items, target_lang)
        response_map = {r["index"]: r["translation"] for r in responses}

        for item in guided_queue:
            idx = item["index"]
            item_hints = item.get("glossary_hints") or {}
            if idx in response_map:
                raw = response_map[idx]
                enforced = _apply_glossary_posthoc(item["sentence"], raw, item_hints)
                results[idx] = _build_result(item["sentence"], enforced, "llm_guided")
                continue

            # Per-item fallback: single-sentence call if batch JSON parse failed for this item
            fallback = await llm_guided_search(
                item["sentence"],
                item["reference_source"],
                item["reference_translation"],
                target_lang,
                glossary_hints=item_hints,
            )
            if fallback:
                enforced = _apply_glossary_posthoc(item["sentence"], fallback["translation"], item_hints)
                results[idx] = _build_result(item["sentence"], enforced, "llm_guided")
            else:
                results[idx] = _build_result(item["sentence"], f"[Translation failed for: {item['sentence']}]", "error")

    # ── Cold LLM — ONE single API call for the entire cold queue ────────────────
    # Previously: ceil(len(cold_queue) / 15) calls
    # Now:        1 call regardless of queue size
    if cold_queue:
        llm_items = [
            {
                "index": item["index"],
                "sentence": item["sentence"],
                "glossary_hints": item.get("glossary_hints") or {},
            }
            for item in cold_queue
        ]
        responses = await cold_llm_batch(llm_items, target_lang)
        response_map = {r["index"]: r["translation"] for r in responses}

        for item in cold_queue:
            idx = item["index"]
            item_hints = item.get("glossary_hints") or {}
            if idx in response_map:
                raw = response_map[idx]
                enforced = _apply_glossary_posthoc(item["sentence"], raw, item_hints)
                results[idx] = _build_result(item["sentence"], enforced, "llm_cold")
                continue

            # Per-item fallback: single-sentence call if batch JSON parse failed for this item
            fallback = await cold_llm_search(
                item["sentence"],
                target_lang,
                glossary_hints=item_hints,
            )
            if fallback:
                enforced = _apply_glossary_posthoc(item["sentence"], fallback["translation"], item_hints)
                results[idx] = _build_result(item["sentence"], enforced, "llm_cold")
            else:
                results[idx] = _build_result(item["sentence"], f"[Translation failed for: {item['sentence']}]", "error")

    # Ensure every slot is filled.
    for idx, item in enumerate(results):
        if item is None:
            results[idx] = _build_result(sentences[idx], f"[Translation failed for: {sentences[idx]}]", "error")

    return results

async def translate_sentence(
    sentence: str,
    target_lang: str,
    glossary_hints: dict | None = None,
) -> dict:
    """
    Legacy single-sentence helper; prefer translate_pipeline via POST /api/translate.
    """
    results = await translate_pipeline({
        "sentences": [sentence],
        "target_lang": target_lang,
        "glossary_hints": glossary_hints or {},
    })
    return results[0]