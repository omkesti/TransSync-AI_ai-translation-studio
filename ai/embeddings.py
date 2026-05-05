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

    embeddings = _model.encode(sentence, convert_to_numpy=True)
    return embeddings
