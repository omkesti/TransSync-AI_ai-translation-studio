import spacy

# ── Per-language sentence-segmentation pipelines (lazy + cached) ───────────────
# English keeps the statistical model (best-quality boundaries). Every other
# language uses ONE shared multilingual blank pipeline with spaCy's rule-based
# Sentencizer, whose default `punct_chars` already covers non-Latin terminators
# (Devanagari danda "।"/"॥", CJK "。！？", Arabic "۔", etc.). This means any
# source language sentencizes correctly with NO extra model download.
_PIPELINES: dict[str, "spacy.language.Language"] = {}


def _get_pipeline(source_lang: str):
    """Return a cached spaCy pipeline appropriate for ``source_lang``."""
    lang = (source_lang or "en").lower()
    key = "en" if lang == "en" else "xx"

    pipe = _PIPELINES.get(key)
    if pipe is not None:
        return pipe

    if key == "en":
        pipe = spacy.load("en_core_web_sm")
    else:
        # Multilingual blank pipeline: no statistical model, just rule-based
        # sentence boundaries that understand non-Latin punctuation.
        pipe = spacy.blank("xx")
        pipe.add_pipe("sentencizer")

    _PIPELINES[key] = pipe
    return pipe


def split_sentences(raw_text: str, source_lang: str = "en") -> list[str]:
    """Splits raw text into a clean list of sentences.

    Each line of ``raw_text`` (a paragraph or table cell, as emitted by
    ``clean_raw_text``) is sentencized independently. Treating line breaks as
    hard boundaries ensures a heading or cell without terminal punctuation is
    kept as its own unit instead of being glued to the next paragraph — which
    is what lets the export step reconstruct it back onto the original node.

    ``source_lang`` selects the segmentation pipeline so non-English documents
    (e.g. Hindi using the danda "।") split on the right sentence terminators.
    """
    blocks = [line.strip() for line in raw_text.split("\n") if line.strip()]

    nlp = _get_pipeline(source_lang)

    sentences = []
    for doc in nlp.pipe(blocks):
        for sent in doc.sents:
            text = sent.text.strip()
            if text and len(text) > 2:
                sentences.append(text)
    return sentences
