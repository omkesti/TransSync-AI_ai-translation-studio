from embeddings import generate_embeddings
from translation_memory import exact_match_lookup

sentences = ['This is an example sentence', 'Each sentence is converted to a vector']
translated_sentences = []

async def translate_pipeline():
    """
    Loop through each sentence in the input and translate it.
    """

    for sentence in sentences:
        sentence_translated = await translate_sentence(sentence)
        translated_sentences.append(sentence_translated)

async def translate_sentence(sentence: str) -> str:
    
    """
    translate_sentence function called
    """

    # Check for any exact match from the database
    translation = await exact_match_lookup(sentence)
    if translation:
        return translation

    # Generate embeddings
    embeddings = await generate_embeddings(sentence)

    # FAISS check for similar sentences and returns the translation.
    
