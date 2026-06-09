# TransSync AI — Startup Instructions

This guide provides the necessary commands to run both the backend server and the frontend application locally.

## 1. Backend Server (FastAPI)

The backend runs on Python using Uvicorn. Make sure your virtual environment is activated before running the command.

**Command:**
```bash
uvicorn backend.main:app --reload
```
- The backend API will be available at: `http://localhost:8000`
- The interactive Swagger API docs will be at: `http://localhost:8000/docs`

---

## 2. Frontend Application (React + Vite)

The frontend is located in the `frontend_proto` folder. You need to navigate into that folder and start the Vite development server.

**Commands:**
```bash
cd frontend_proto
npm install      # (Only needed the first time or when dependencies change)
npm run dev
```
- The frontend UI will be available at: `http://localhost:5173`

---

## 3. FAISS Vector Index

The FAISS index file (`ai/data/translations.index`) is gitignored.

**Normal operation:** The index is updated automatically every time translations
are approved via the Review UI (`POST /api/approve` calls `ai/tm_indexing.py`).
No manual action is needed during day-to-day use.

**First-time setup / recovery:** If you are running the project locally for the
first time, or if the index file is missing/corrupt, run the rebuild script from
the repo root to regenerate it from the Supabase database:

```bash
python rebuild_index.py
```

This will:
1. Fetch all rows from `translation_memory` (ordered by `created_at` ASC)
2. Build a fresh `IndexFlatL2(384)` index
3. Embed each `source_text` and assign `faiss_index` positions
4. Update each Supabase row with its new `faiss_index`
5. Save the index to `ai/data/translations.index`

> **Note:** Only needed once per machine. After that, `POST /api/approve` keeps
> the index in sync incrementally.
