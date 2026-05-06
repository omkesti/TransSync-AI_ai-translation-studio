from embeddings import generate_embeddings
from translation_memory import exact_match_lookup
from vector_store import faiss_search

test_obj: dict = {
    "sentences": [
        'This is an example sentence', 
        'Each sentence is converted to a vector',
        'This is another example sentence'
    ],
    "source_lang": 'en',
    "target_lang": 'fr'
}

sentences: list[str] = ['This is an example sentence', 'Each sentence is converted to a vector', 'This is another example sentence']

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
translated_sentences: list[dict] = []

async def translate_pipeline():
    """
    Loop through each sentence in the input and translate it.
    """

    for sentence in test_obj["sentences"]:
        sentence_translated = await translate_sentence(sentence)
        translated_sentences.append(sentence_translated)


    return translated_sentences

async def translate_sentence(sentence: str) -> dict:
    
    """
    translate_sentence function called
    """

    # Check for any exact match from the database
    E_translation = await exact_match_lookup(sentence)
    if E_translation:
        return {"source": sentence, "translation": E_translation, "match_type": "tm_exact"}

    # Generate embeddings
    embeddings = await generate_embeddings(sentence)

    # FAISS check for similar sentences and returns the translation.
    F_translation, score = await faiss_search(embeddings)
    if F_translation:
        if score > 0.95:
            return {"source": sentence, "translation": F_translation, "match_type": "faiss_direct"}
