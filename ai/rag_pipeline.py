import numpy as np
# import asyncio

from ai.embeddings import generate_embeddings
from ai.translation_memory import exact_match_lookup
from ai.vector_store import faiss_search
from ai.llm_client import llm_guided_search, cold_llm_search

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
translated_sentences: list[dict] = []

async def translate_pipeline(obj: dict) -> list[dict]:
    """
    Loop through each sentence in the input and translate it.
    """

    for sentence in obj["sentences"]:
        sentence_translated = await translate_sentence(sentence, obj["target_lang"])
        translated_sentences.append(sentence_translated)

    return translated_sentences

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