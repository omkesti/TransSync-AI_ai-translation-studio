import spacy

nlp = spacy.load("en_core_web_sm")

def split_sentences(raw_text: str) -> list[str]:
    """Splits raw text into a clean list of sentences."""
    doc = nlp(raw_text)
    return [
        sent.text.strip()
        for sent in doc.sents
        if sent.text.strip() and len(sent.text.strip()) > 2
    ]