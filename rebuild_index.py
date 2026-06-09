"""
rebuild_index.py
----------------
Full FAISS index rebuild from Supabase translation_memory table.

Use this for:
  - First-time local setup (FAISS index file is gitignored)
  - Index corruption recovery
  - Pulling a fresh DB copy without the matching index file

Normal day-to-day operation uses incremental indexing via POST /api/approve.
Only run this script when you need to bootstrap or repair from scratch.

Usage (from repo root):
    python rebuild_index.py

The script will:
  1. Fetch all rows from translation_memory ordered by created_at ASC
  2. Build a fresh IndexFlatL2(384)
  3. Embed each source_text and add to the index
  4. Batch-update Supabase rows with their assigned faiss_index
  5. Save the index to ai/data/translations.index

Requirements: backend/.env or .env must have SUPABASE_URL and SUPABASE_KEY.
"""

import os
import sys
import faiss
import numpy as np
from dotenv import load_dotenv
from supabase import create_client

# ── Load env ──────────────────────────────────────────────────────────────────
_root = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(_root, "backend", ".env"))
load_dotenv(dotenv_path=os.path.join(_root, ".env"))   # fallback

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("[rebuild] ERROR: SUPABASE_URL or SUPABASE_KEY not set. Check backend/.env")
    sys.exit(1)

INDEX_PATH = os.path.join(_root, "ai", "data", "translations.index")
EMBEDDING_DIM = 384

# ── Add project root to sys.path so ai.embeddings can be imported ─────────────
sys.path.insert(0, _root)
from ai.embeddings import generate_embeddings  # noqa: E402


def main():
    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # ── 1. Fetch all rows, oldest first (stable ordering for index positions) ──
    print("[rebuild] Fetching all rows from translation_memory...")
    response = (
        client.table("translation_memory")
        .select("id, source_text")
        .order("created_at", desc=False)
        .execute()
    )
    rows = response.data
    print(f"[rebuild] Found {len(rows)} rows.")

    if not rows:
        print("[rebuild] Nothing to index. Exiting.")
        return

    # ── 2. Build fresh index ──────────────────────────────────────────────────
    fresh_index = faiss.IndexFlatL2(EMBEDDING_DIM)

    # ── 3. Embed and add ──────────────────────────────────────────────────────
    updates: list[dict] = []  # {id, faiss_index}

    for i, row in enumerate(rows):
        embedding = generate_embeddings(row["source_text"])
        vector = embedding.reshape(1, -1).astype("float32")
        assigned = fresh_index.ntotal
        fresh_index.add(vector)
        updates.append({"id": row["id"], "faiss_index": assigned})

        if (i + 1) % 50 == 0 or (i + 1) == len(rows):
            print(f"[rebuild]   {i + 1}/{len(rows)} embedded...")

    # ── 4. Batch-update Supabase with new faiss_index values ─────────────────
    print(f"[rebuild] Updating {len(updates)} rows in Supabase...")
    CHUNK = 50  # Supabase upsert batch size
    for start in range(0, len(updates), CHUNK):
        chunk = updates[start:start + CHUNK]
        for item in chunk:
            client.table("translation_memory").update(
                {"faiss_index": item["faiss_index"]}
            ).eq("id", item["id"]).execute()
    print("[rebuild] Supabase update complete.")

    # ── 5. Save index to disk ─────────────────────────────────────────────────
    os.makedirs(os.path.dirname(INDEX_PATH), exist_ok=True)
    faiss.write_index(fresh_index, INDEX_PATH)
    print(f"[rebuild] Index saved to {INDEX_PATH}  (ntotal={fresh_index.ntotal})")
    print("[rebuild] Done.")


if __name__ == "__main__":
    main()
