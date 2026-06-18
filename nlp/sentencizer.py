import spacy

nlp = spacy.load("en_core_web_sm")

def split_sentences(raw_text: str) -> list[str]:
    """Splits raw text into a clean list of sentences.

    Each line of ``raw_text`` (a paragraph or table cell, as emitted by
    ``clean_raw_text``) is sentencized independently. Treating line breaks as
    hard boundaries ensures a heading or cell without terminal punctuation is
    kept as its own unit instead of being glued to the next paragraph — which
    is what lets the export step reconstruct it back onto the original node.
    """
    blocks = [line.strip() for line in raw_text.split("\n") if line.strip()]

    sentences = []
    for doc in nlp.pipe(blocks):
        for sent in doc.sents:
            text = sent.text.strip()
            if text and len(text) > 2:
                sentences.append(text)
    return sentences