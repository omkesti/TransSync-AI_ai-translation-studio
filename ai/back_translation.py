"""
back_translation.py
-------------------
Automatic Back-Translation Verification — a QA annotation layer.

Principle (separation of duties):
    The model that produces the forward translation (Gemini) is NEVER the model
    that validates it. Back-translation is performed by an independent model
    (Groq's Llama, via `ai.llm_client.back_translate`), so the check is not
    biased toward the generator's own output.

How it works:
    1. Take a sentence that was translated by the LLM (llm_guided / llm_cold).
    2. Translate the result BACK to the original source language with the
       independent validator model.
    3. Embed the original source sentence and the back-translation, then compute
       cosine similarity between the two vectors.
    4. If the score falls below BACK_TRANSLATION_THRESHOLD (default 0.85), flag
       the sentence so the human reviewer pays extra attention.

This is an INFORMATIONAL annotation, never a blocker. Any failure in the
back-translation or scoring step is swallowed and the sentence is simply left
un-annotated.
"""

import asyncio
import os

import numpy as np

from ai.embeddings import generate_embeddings, generate_embeddings_batch
from ai.llm_client import back_translate

# Only these tiers are verified. tm_exact / faiss_direct came from
# human-approved translation memory and are trusted as-is.
VERIFIED_TIERS = ("llm_guided", "llm_cold")

DEFAULT_THRESHOLD = 0.85


def _threshold() -> float:
    """Read BACK_TRANSLATION_THRESHOLD from the env, falling back to the default."""
    raw = os.environ.get("BACK_TRANSLATION_THRESHOLD")
    if not raw:
        return DEFAULT_THRESHOLD
    try:
        return float(raw)
    except (TypeError, ValueError):
        print(
            f"[back_translation] Invalid BACK_TRANSLATION_THRESHOLD={raw!r} — "
            f"using default {DEFAULT_THRESHOLD}"
        )
        return DEFAULT_THRESHOLD


def _cosine_similarity(source_sentence: str, back_translated: str) -> float:
    """
    Cosine similarity between the source sentence and its back-translation.

    Embeddings from `generate_embeddings` are already L2-normalised, so the
    dot product equals the cosine similarity. The result is clamped to
    [-1.0, 1.0] to absorb floating-point drift.
    """
    src_vec = generate_embeddings(source_sentence)
    back_vec = generate_embeddings(back_translated)
    score = float(np.dot(src_vec, back_vec))
    return max(-1.0, min(1.0, score))


async def verify_back_translations(results: list[dict], source_lang: str) -> None:
    """
    Annotate `results` IN PLACE with back-translation QA flags.

    For every result whose match_type is in VERIFIED_TIERS, this sets:
        - back_translation_score:  float cosine similarity (0..1), or left as-is
                                   (None) if verification was skipped.
        - back_translation_failed: True when the score is below the threshold.

    Network back-translation calls are run concurrently (I/O bound). Embedding
    + scoring is done sequentially afterwards because the SentenceTransformer
    model is shared and not guaranteed thread-safe.

    Never raises — any per-sentence failure simply leaves that sentence
    un-annotated (score stays None, failed stays False).
    """
    if not source_lang:
        return

    targets = [
        r
        for r in results
        if r and r.get("match_type") in VERIFIED_TIERS and r.get("translation")
    ]
    if not targets:
        return

    # ── Phase 1: concurrent back-translation (network bound) ──────────────────
    backs = await asyncio.gather(
        *[asyncio.to_thread(back_translate, r["translation"], source_lang) for r in targets],
        return_exceptions=True,
    )

    # ── Phase 2: embeddings + cosine scoring ──────────────────────────────────
    threshold = _threshold()

    # Collect the (result, back-translation) pairs that actually need scoring,
    # filtering out failed / empty back-translations exactly as before.
    scored_pairs: list[tuple[dict, str]] = []
    for result, back in zip(targets, backs):
        if isinstance(back, Exception):
            print(f"[back_translation] back-translation failed — skipping: {back}")
            continue
        if not back:
            continue  # validator unavailable / empty output → skip silently
        scored_pairs.append((result, back))

    if not scored_pairs:
        return

    # Batch-embed all sources and all back-translations in two model calls.
    # Embeddings are L2-normalised, so the per-row dot product equals the cosine
    # similarity — identical scores to scoring each pair individually, just fewer
    # model invocations.
    try:
        sources = [r["source"] for r, _ in scored_pairs]
        backs_text = [b for _, b in scored_pairs]
        src_mat = generate_embeddings_batch(sources)
        back_mat = generate_embeddings_batch(backs_text)
        scores = np.clip(np.sum(src_mat * back_mat, axis=1), -1.0, 1.0)
        for (result, _), score in zip(scored_pairs, scores):
            result["back_translation_score"] = round(float(score), 4)
            result["back_translation_failed"] = float(score) < threshold
    except Exception as e:
        # Best-effort fallback: score pair-by-pair so one bad row can't drop the
        # whole batch's annotations.
        print(f"[back_translation] batch scoring failed — falling back per-item: {e}")
        for result, back in scored_pairs:
            try:
                score = _cosine_similarity(result["source"], back)
            except Exception as inner:
                print(f"[back_translation] scoring failed — skipping: {inner}")
                continue
            result["back_translation_score"] = round(score, 4)
            result["back_translation_failed"] = score < threshold
