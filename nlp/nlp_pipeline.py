from nlp.validator import run_quality_checks, ERROR_THRESHOLD
from nlp.sentencizer import split_sentences

def validate_and_split(raw_text: str) -> dict:
    if not raw_text or not raw_text.strip():
        return {"status": "error", "errors": ["Document appears to be empty."]}

    errors = run_quality_checks(raw_text)
    if len(errors) > ERROR_THRESHOLD:
        return {"status": "error", "errors": errors[:20]}

    sentences = split_sentences(raw_text)
    if not sentences:
        return {"status": "error", "errors": ["Could not extract any sentences."]}

    return {"status": "ok", "sentences": sentences}