from nlp.cleaner import clean_raw_text, filter_sentences
from nlp.validator import evaluate_sentences
from nlp.sentencizer import split_sentences

def validate_and_split(raw_text: str) -> dict:
    if not raw_text or not raw_text.strip():
        return {"status": "error", "errors": ["Document appears to be empty."]}

    cleaned = clean_raw_text(raw_text)
    if not cleaned:
        return {"status": "error", "errors": ["Document appears to be empty after cleanup."]}

    sentences = split_sentences(cleaned)
    sentences = filter_sentences(sentences)
    if not sentences:
        return {"status": "error", "errors": ["Could not extract any sentences."]}

    evaluation = evaluate_sentences(sentences)
    if evaluation["status"] == "error":
        return {"status": "error", "errors": evaluation["errors"]}

    return {"status": "ok", "sentences": sentences}