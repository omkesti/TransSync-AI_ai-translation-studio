from sentence_transformers import SentenceTransformer
import numpy as np

MODEL_NAME = 'all-MiniLM-L6-v2'

_model = SentenceTransformer(MODEL_NAME)
sentences = ['This is an example sentence', 'Each sentence is converted to a vector']

# Generate embeddings
def generate_embeddings(sentences: list[str]) -> np.ndarray:
    
    """
    Takes a list of sentences and generates embeddings.
    Returns a numpy array of embeddings. 
    Reason: FAISS only accepts numpy arrays.
    """

    embeddings = _model.encode(sentences, convert_to_numpy=True)
    return embeddings
