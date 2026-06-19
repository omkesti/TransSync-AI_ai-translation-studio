"""
projects.py
───────────
Routes (all mounted under /api):
    GET    /api/projects                         — list projects for the user's org (+ progress)
    POST   /api/projects                         — create a project (+ empty FAISS index)
    GET    /api/projects/{project_id}            — one project with documents + progress stats
    PATCH  /api/projects/{project_id}            — update metadata (name, status, deadline, …)
    PATCH  /api/projects/{project_id}/archive    — archive a project
    POST   /api/projects/{project_id}/documents  — create a document inside the project
    POST   /api/projects/{project_id}/members    — add a member (per-project role override)
    DELETE /api/projects/{project_id}/members/{user_id}  — remove a member

A project is the new scoping layer between the organization and the actual
translation work. Every endpoint resolves org_id from the JWT (via
get_current_user) and verifies the project belongs to that org, so a user can
never read or mutate another organization's projects — the existing org-level
RBAC is layered on top, never replaced.
"""

from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from backend.auth.jwt_bearer import CurrentUser, get_current_user, require_role
from backend.services.supabase_client import (
    get_client,
    create_project,
    fetch_projects,
    fetch_project,
    update_project,
    fetch_project_members,
    add_project_member,
    remove_project_member,
    fetch_documents,
    fetch_document_summaries_for_org,
    create_document,
)
from backend.utils.language_codes import normalize_lang_code

router = APIRouter()

# Roles allowed to create / edit projects (viewers are read-only).
_PROJECT_WRITE_ROLES = ("owner", "admin", "translator")
# Roles allowed to manage members / archive (org administrators).
_PROJECT_ADMIN_ROLES = ("owner", "admin")

_VALID_STATUSES = {"Draft", "Active", "In Review", "Completed", "Archived"}
_VALID_DOMAINS = {"Legal", "Medical", "Technical", "Marketing", "General"}
_VALID_MEMBER_ROLES = {"Admin", "Translator", "Reviewer"}
_TIERS = ("tm_exact", "faiss_direct", "llm_guided", "llm_cold")


# ── Schemas ───────────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    source_language: str = Field(default="en")
    target_language: Optional[str] = None
    domain: Optional[str] = None
    deadline: Optional[date] = None
    inherit_org_glossary: bool = True
    status: str = "Draft"


class ProjectPatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    source_language: Optional[str] = None
    target_language: Optional[str] = None
    domain: Optional[str] = None
    deadline: Optional[date] = None
    inherit_org_glossary: Optional[bool] = None
    status: Optional[str] = None


class MemberAdd(BaseModel):
    user_id: str = Field(..., description="Supabase user_id of an existing org member.")
    role: str = Field(default="Translator", description="Admin | Translator | Reviewer")


class DocumentCreate(BaseModel):
    filename: str = Field(default="document")
    raw_text: str = Field(default="")
    source_lang: str = Field(default="en")
    target_lang: Optional[str] = None
    sentence_count: int = 0
    stage: str = "uploaded"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _aggregate_from_summaries(rows: list[dict]) -> dict:
    """Progress stats from lightweight document summaries (no tier breakdown)."""
    total_sentences = sum((r.get("sentence_count") or 0) for r in rows)
    total_reviewed = sum((r.get("reviewed_count") or 0) for r in rows)
    last_activity = ""
    for r in rows:
        ua = r.get("updated_at") or ""
        if ua > last_activity:
            last_activity = ua
    return {
        "document_count": len(rows),
        "total_sentences": total_sentences,
        "reviewed_count": total_reviewed,
        "progress_percent": round((total_reviewed / total_sentences) * 100) if total_sentences else 0,
        "last_activity": last_activity,
    }


def _tier_breakdown(documents: list[dict]) -> dict:
    """Aggregate match_type tier counts across a project's documents' results."""
    breakdown = {t: 0 for t in _TIERS}
    for d in documents:
        for r in (d.get("results") or []):
            mt = r.get("match_type")
            if mt in breakdown:
                breakdown[mt] += 1
    return breakdown


def _require_project(project_id: str, user: CurrentUser) -> dict:
    """Fetch a project scoped to the user's org, or raise 404."""
    project = fetch_project(project_id, user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    return project


def _validate_metadata(status: Optional[str], domain: Optional[str], target_language: Optional[str]):
    if status is not None and status not in _VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(sorted(_VALID_STATUSES))}")
    if domain not in (None, "") and domain not in _VALID_DOMAINS:
        raise HTTPException(status_code=400, detail=f"Invalid domain. Must be one of: {', '.join(sorted(_VALID_DOMAINS))}")
    if target_language not in (None, ""):
        if not normalize_lang_code(target_language):
            raise HTTPException(status_code=400, detail="target_language is invalid.")


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/projects")
async def list_projects(current_user: CurrentUser = Depends(get_current_user)):
    """List every project in the user's org, each annotated with progress stats
    and member rows so the dashboard can render project cards."""
    projects = fetch_projects(current_user.org_id)
    if not projects:
        return {"count": 0, "projects": []}

    # One lightweight query for all org documents; grouped by project in Python.
    summaries = fetch_document_summaries_for_org(current_user.org_id)
    by_project: dict[str, list[dict]] = {}
    for row in summaries:
        by_project.setdefault(str(row.get("project_id")), []).append(row)

    enriched = []
    for p in projects:
        stats = _aggregate_from_summaries(by_project.get(str(p["id"]), []))
        members = fetch_project_members(p["id"])
        enriched.append({**p, "stats": stats, "members": members})

    return {"count": len(enriched), "projects": enriched}


@router.post("/projects", status_code=201)
async def create_new_project(body: ProjectCreate, current_user: CurrentUser = Depends(get_current_user)):
    """Create a project and provision an empty project-scoped FAISS index."""
    require_role(current_user, *_PROJECT_WRITE_ROLES)
    _validate_metadata(body.status, body.domain, body.target_language)

    fields = body.model_dump()
    if fields.get("target_language"):
        fields["target_language"] = normalize_lang_code(fields["target_language"]) or fields["target_language"]
    if fields.get("source_language"):
        fields["source_language"] = normalize_lang_code(fields["source_language"]) or fields["source_language"]
    if fields.get("deadline"):
        fields["deadline"] = fields["deadline"].isoformat()

    try:
        project = create_project(current_user.org_id, current_user.user_id, fields)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create project: {str(e)}")

    # Provision an empty FAISS index file so the AI layer has a place to write
    # project-scoped vectors. Best-effort: a failure here must not orphan the
    # project row — the index is also lazily created on first approval.
    try:
        from ai.vector_store import create_project_index
        create_project_index(str(project["id"]))
    except Exception as e:
        print(f"[projects] create_project_index failed (non-fatal, will lazily create): {e}")

    # Creator becomes a project Admin by default.
    try:
        add_project_member(str(project["id"]), current_user.user_id, "Admin")
    except Exception as e:
        print(f"[projects] could not add creator as member (non-fatal): {e}")

    return project


@router.get("/projects/{project_id}")
async def get_project_detail(project_id: str, current_user: CurrentUser = Depends(get_current_user)):
    """One project with its full document list, progress stats and tier breakdown."""
    project = _require_project(project_id, current_user)
    documents = fetch_documents(project_id)
    members = fetch_project_members(project_id)

    stats = _aggregate_from_summaries(documents)
    stats["tier_breakdown"] = _tier_breakdown(documents)

    return {
        "project": project,
        "documents": documents,
        "members": members,
        "stats": stats,
    }


@router.patch("/projects/{project_id}")
async def patch_project(project_id: str, body: ProjectPatch, current_user: CurrentUser = Depends(get_current_user)):
    """Update project metadata (name, status, deadline, domain, languages, …)."""
    require_role(current_user, *_PROJECT_WRITE_ROLES)
    _require_project(project_id, current_user)
    _validate_metadata(body.status, body.domain, body.target_language)

    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if not patch:
        raise HTTPException(status_code=400, detail="No fields provided to update.")
    if patch.get("target_language"):
        patch["target_language"] = normalize_lang_code(patch["target_language"]) or patch["target_language"]
    if patch.get("source_language"):
        patch["source_language"] = normalize_lang_code(patch["source_language"]) or patch["source_language"]
    if patch.get("deadline"):
        patch["deadline"] = patch["deadline"].isoformat()

    try:
        updated = update_project(project_id, current_user.org_id, patch)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update project: {str(e)}")
    return updated


@router.patch("/projects/{project_id}/archive")
async def archive_project(project_id: str, current_user: CurrentUser = Depends(get_current_user)):
    """Archive a project (soft state — nothing is deleted)."""
    require_role(current_user, *_PROJECT_ADMIN_ROLES)
    _require_project(project_id, current_user)
    try:
        updated = update_project(project_id, current_user.org_id, {"status": "Archived"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to archive project: {str(e)}")
    return updated


@router.post("/projects/{project_id}/documents", status_code=201)
async def add_document(project_id: str, body: DocumentCreate, current_user: CurrentUser = Depends(get_current_user)):
    """Create a document record inside a project (called after upload extracts text)."""
    require_role(current_user, *_PROJECT_WRITE_ROLES)
    _require_project(project_id, current_user)

    fields = body.model_dump()
    if fields.get("target_lang"):
        fields["target_lang"] = normalize_lang_code(fields["target_lang"]) or fields["target_lang"]
    try:
        document = create_document(project_id, current_user.org_id, current_user.user_id, fields)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create document: {str(e)}")
    return document


@router.post("/projects/{project_id}/members", status_code=201)
async def add_member(project_id: str, body: MemberAdd, current_user: CurrentUser = Depends(get_current_user)):
    """Add a per-project role override for an existing org member."""
    require_role(current_user, *_PROJECT_ADMIN_ROLES)
    _require_project(project_id, current_user)

    if body.role not in _VALID_MEMBER_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(sorted(_VALID_MEMBER_ROLES))}")

    # The user must belong to the same org as the project (defence-in-depth: a
    # project member is always first an org member).
    client = get_client()
    membership = (
        client.table("memberships")
        .select("user_id")
        .eq("user_id", body.user_id)
        .eq("org_id", current_user.org_id)
        .limit(1)
        .execute()
    )
    if not membership.data:
        raise HTTPException(status_code=400, detail="User is not a member of this organization.")

    try:
        member = add_project_member(project_id, body.user_id, body.role)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add member: {str(e)}")
    return member


@router.delete("/projects/{project_id}/members/{user_id}", status_code=204)
async def delete_member(project_id: str, user_id: str, current_user: CurrentUser = Depends(get_current_user)):
    """Remove a project member."""
    require_role(current_user, *_PROJECT_ADMIN_ROLES)
    _require_project(project_id, current_user)
    try:
        removed = remove_project_member(project_id, user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to remove member: {str(e)}")
    if not removed:
        raise HTTPException(status_code=404, detail="Member not found on this project.")
