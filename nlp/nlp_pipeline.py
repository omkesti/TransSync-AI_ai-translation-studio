from nlp.cleaner import clean_raw_text, filter_sentences
from nlp.validator import evaluate_sentences
from nlp.sentencizer import split_sentences
from backend.utils.language_codes import normalize_lang_code

def validate_and_split(raw_text: str, source_lang: str = "en") -> dict:
    if not raw_text or not raw_text.strip():
        return {"status": "error", "errors": ["Document appears to be empty."]}

    # Normalize to a canonical code so the sentencizer/validator pick the right
    # language behaviour (a blank/invalid code falls back to English).
    lang = normalize_lang_code(source_lang) or "en"

    cleaned = clean_raw_text(raw_text)
    if not cleaned:
        return {"status": "error", "errors": ["Document appears to be empty after cleanup."]}

    sentences = split_sentences(cleaned, lang)
    sentences = filter_sentences(sentences)
    if not sentences:
        return {"status": "error", "errors": ["Could not extract any sentences."]}

    evaluation = evaluate_sentences(sentences, lang)
    if evaluation["status"] == "error":
        return {"status": "error", "errors": evaluation["errors"]}

    return {"status": "ok", "sentences": sentences, "source_lang": lang}
