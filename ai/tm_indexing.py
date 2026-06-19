"""
tm_indexing.py
--------------
Approve-time FAISS indexing orchestration.

Called by backend/routes/memory.py → POST /api/approve BEFORE the Supabase
bulk insert so every new LLM-translated row gets a valid faiss_index assigned.

Only rows that are missing a faiss_index are processed — rows that already
have one (e.g. faiss_direct hits passed through by the frontend) are skipped.
"""

from ai.embeddings import generate_embeddings
from ai.vector_store import add_embeddings_batch


def index_approved_rows(rows: list[dict], project_id: str | None = None) -> list[dict]:
    """
    For each row that is missing a faiss_index:
      1. Generate source-text embedding via the shared model.
      2. Assign a faiss_index via vector_store.add_embeddings_batch()
         (adds all vectors at once, one save_index() call).

    When project_id is supplied the vectors are written to that project's FAISS
    index (so the assigned faiss_index is a position within the project index);
    otherwise they go to the org/fallback index — the original behaviour. The
    whole approve batch belongs to a single document, hence a single project_id.

    Returns the same rows list with faiss_index populated.
    Rows that already have a faiss_index are passed through unchanged.

    Raises an exception if FAISS write fails — callers should propagate
    this as a 500 so Supabase is not written with orphan null faiss_index rows.
    """
    # Split into needs-indexing vs already-indexed
    to_index: list[tuple[int, dict]] = []  # (position-in-rows, row)
    for i, row in enumerate(rows):
        if row.get("faiss_index") is None:
            to_index.append((i, row))

    if not to_index:
        return rows  # nothing to do — all rows already have faiss_index

    # Generate all embeddings
    embeddings = [generate_embeddings(row["source_text"]) for _, row in to_index]

    # Batch-add to FAISS (project-scoped when given) — one disk write
    assigned_indices = add_embeddings_batch(embeddings, project_id=project_id)

    # Write back into the rows list
    for (i, row), faiss_idx in zip(to_index, assigned_indices):
        rows[i]["faiss_index"] = faiss_idx

    return rows
