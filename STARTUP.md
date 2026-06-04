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

## 3. FAISS Vector Database (Optional / For Setup)

If you need to rebuild the translation memory FAISS index locally (since the index file is gitignored), run the following command from the project root:

```bash
python rebuild_index.py
```
