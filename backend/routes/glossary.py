"""
glossary.py
-----------
Routes:
    GET    /api/glossary           — list all glossary terms (filter by ?target_lang, ?search)
    POST   /api/glossary           — create a new term
    PATCH  /api/glossary/{id}      — update a term (status, target_term, category)
    DELETE /api/glossary/{id}      — delete a term

Supabase table: glossary
    id          uuid    (PK, auto)
    source_term text    (source-language term, always English)
    target_term text    (translated term)
    source_lang varchar (default "en")
    target_lang varchar (e.g. "fr", "de")
    category    varchar ("TECHNICAL", "LEGAL", "ESG", ...)
    status      varchar ("PENDING" | "VERIFIED")
    created_at  timestamp (auto)

SQL to create the table in Supabase:
    CREATE TABLE glossary (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      source_term text NOT NULL,
      target_term text NOT NULL,
      source_lang varchar DEFAULT 'en',
      target_lang varchar NOT NULL,
      category    varchar DEFAULT '',
      status      varchar DEFAULT 'PENDING',
      created_at  timestamp DEFAULT now()
    );
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional
from backend.services.supabase_client import (
    fetch_all_glossary,
    insert_glossary_term,
    update_glossary_term,
    delete_glossary_term,
)

router = APIRouter()


# ── Request / Response schemas ────────────────────────────────────────────────

class GlossaryTermCreate(BaseModel):
    source_term: str = Field(..., description="Source-language term (English).")
    target_term: str = Field(..., description="Translated term in the target language.")
    target_lang: str = Field(..., description="BCP-47 target language code, e.g. 'fr'.")
    source_lang: str = Field(default="en", description="BCP-47 source language code.")
    category:    str = Field(default="", description="Term category, e.g. 'TECHNICAL', 'LEGAL'.")
    status:      str = Field(default="PENDING", description="'PENDING' or 'VERIFIED'.")

    class Config:
        json_schema_extra = {
            "example": {
                "source_term": "Neural Interface",
                "target_term": "Interface Neurale",
                "target_lang": "fr",
                "category":    "TECHNICAL",
                "status":      "PENDING",
            }
        }


class GlossaryTermPatch(BaseModel):
    target_term: Optional[str] = None
    category:    Optional[str] = None
    status:      Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {"status": "VERIFIED"}
        }


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/glossary")
async def list_glossary(
    target_lang: Optional[str] = Query(
        default=None,
        description="Filter by target language code, e.g. 'fr'.",
    ),
    search: Optional[str] = Query(
        default=None,
        description="Case-insensitive substring match on source_term.",
    ),
):
    """
    GET /api/glossary
    GET /api/glossary?target_lang=fr
    GET /api/glossary?search=contract

    Returns all glossary terms ordered newest-first.

    Response shape:
        {
            "count": 5,
            "terms": [
                {
                    "id":          "uuid...",
                    "source_term": "Neural Interface",
                    "target_term": "Interface Neurale",
                    "source_lang": "en",
                    "target_lang": "fr",
                    "category":    "TECHNICAL",
                    "status":      "VERIFIED",
                    "created_at":  "2024-06-01T..."
                },
                ...
            ]
        }
    """
    try:
        terms = fetch_all_glossary(target_lang=target_lang, search=search)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch glossary: {str(e)}")

    return {"count": len(terms), "terms": terms}


@router.post("/glossary", status_code=201)
async def create_glossary_term(body: GlossaryTermCreate):
    """
    POST /api/glossary

    Creates a new glossary term.

    Returns the newly created term row.
    """
    try:
        term = insert_glossary_term(body.model_dump())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create glossary term: {str(e)}")

    return term


@router.patch("/glossary/{term_id}")
async def patch_glossary_term(term_id: str, body: GlossaryTermPatch):
    """
    PATCH /api/glossary/{id}

    Partially updates an existing glossary term.
    Only fields provided in the request body are updated.

    Returns the updated term row.
    """
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if not patch:
        raise HTTPException(status_code=400, detail="No fields provided to update.")

    try:
        updated = update_glossary_term(term_id, patch)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update glossary term: {str(e)}")

    if not updated:
        raise HTTPException(status_code=404, detail=f"Term with id '{term_id}' not found.")

    return updated


@router.delete("/glossary/{term_id}", status_code=204)
async def remove_glossary_term(term_id: str):
    """
    DELETE /api/glossary/{id}

    Deletes a glossary term by id.
    Returns 204 No Content on success, 404 if not found.
    """
    try:
        deleted = delete_glossary_term(term_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete glossary term: {str(e)}")

    if not deleted:
        raise HTTPException(status_code=404, detail=f"Term with id '{term_id}' not found.")
