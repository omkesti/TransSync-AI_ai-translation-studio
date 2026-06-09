"""
vector_store.py
---------------
Manages the FAISS flat L2 index for semantic similarity search over
translation_memory source embeddings.

Index file location:  ai/data/translations.index
  (repo-relative, works on Windows and Linux — no more /data/… path)

Language isolation:
  FAISS vectors are source-text embeddings (language-agnostic).
  The Supabase resolution step filters by target_lang so a German vector
  can never resolve a French translation.
"""

import os
import faiss
import numpy as np
from dotenv import load_dotenv
from supabase import create_client

# ── Config ────────────────────────────────────────────────────────────────────

_AI_DIR = os.path.dirname(os.path.abspath(__file__))
INDEX_PATH = os.path.join(_AI_DIR, "data", "translations.index")

load_dotenv(dotenv_path=os.path.join(_AI_DIR, "..", "backend", ".env"))
load_dotenv(dotenv_path=os.path.join(_AI_DIR, "..", ".env"))  # fallback

_url = os.environ.get("SUPABASE_URL")
_key = os.environ.get("SUPABASE_KEY")
supabase = create_client(_url, _key)

EMBEDDING_DIM = 384  # all-MiniLM-L6-v2 output dimension

# ── Index bootstrap ───────────────────────────────────────────────────────────

def _load_index() -> faiss.IndexFlatL2:
    """Load FAISS index from disk, or create a fresh one if missing/corrupt."""
    if os.path.exists(INDEX_PATH) and os.path.getsize(INDEX_PATH) > 0:
        try:
            loaded = faiss.read_index(INDEX_PATH)
            print(f"[faiss] Loaded index from {INDEX_PATH}  (ntotal={loaded.ntotal})")
            return loaded
        except Exception as e:
            print(f"[faiss] WARNING: Could not read index file ({e}). Deleting corrupt file and starting fresh.")
            try:
                os.remove(INDEX_PATH)
            except OSError:
                pass

    print(f"[faiss] No valid index file found — starting fresh IndexFlatL2({EMBEDDING_DIM})")
    return faiss.IndexFlatL2(EMBEDDING_DIM)


index = _load_index()



# ── Helpers ───────────────────────────────────────────────────────────────────

def _normalize_lang(lang: str) -> str:
    """Minimal inline normaliser (mirrors translation_memory._normalize)."""
    _ALIASES = {
        "german": "de", "deutsch": "de",
        "french": "fr", "français": "fr", "francais": "fr",
        "spanish": "es", "español": "es", "espanol": "es",
        "japanese": "ja",
        "english": "en",
        "hindi": "hi",
        "marathi": "mar",
    }
    if not lang:
        return ""
    cleaned = str(lang).strip().lower()
    return _ALIASES.get(cleaned, cleaned)


def save_index():
    """Persists the in-memory FAISS index to disk."""
    os.makedirs(os.path.dirname(INDEX_PATH), exist_ok=True)
    faiss.write_index(index, INDEX_PATH)


# ── Write API ─────────────────────────────────────────────────────────────────

def add_embedding(embedding: np.ndarray) -> int:
    """
    Appends one embedding to the index, persists it, and returns the
    assigned faiss_index (= position before the add, i.e. index.ntotal - 1
    after the add).

    Always call this BEFORE inserting the Supabase row so the returned
    faiss_index can be stored with the row.
    """
    assigned = index.ntotal          # position this vector will occupy
    vector = embedding.reshape(1, -1).astype("float32")
    index.add(vector)
    save_index()
    return assigned


def add_embeddings_batch(embeddings: list[np.ndarray]) -> list[int]:
    """
    Appends multiple embeddings in one shot (one save_index() call).
    Returns the list of assigned faiss_index values in the same order.
    More efficient than calling add_embedding() in a loop for approve batches.
    """
    if not embeddings:
        return []

    start = index.ntotal
    matrix = np.vstack([e.reshape(1, -1).astype("float32") for e in embeddings])
    index.add(matrix)
    save_index()
    return list(range(start, start + len(embeddings)))


# ── Read API ──────────────────────────────────────────────────────────────────

def faiss_search(embedding: np.ndarray, target_lang: str) -> dict | None:
    """
    Finds the nearest neighbour in the FAISS index and resolves it against
    Supabase, filtering by target_lang to prevent cross-language hits.

    Returns:
        {source_text, translated_text, score}  — for guided LLM (score < 0.95)
        {translated_text, score}               — for direct use  (score >= 0.95)
        None                                   — no hit above threshold
    """
    if index.ntotal == 0:
        return None

    normalized = _normalize_lang(target_lang)
    vector = embedding.reshape(1, -1).astype("float32")

    # Search k=3 to increase chance of finding the right language if multiple
    # languages share the same vector space position.
    k = min(3, index.ntotal)
    scores, indices = index.search(vector, k=k)

    for score, f_index in zip(scores[0], indices[0]):
        if f_index < 0:
            continue  # FAISS returns -1 for unfilled slots

        # Score threshold — L2 distance (lower = better; 0 = identical)
        # 0.8 threshold means allow up to moderate similarity
        if score > 0.8:
            continue  # Too dissimilar — skip

        # Resolve against Supabase with language filter
        try:
            response = (
                supabase.from_("translation_memory")
                .select("source_text, translated_text")
                .eq("faiss_index", int(f_index))
                .eq("target_lang", normalized)
                .limit(1)
                .execute()
            )
        except Exception as e:
            print(f"[faiss] Supabase resolution error: {e}")
            continue

        if not response.data:
            # Vector exists but no matching row for this language — try next k
            continue

        row = response.data[0]
        result = {
            "translated_text": row["translated_text"],
            "score": float(score),
        }
        if score >= 0.05:  # guided: return source for reference prompt
            result["source_text"] = row["source_text"]

        return result

    return None
