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


async def translate_pipeline(obj: dict) -> list[dict]:
    """
    Run TM/FAISS checks per sentence and batch only LLM translations.
    Results are merged by index to preserve original order.
    """

    sentences = obj.get("sentences", [])
    target_lang = obj.get("target_lang")

    results: list[dict | None] = [None] * len(sentences)
    guided_queue: list[dict] = []
    cold_queue: list[dict] = []

    for index, sentence in enumerate(sentences):
        # Exact TM lookup
        exact = await exact_match_lookup(sentence)
        if exact:
            results[index] = _build_result(sentence, exact, "tm_exact")
            continue

        # FAISS similarity search
        embeddings = generate_embeddings(sentence)
        faiss_result = faiss_search(embeddings)

        if faiss_result:
            if faiss_result["score"] >= 0.95:
                results[index] = _build_result(
                    sentence,
                    faiss_result["translated_text"],
                    "faiss_direct",
                )
                continue

            guided_queue.append({
                "index": index,
                "sentence": sentence,
                "reference_source": faiss_result["source_text"],
                "reference_translation": faiss_result["translated_text"],
            })
            continue

        cold_queue.append({
            "index": index,
            "sentence": sentence,
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
            }
            for item in guided_queue
        ]
        responses = await llm_guided_batch(llm_items, target_lang)
        response_map = {r["index"]: r["translation"] for r in responses}

        for item in guided_queue:
            idx = item["index"]
            if idx in response_map:
                results[idx] = _build_result(item["sentence"], response_map[idx], "llm_guided")
                continue

            # Per-item fallback: single-sentence call if batch JSON parse failed for this item
            fallback = await llm_guided_search(
                item["sentence"],
                item["reference_source"],
                item["reference_translation"],
                target_lang,
            )
            if fallback:
                results[idx] = _build_result(item["sentence"], fallback["translation"], "llm_guided")
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
            }
            for item in cold_queue
        ]
        responses = await cold_llm_batch(llm_items, target_lang)
        response_map = {r["index"]: r["translation"] for r in responses}

        for item in cold_queue:
            idx = item["index"]
            if idx in response_map:
                results[idx] = _build_result(item["sentence"], response_map[idx], "llm_cold")
                continue

            # Per-item fallback: single-sentence call if batch JSON parse failed for this item
            fallback = await cold_llm_search(item["sentence"], target_lang)
            if fallback:
                results[idx] = _build_result(item["sentence"], fallback["translation"], "llm_cold")
            else:
                results[idx] = _build_result(item["sentence"], f"[Translation failed for: {item['sentence']}]", "error")

    # Ensure every slot is filled.
    for idx, item in enumerate(results):
        if item is None:
            results[idx] = _build_result(sentences[idx], f"[Translation failed for: {sentences[idx]}]", "error")

    return results

async def translate_sentence(sentence: str, target_lang: str) -> dict:
    
    """
    translate_sentence function called
    """

    # Check for any exact match from the database
    E_translation: str | None = await exact_match_lookup(sentence)
    if E_translation:
        return {
            "source": sentence, 
            "translation": E_translation, 
            "match_type": "tm_exact"
        }

    # Generate embeddings
    embeddings: np.ndarray = generate_embeddings(sentence)

    # FAISS check for similar sentences and returns the translation.
    # F_translation, score = await faiss_search(embeddings)
    
    F_translation: dict = faiss_search(embeddings)
    if F_translation:
        if F_translation["score"] >= 0.95:
            return {
                "source": sentence, 
                "translation": F_translation["translated_text"], 
                "match_type": "faiss_direct"
            }
        else:
            # If the score is (0.8 - 0.95), we use guided llm prompt to translate the sentence
            llm_translation: dict | None = await llm_guided_search(
                sentence,
                F_translation["source_text"], 
                F_translation["translated_text"],
                target_lang
            )

            if llm_translation:
                return {
                    "source": sentence, 
                    "translation": llm_translation["translation"], 
                    "match_type": "llm_guided"
                }

    # If no match is found, we use cold llm prompt to translate the sentence
    llm_translation: dict | None = await cold_llm_search(sentence, target_lang)

    if llm_translation:
        return {
            "source": sentence, 
            "translation": llm_translation["translation"], 
            "match_type": "llm_cold"
        }
    else:
        # Fallback: return error indicator if all translation methods fail
        return {
            "source": sentence, 
            "translation": f"[Translation failed for: {sentence}]", 
            "match_type": "error"
        }