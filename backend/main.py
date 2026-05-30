from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routes import upload, translate, memory, validate, glossary

app = FastAPI(
    title="TransSync AI",
    description="Enterprise AI Translation Platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router,    prefix="/api", tags=["Upload"])
app.include_router(translate.router, prefix="/api", tags=["Translate"])
app.include_router(memory.router,    prefix="/api", tags=["Memory"])
app.include_router(validate.router,  prefix="/api", tags=["Validate"])
app.include_router(glossary.router,  prefix="/api", tags=["Glossary"])

@app.get("/")
def health_check():
    return {"status": "TransSync AI backend is running"}

