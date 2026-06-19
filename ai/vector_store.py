"""
vector_store.py
---------------
Manages FAISS flat L2 indexes for semantic similarity search over
translation_memory source embeddings.

Index files:
  • Org / fallback index :  ai/data/translations.index
        The original single index. Holds every org-scoped vector
        (project_id IS NULL). Resolution filters by org_id + target_lang so a
        vector can never resolve a translation from another tenant or language.
  • Per-project indexes  :  ai/data/indexes/project_<project_id>.index
        Created (empty) when a project is created. Holds only that project's
        approved vectors. Resolution filters by project_id + org_id + target_lang.

Scoping & fallthrough:
  A `faiss_index` value is a POSITION within ONE index file. Project-scoped TM
  rows store positions in their project index; org-scoped rows store positions
  in the org index. To search, we look in the project index first (when a
  project_id is supplied) and fall through to the org index for any query that
  found no sufficient match. The Supabase resolution step disambiguates the two
  scopes (`.eq("project_id", …)` vs `.is_("project_id", "null")`) so a position
  that happens to collide across files can never cross scopes.

This module keeps the same public contract it always had — `faiss_search`,
`faiss_search_batch`, `add_embedding`, `add_embeddings_batch`, `save_index` —
with `project_id` added as an optional trailing argument. Calling them without a
project_id reproduces the original org-only behaviour exactly.
"""

import os
import faiss
import numpy as np
from dotenv import load_dotenv
from supabase import create_client

# ── Config ────────────────────────────────────────────────────────────────────

_AI_DIR = os.path.dirname(os.path.abspath(__file__))
INDEX_PATH = os.path.join(_AI_DIR, "data", "translations.index")          # org / fallback
INDEXES_DIR = os.path.join(_AI_DIR, "data", "indexes")                    # per-project

load_dotenv(dotenv_path=os.path.join(_AI_DIR, "..", "backend", ".env"))
load_dotenv(dotenv_path=os.path.join(_AI_DIR, "..", ".env"))  # fallback

_url = os.environ.get("SUPABASE_URL")
_key = os.environ.get("SUPABASE_KEY")
supabase = create_client(_url, _key)

EMBEDDING_DIM = 384  # all-MiniLM-L6-v2 output dimension

# Distance gate (L2; lower = better). Mirrors the original threshold.
_MAX_DISTANCE = 0.8
# Below this distance the neighbour is so close we also return source_text so the
# guided-LLM tier can use it as a reference pair.
_REFERENCE_DISTANCE = 0.05

# ── Index registry ──────────────────────────────────────────────────────────────
# scope key → in-memory faiss index. "__org__" is the org/fallback index; any
# other key is a project_id.
_ORG_SCOPE = "__org__"
_indexes: dict[str, faiss.IndexFlatL2] = {}


def _scope_key(project_id: str | None) -> str:
    return project_id if project_id else _ORG_SCOPE


def _path_for_scope(project_id: str | None) -> str:
    if project_id:
        return os.path.join(INDEXES_DIR, f"project_{project_id}.index")
    return INDEX_PATH


def _load_index_file(path: str) -> faiss.IndexFlatL2:
    """Load a FAISS index from `path`, or create a fresh one if missing/corrupt."""
    if os.path.exists(path) and os.path.getsize(path) > 0:
        try:
            loaded = faiss.read_index(path)
            print(f"[faiss] Loaded index from {path}  (ntotal={loaded.ntotal})")
            return loaded
        except Exception as e:
            print(f"[faiss] WARNING: Could not read {path} ({e}). Deleting corrupt file and starting fresh.")
            try:
                os.remove(path)
            except OSError:
                pass

    print(f"[faiss] No valid index at {path} — starting fresh IndexFlatL2({EMBEDDING_DIM})")
    return faiss.IndexFlatL2(EMBEDDING_DIM)


def _get_index(project_id: str | None = None) -> faiss.IndexFlatL2:
    """Return the cached in-memory index for the scope, loading it on first use."""
    key = _scope_key(project_id)
    cached = _indexes.get(key)
    if cached is not None:
        return cached
    idx = _load_index_file(_path_for_scope(project_id))
    _indexes[key] = idx
    return idx


def _save_index(project_id: str | None = None) -> None:
    """Persist the in-memory index for the given scope to disk."""
    key = _scope_key(project_id)
    idx = _indexes.get(key)
    if idx is None:
        return
    path = _path_for_scope(project_id)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    faiss.write_index(idx, path)


# Backward-compat: expose the org index as a module attribute and keep save_index().
index = _get_index(None)


def save_index():
    """Persists the in-memory org/fallback FAISS index to disk (legacy helper)."""
    _save_index(None)


def create_project_index(project_id: str) -> str:
    """
    Create an empty on-disk FAISS index for a new project so the AI layer has a
    place to write project-scoped vectors. Idempotent: an existing index is left
    untouched. Returns the index file path.

    Called by POST /api/projects at project-creation time.
    """
    if not project_id:
        raise ValueError("project_id is required to create a project index.")
    idx = _get_index(project_id)          # loads existing or creates fresh in memory
    if not os.path.exists(_path_for_scope(project_id)):
        _save_index(project_id)           # materialise the empty file
    return _path_for_scope(project_id)


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


# ── Write API ─────────────────────────────────────────────────────────────────

def add_embedding(embedding: np.ndarray, project_id: str | None = None) -> int:
    """
    Append one embedding to the scope's index, persist it, and return the
    assigned faiss_index (its position within THAT scope's index).

    Always call this BEFORE inserting the Supabase row so the returned
    faiss_index can be stored with the row.
    """
    idx = _get_index(project_id)
    assigned = idx.ntotal
    vector = embedding.reshape(1, -1).astype("float32")
    idx.add(vector)
    _save_index(project_id)
    return assigned


def add_embeddings_batch(
    embeddings: list[np.ndarray], project_id: str | None = None
) -> list[int]:
    """
    Append multiple embeddings to the scope's index in one shot (one save_index()
    call). Returns the list of assigned faiss_index values in the same order.

    When project_id is provided the vectors land in that project's index;
    otherwise they land in the org/fallback index — exactly the legacy behaviour.
    """
    if not embeddings:
        return []

    idx = _get_index(project_id)
    start = idx.ntotal
    matrix = np.vstack([e.reshape(1, -1).astype("float32") for e in embeddings])
    idx.add(matrix)
    _save_index(project_id)
    return list(range(start, start + len(embeddings)))


# ── Read API ──────────────────────────────────────────────────────────────────

def _resolve_candidates(
    candidates: set[int],
    normalized: str,
    org_id: str,
    project_id: str | None,
    scope: str,
) -> dict[int, dict]:
    """
    Resolve a set of faiss_index positions against Supabase for one scope.

    scope == "project":  filter project_id == project_id
    scope == "org":      filter project_id IS NULL  (the original org-scoped rows)

    Returns { faiss_index: row } with the first row per index winning (mirrors
    the original `.limit(1)` semantics).
    """
    if not candidates:
        return {}
    try:
        query = (
            supabase.from_("translation_memory")
            .select("source_text, translated_text, faiss_index")
            .in_("faiss_index", list(candidates))
            .eq("target_lang", normalized)
            .eq("org_id", org_id)
        )
        if scope == "project":
            query = query.eq("project_id", project_id)
        else:
            query = query.is_("project_id", "null")
        rows = query.execute().data or []
    except Exception as e:
        print(f"[faiss] Supabase resolution error ({scope}): {e}")
        return {}

    row_by_index: dict[int, dict] = {}
    for row in rows:
        f_index = int(row["faiss_index"])
        if f_index not in row_by_index:
            row_by_index[f_index] = row
    return row_by_index


def _search_with_index(
    idx: faiss.IndexFlatL2,
    matrix: np.ndarray,
    normalized: str,
    org_id: str,
    project_id: str | None,
    scope: str,
) -> list[dict | None]:
    """
    Run one batched FAISS search against `idx` and resolve the neighbours against
    Supabase for `scope`. Returns a faiss_search-style dict (or None) per row.

    Selection logic is identical to the original faiss_search:
        - search k = min(3, ntotal) neighbours
        - skip unfilled slots (f_index < 0) and too-dissimilar hits (distance gate)
        - take the first neighbour that resolves to a row for this scope/lang/org
        - include source_text when distance is small enough for a reference pair
    """
    n = int(matrix.shape[0]) if matrix.ndim == 2 else 0
    results: list[dict | None] = [None] * n
    if n == 0 or idx is None or idx.ntotal == 0:
        return results

    k = min(3, idx.ntotal)
    scores, indices = idx.search(matrix, k=k)

    candidates: set[int] = set()
    for row_scores, row_indices in zip(scores, indices):
        for score, f_index in zip(row_scores, row_indices):
            if f_index < 0 or score > _MAX_DISTANCE:
                continue
            candidates.add(int(f_index))

    if not candidates:
        return results

    row_by_index = _resolve_candidates(candidates, normalized, org_id, project_id, scope)

    for i, (row_scores, row_indices) in enumerate(zip(scores, indices)):
        for score, f_index in zip(row_scores, row_indices):
            if f_index < 0 or score > _MAX_DISTANCE:
                continue
            row = row_by_index.get(int(f_index))
            if row is None:
                continue  # vector exists but no row for this scope/lang/org — try next k
            result = {
                "translated_text": row["translated_text"],
                "score": float(score),
            }
            if score >= _REFERENCE_DISTANCE:
                result["source_text"] = row["source_text"]
            results[i] = result
            break

    return results


def faiss_search_batch(
    embeddings: np.ndarray,
    target_lang: str,
    org_id: str,
    project_id: str | None = None,
) -> list[dict | None]:
    """
    Batched nearest-neighbour search with project-first / org-fallback scoping.

    When project_id is provided, every query is first searched against the
    project index. Any query with no sufficient match then falls through to the
    org/fallback index. When project_id is None, only the org index is searched
    (the original behaviour).

    Args:
        embeddings: 2D array of shape (N, dim) — one query vector per row.
    Returns:
        A list of length N; entry i is a faiss_search-style dict or None.
    """
    n = int(embeddings.shape[0]) if embeddings.ndim == 2 else 0
    if n == 0:
        return []

    normalized = _normalize_lang(target_lang)
    matrix = embeddings.astype("float32")
    results: list[dict | None] = [None] * n

    # ── Project-scoped pass ────────────────────────────────────────────────────
    if project_id:
        proj_idx = _get_index(project_id)
        results = _search_with_index(proj_idx, matrix, normalized, org_id, project_id, "project")

    # ── Org-scoped fallthrough for any query still unmatched ───────────────────
    missing = [i for i, r in enumerate(results) if r is None]
    if missing:
        org_idx = _get_index(None)
        sub_matrix = matrix[missing]
        org_results = _search_with_index(org_idx, sub_matrix, normalized, org_id, None, "org")
        for position, i in enumerate(missing):
            results[i] = org_results[position]

    return results


def faiss_search(
    embedding: np.ndarray,
    target_lang: str,
    org_id: str,
    project_id: str | None = None,
) -> dict | None:
    """
    Single-query convenience wrapper around faiss_search_batch.

    Returns:
        {source_text, translated_text, score}  — for guided LLM (score < 0.95)
        {translated_text, score}               — for direct use  (score >= 0.95)
        None                                   — no hit above threshold
    """
    vector = embedding.reshape(1, -1).astype("float32")
    results = faiss_search_batch(vector, target_lang, org_id, project_id)
    return results[0] if results else None
