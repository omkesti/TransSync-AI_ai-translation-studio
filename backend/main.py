from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routes import upload, translate, memory, validate, glossary, export, export_batch, auth, projects, documents

app = FastAPI(
    title="TransSync AI",
    description="Enterprise AI Translation Platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router,    prefix="/api", tags=["Upload"])
app.include_router(translate.router, prefix="/api", tags=["Translate"])
app.include_router(memory.router,    prefix="/api", tags=["Memory"])
app.include_router(validate.router,  prefix="/api", tags=["Validate"])
app.include_router(glossary.router,  prefix="/api", tags=["Glossary"])
app.include_router(export.router,       prefix="/api", tags=["Export"])
app.include_router(export_batch.router, prefix="/api", tags=["Export"])
app.include_router(auth.router,         prefix="/api", tags=["Auth"])
app.include_router(projects.router,     prefix="/api", tags=["Projects"])
app.include_router(documents.router,    prefix="/api", tags=["Documents"])

@app.get("/")
def health_check():
    return {"status": "TransSync AI backend is running"}

