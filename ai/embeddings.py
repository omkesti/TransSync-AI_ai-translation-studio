from sentence_transformers import SentenceTransformer
import numpy as np

MODEL_NAME = 'all-MiniLM-L6-v2'

_model = SentenceTransformer(MODEL_NAME)

# Generate embeddings
def generate_embeddings(sentence: str) -> np.ndarray:
    
    """
    Takes a sentence and generates an embedding.
    Returns a numpy array of the embedding.
    Reason: FAISS only accepts numpy arrays.
    """

    embeddings = _model.encode(sentence, normalize_embeddings=True, convert_to_numpy=True)
    return embeddings


def generate_embeddings_batch(sentences: list[str]) -> np.ndarray:
    """
    Batch version of generate_embeddings. Encodes a list of sentences in a
    single vectorized model call.

    Returns a 2D numpy array of shape (len(sentences), dim), where row i is the
    embedding for sentences[i]. The per-row output is identical to calling
    generate_embeddings(sentences[i]) individually — this is purely a speed
    optimization (one model invocation instead of N), not an accuracy change.

    Returns an empty array of shape (0, dim) when given no sentences.
    """
    if not sentences:
        return np.empty((0, _model.get_sentence_embedding_dimension()), dtype="float32")

    return _model.encode(sentences, normalize_embeddings=True, convert_to_numpy=True)
