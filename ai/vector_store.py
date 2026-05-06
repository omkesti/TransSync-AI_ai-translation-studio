import faiss
import supabase
import numpy as np
from dotenv import load_dotenv
import os

load_dotenv()

key = os.environ.get("SUPABASE_KEY")
url = os.environ.get("SUPABASE_URL")
supabase = supabase.create_client(url, key)

INDEX_PATH = "/data/translations.index"

if os.path.exists(INDEX_PATH):
    index = faiss.read_index(INDEX_PATH)
else:
    index = faiss.IndexFlatL2(384)  # Dimension of the embeddings

def faiss_search(embedding: np.ndarray) -> list[str, float]:
    """
    This function executes cosine similarity search
    """

    if index.ntotal == 0:
        return None, 0.0
    
    vector = embedding.reshape(1, -1).astype('float32')

    scores, indices = index.search(vector, k=1)

    score = scores[0][0]
    f_index = indices[0][0]
    
    if score < 0.8:  # Threshold for similarity
        return None, score
    
    # Fetch the corresponding translation from Supabase using the index
    try:
        response = supabase.from_("translation_memory")\
            .select("source_text", "translated_text")\
            .eq("faiss_index", f_index)\
            .execute()
    except Exception as e:
        print(f"Error fetching data from Supabase: {e}")
        return None, score
    
    if not response.data:
        return None, score
    
    match = response.data[0]['translated_text']
    return match, score
    

def add(embedding: np.ndarray, faiss_index: int):
    """
    This function adds the embedding to the FAISS index and saves it.
    """

    vector = embedding.reshape(1, -1).astype('float32')
    index.add(vector)
    save_index()

def save_index():
    """
    This function saves the FAISS index to disk.
    """

    os.makedirs(os.path.dirname(INDEX_PATH), exist_ok=True)
    faiss.write_index(index, INDEX_PATH)
