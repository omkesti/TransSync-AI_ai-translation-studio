"""
supabase_client.py
------------------
Single place for all Supabase interactions.
Reads credentials from .env at the repo root.

Dependencies:
    pip install supabase python-dotenv

Table used:  translation_memory
    id            uuid  (PK, auto)
    source_text   text
    translated_text text
    source_lang   varchar   (always "en")
    target_lang   varchar   (e.g. "fr", "de")
    faiss_index   int4      (position in Om's FAISS index file)
    match_type    varchar   ("tm_exact" | "faiss_direct" | "llm_guided" | "llm_cold")
    created_at    timestamp (auto)
"""

import os
import base64
from datetime import datetime, timezone
from typing import Optional
from dotenv import load_dotenv
from supabase import create_client, Client

from backend.utils.language_codes import glossary_lookup_codes, normalize_lang_code

# Load .env — first try the backend/ folder (where .env lives),
# then fall back to the repo root in case it's been moved there.
_this_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(_this_dir, '..', '.env'))        # backend/.env
load_dotenv(dotenv_path=os.path.join(_this_dir, '..', '..', '.env'))  # repo-root/.env (fallback)

SUPABASE_URL: str = os.environ.get("SUPABASE_URL")
SUPABASE_KEY: str = os.environ.get("SUPABASE_KEY")

_client: Client = None  # singleton — initialised on first call to get_client()

def get_client() -> Client:
    """Returns a singleton Supabase client (initialised once)."""
    global _client
    if _client is None:
        try:
            _client = create_client(SUPABASE_URL, SUPABASE_KEY)
            print("Supabase client created successfully.")
        except Exception as e:
            print(f"Error creating Supabase client: {e}")
            raise
    return _client


# ── Read ──────────────────────────────────────────────────────────────────────

def fetch_all_memory(
    org_id: str,
    target_lang: Optional[str] = None,
    project_id: Optional[str] = None,
) -> list[dict]:
    """
    Returns all rows from translation_memory for a given org.
    Optionally filter by target_lang (e.g. "fr") and/or project_id.

    When project_id is provided only that project's rows are returned; otherwise
    every org row (project-scoped and org-scoped alike) is returned, preserving
    the original behaviour.
    """
    client = get_client()
    query = client.table("translation_memory").select("*").eq("org_id", org_id).order("created_at", desc=True)

    if target_lang:
        query = query.eq("target_lang", target_lang)
    if project_id:
        query = query.eq("project_id", project_id)

    response = query.execute()
    return response.data


def fetch_exact_match(source_text: str, target_lang: str, org_id: str) -> Optional[dict]:
    """
    Looks up an exact source_text + target_lang match in Supabase, scoped to org.
    Returns the first matching row or None.
    """
    client = get_client()
    response = (
        client.table("translation_memory")
        .select("*")
        .eq("source_text", source_text)
        .eq("target_lang", target_lang)
        .eq("org_id", org_id)
        .limit(1)
        .execute()
    )
    rows = response.data
    return rows[0] if rows else None


# ── Write ─────────────────────────────────────────────────────────────────────

def insert_translation(
    source_text: str,
    translated_text: str,
    target_lang: str,
    match_type: str,
    faiss_index: Optional[int] = None,
    source_lang: str = "en",
) -> dict:
    """
    Inserts ONE approved/edited translation into translation_memory.

    Called by:  backend/routes/memory.py  →  POST /api/approve
    Only call this for human-approved or human-edited sentences.
    Never call for rejected sentences.
    """
    client = get_client()
    row = {
        "source_text":     source_text,
        "translated_text": translated_text,
        "source_lang":     source_lang,
        "target_lang":     target_lang,
        "match_type":      match_type,
    }
    if faiss_index is not None:
        row["faiss_index"] = faiss_index

    response = client.table("translation_memory").insert(row).execute()
    return response.data[0]


def bulk_insert_translations(rows: list[dict]) -> list[dict]:
    """
    Inserts multiple approved translations in one DB call.
    Each dict in rows must match the insert_translation() parameter shape:
        {source_text, translated_text, target_lang, match_type, faiss_index?, source_lang?}

    Called by:  backend/routes/memory.py  →  POST /api/approve  (batch mode)
    """
    client = get_client()
    formatted = [
        {
            "source_text":     r["source_text"],
            "translated_text": r["translated_text"],
            "source_lang":     r.get("source_lang", "en"),
            "target_lang":     r["target_lang"],
            "match_type":      r["match_type"],
            "org_id":          r["org_id"],
            # project_id is optional: present for approvals made inside a project,
            # omitted (→ NULL) for org-scoped approvals.
            **({"project_id": r["project_id"]} if r.get("project_id") else {}),
            **({("faiss_index"): r["faiss_index"]} if r.get("faiss_index") is not None else {}),
        }
        for r in rows
    ]

    try:
        response = client.table("translation_memory").insert(formatted).execute()
    except Exception as e:
        # Surface the real PostgREST error (RLS denial, missing column, bad key,
        # constraint violation) instead of letting it bubble up unlabelled.
        print(f"[tm] bulk_insert_translations FAILED ({len(formatted)} rows): {e}")
        raise

    saved = response.data or []
    print(f"[tm] bulk_insert_translations: attempted={len(formatted)} persisted={len(saved)}")

    # A successful insert under the service-role key RETURNS the inserted rows.
    # Zero rows back for a non-empty insert almost always means SUPABASE_KEY is
    # NOT the service-role key: an RLS policy allowed the INSERT (the row may
    # still persist) but blocked the RETURNING SELECT, so the API hands back an
    # empty array. We warn loudly (rather than raise) because the row CAN persist
    # in that case — the log line above is the definitive attempted-vs-persisted
    # signal for diagnosing "approve says OK but I see no rows".
    if formatted and not saved:
        print(
            "[tm] WARNING: insert returned 0 rows. SUPABASE_KEY is likely the anon "
            "key, not the service-role key — RLS is hiding the result (and may be "
            "dropping the write). Set SUPABASE_KEY to the service-role key."
        )

    return saved


# ── Pipeline events (analytics) ───────────────────────────────────────────────
# Table: pipeline_events
#   id              uuid (PK, auto)
#   org_id          text
#   source_text     text
#   translated_text text
#   source_lang     varchar (default "en")
#   target_lang     varchar
#   match_type      varchar ("tm_exact" | "faiss_direct" | "llm_guided" | "llm_cold")
#   source_document text    (original upload filename, "" when unknown)
#   created_at      timestamp (auto)
#
# Unlike translation_memory (which only stores APPROVED LLM translations),
# pipeline_events records EVERY processed sentence at translate-time — including
# TM-exact and FAISS-direct hits that are never re-stored in the TM. This is the
# source of truth for the Dashboard's tier breakdown and "recent documents".

def log_pipeline_events(rows: list[dict]) -> None:
    """
    Best-effort insert of per-sentence pipeline events.

    NEVER raises — analytics logging must never break a translation request.
    A failure here (e.g. the table doesn't exist yet) is logged and swallowed.
    """
    if not rows:
        return
    try:
        client = get_client()
        formatted = [
            {
                "org_id":          r["org_id"],
                "user_id":         r.get("user_id"),
                "source_text":     r.get("source_text", ""),
                "translated_text": r.get("translated_text", ""),
                "source_lang":     r.get("source_lang", "en"),
                "target_lang":     r.get("target_lang", ""),
                "match_type":      r.get("match_type", ""),
                "source_document": r.get("source_document", "") or "",
            }
            for r in rows
        ]
        client.table("pipeline_events").insert(formatted).execute()
    except Exception as e:
        print(f"[pipeline_events] log failed (non-fatal): {e}")


def fetch_pipeline_events(org_id: str) -> list[dict]:
    """
    Returns pipeline_events rows for an org, newest first.

    Used by GET /api/dashboard-stats. The caller is expected to guard against
    exceptions (e.g. the table not existing yet) and fall back to an empty list.
    """
    client = get_client()
    response = (
        client.table("pipeline_events")
        .select("*")
        .eq("org_id", org_id)
        .order("created_at", desc=True)
        .execute()
    )
    return response.data


def fetch_user_pipeline_events(org_id: str, user_id: str) -> list[dict]:
    """
    Returns pipeline_events rows for ONE user within an org, newest first.

    Powers the Profile page's "documents you have translated" view. Scoped by
    org_id as well as user_id so it never leaks events across organizations.
    Rows written before migration 002 (user_id NULL) are naturally excluded.
    """
    client = get_client()
    response = (
        client.table("pipeline_events")
        .select("*")
        .eq("org_id", org_id)
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return response.data


# ── Profile (memberships.display_name) ────────────────────────────────────────

def update_display_name(user_id: str, org_id: str, display_name: str) -> dict:
    """
    Updates the user's display_name on their membership row, scoped to org.

    Called by: PATCH /api/auth/profile. Returns the updated membership row
    (or {} if no row matched).
    """
    client = get_client()
    response = (
        client.table("memberships")
        .update({"display_name": display_name})
        .eq("user_id", user_id)
        .eq("org_id", org_id)
        .execute()
    )
    rows = response.data
    return rows[0] if rows else {}


# ── Glossary ──────────────────────────────────────────────────────────────────
# Table: glossary
#   id          uuid (PK, auto)
#   source_term text
#   target_term text
#   source_lang varchar  (default "en")
#   target_lang varchar
#   category    varchar  ("TECHNICAL", "LEGAL", "ESG", ...)
#   status      varchar  ("PENDING" | "VERIFIED")
#   created_at  timestamp (auto)

def fetch_all_glossary(
    org_id: str,
    target_lang: Optional[str] = None,
    search: Optional[str] = None,
    project_id: Optional[str] = None,
) -> list[dict]:
    """
    Returns rows from the glossary table for a given org, newest first.
    Optionally filter by target_lang and/or search term (applied to source_term).

    Scoping:
        • project_id given → only that project's terms (the project Glossary tab).
        • project_id None  → only org-level terms (project_id IS NULL), so the
          global Glossary page never mixes in project-specific terms.
    """
    client = get_client()
    query = client.table("glossary").select("*").eq("org_id", org_id).order("created_at", desc=True)
    if target_lang:
        normalized = normalize_lang_code(target_lang)
        if normalized:
            query = query.eq("target_lang", normalized)
    if search:
        query = query.ilike("source_term", f"%{search}%")
    if project_id:
        query = query.eq("project_id", project_id)
    else:
        query = query.is_("project_id", "null")
    response = query.execute()
    return response.data


def insert_glossary_term(row: dict) -> dict:
    """
    Inserts a new term into the glossary table.
    row must contain: source_term, target_term, target_lang, org_id
    Optional: category, status, source_lang
    """
    client = get_client()
    payload = {
        "source_term": row["source_term"],
        "target_term": row["target_term"],
        "target_lang": normalize_lang_code(row["target_lang"]) or row["target_lang"],
        "source_lang": normalize_lang_code(row.get("source_lang", "en")) or row.get("source_lang", "en"),
        "category":    row.get("category", ""),
        "status":      row.get("status", "PENDING"),
        "org_id":      row["org_id"],
    }
    # project_id is optional: set for project-scoped terms, omitted (→ NULL) for
    # org-level terms.
    if row.get("project_id"):
        payload["project_id"] = row["project_id"]
    response = client.table("glossary").insert(payload).execute()
    return response.data[0]


def update_glossary_term(term_id: str, patch: dict) -> dict:
    """
    Partially updates a glossary term by id.
    patch may contain any subset of: target_term, category, status.
    """
    client = get_client()
    response = (
        client.table("glossary")
        .update(patch)
        .eq("id", term_id)
        .execute()
    )
    rows = response.data
    return rows[0] if rows else {}


def delete_glossary_term(term_id: str) -> bool:
    """
    Deletes a glossary term by id.
    Returns True if a row was deleted, False otherwise.
    """
    client = get_client()
    response = (
        client.table("glossary")
        .delete()
        .eq("id", term_id)
        .execute()
    )
    return len(response.data) > 0


def _fetch_verified_terms_for_scope(
    client, code: str, org_id: str, project_id: Optional[str], scope: str
) -> dict:
    """Fetch VERIFIED { source_term_lower: target_term } for one language code + scope."""
    query = (
        client.table("glossary")
        .select("source_term, target_term")
        .eq("target_lang", code)
        .eq("status", "VERIFIED")
        .eq("org_id", org_id)
    )
    if scope == "project":
        query = query.eq("project_id", project_id)
    else:
        query = query.is_("project_id", "null")
    response = query.execute()
    return {row["source_term"].lower(): row["target_term"] for row in (response.data or [])}


def fetch_verified_glossary_terms(
    target_lang: str,
    org_id: str,
    project_id: Optional[str] = None,
    inherit_org_glossary: bool = True,
) -> dict:
    """
    Returns VERIFIED glossary terms for the given target language and org as a
    flat dict: { source_term_lower: target_term }.

    Keys are lowercased so callers can do case-insensitive scanning without
    repeated .lower() calls on every lookup.

    Only VERIFIED terms are returned — PENDING terms are intentionally excluded
    so unreviewed translations are never forced on the LLM.

    Scoping (project-first / org-fallthrough):
        • project_id None → org-level terms only (the original behaviour).
        • project_id set, inherit_org_glossary True → org terms as the base with
          the project's terms layered on top (a project term overrides an org
          term for the same source word).
        • project_id set, inherit_org_glossary False → project terms only.

    Called by: backend/routes/translate.py before each translation job.
    """
    try:
        client = get_client()
        codes = glossary_lookup_codes(normalize_lang_code(target_lang))
        for code in codes:
            merged: dict = {}
            if not project_id or inherit_org_glossary:
                merged.update(_fetch_verified_terms_for_scope(client, code, org_id, None, "org"))
            if project_id:
                merged.update(_fetch_verified_terms_for_scope(client, code, org_id, project_id, "project"))
            if merged:
                return merged
        return {}
    except Exception as e:
        # Glossary fetch failure must never block translation
        print(f"[glossary] fetch_verified_glossary_terms failed (non-fatal): {e}")
        return {}


# ── Projects ──────────────────────────────────────────────────────────────────
# Table: projects (see backend/migrations/003_projects.sql)
#   id, org_id, created_by, name, description, source_language, target_language,
#   domain, deadline, status, inherit_org_glossary, created_at, updated_at
#
# Every read/write is scoped to org_id. Routes resolve org_id from the JWT, so a
# user can only ever touch projects belonging to their own organization.

_PROJECT_INSERT_FIELDS = {
    "name", "description", "source_language", "target_language",
    "domain", "deadline", "status", "inherit_org_glossary",
}
_PROJECT_PATCH_FIELDS = _PROJECT_INSERT_FIELDS  # same updatable surface


def create_project(org_id: str, created_by: str, fields: dict) -> dict:
    """Insert a new project for an org and return the created row."""
    client = get_client()
    payload = {k: v for k, v in fields.items() if k in _PROJECT_INSERT_FIELDS and v is not None}
    payload["org_id"] = org_id
    payload["created_by"] = created_by
    response = client.table("projects").insert(payload).execute()
    return response.data[0]


def fetch_projects(org_id: str, include_archived: bool = True) -> list[dict]:
    """Return all projects for an org, newest first."""
    client = get_client()
    query = client.table("projects").select("*").eq("org_id", org_id).order("created_at", desc=True)
    if not include_archived:
        query = query.neq("status", "Archived")
    return query.execute().data or []


def fetch_project(project_id: str, org_id: str) -> Optional[dict]:
    """Return one project scoped to org_id, or None if not found / not owned."""
    client = get_client()
    response = (
        client.table("projects")
        .select("*")
        .eq("id", project_id)
        .eq("org_id", org_id)
        .limit(1)
        .execute()
    )
    return response.data[0] if response.data else None


def update_project(project_id: str, org_id: str, patch: dict) -> dict:
    """Patch updatable project fields, scoped to org_id. Returns the updated row."""
    client = get_client()
    clean = {k: v for k, v in patch.items() if k in _PROJECT_PATCH_FIELDS}
    clean["updated_at"] = datetime.now(timezone.utc).isoformat()
    response = (
        client.table("projects")
        .update(clean)
        .eq("id", project_id)
        .eq("org_id", org_id)
        .execute()
    )
    rows = response.data
    return rows[0] if rows else {}


def delete_project(project_id: str, org_id: str) -> bool:
    """
    Delete a project, scoped to org_id. Returns True if a row was deleted.

    The database FKs cascade the destructive part: deleting the project row also
    removes its documents and project_members (ON DELETE CASCADE), and detaches
    its translation_memory / glossary rows (ON DELETE SET NULL — those become
    org-scoped and are preserved as reusable memory). What the DB cannot reach is
    the per-document original .docx held in Supabase Storage, so callers should
    clean those up separately (see the route).
    """
    client = get_client()
    response = (
        client.table("projects")
        .delete()
        .eq("id", project_id)
        .eq("org_id", org_id)
        .execute()
    )
    return len(response.data or []) > 0


# ── Project members ─────────────────────────────────────────────────────────────
# Table: project_members (id, project_id, user_id, role, joined_at)

def fetch_project_members(project_id: str) -> list[dict]:
    """Return all member rows for a project."""
    client = get_client()
    return (
        client.table("project_members")
        .select("*")
        .eq("project_id", project_id)
        .order("joined_at", desc=False)
        .execute()
        .data
        or []
    )


def add_project_member(project_id: str, user_id: str, role: str) -> dict:
    """Add (or upsert) a project member with a per-project role override."""
    client = get_client()
    response = (
        client.table("project_members")
        .upsert(
            {"project_id": project_id, "user_id": user_id, "role": role},
            on_conflict="project_id,user_id",
        )
        .execute()
    )
    return response.data[0] if response.data else {}


def remove_project_member(project_id: str, user_id: str) -> bool:
    """Remove a project member. Returns True if a row was deleted."""
    client = get_client()
    response = (
        client.table("project_members")
        .delete()
        .eq("project_id", project_id)
        .eq("user_id", user_id)
        .execute()
    )
    return len(response.data or []) > 0


# ── Documents ───────────────────────────────────────────────────────────────────
# Table: documents (see backend/migrations/003_projects.sql)
# Persists per-document stage + full working state (jsonb) so a project can be
# resumed from any device.

_DOCUMENT_PATCH_FIELDS = {
    "filename", "source_lang", "target_lang", "stage", "sentence_count",
    "reviewed_count", "raw_text", "sentences", "results", "validation_result",
    "review_offsets", "error", "original_docx_path",
}


def create_document(project_id: str, org_id: str, created_by: str, fields: dict) -> dict:
    """Insert a document row into a project and return it."""
    client = get_client()
    payload = {k: v for k, v in fields.items() if k in _DOCUMENT_PATCH_FIELDS and v is not None}
    payload["project_id"] = project_id
    payload["org_id"] = org_id
    payload["created_by"] = created_by
    response = client.table("documents").insert(payload).execute()
    return response.data[0]


def fetch_documents(project_id: str) -> list[dict]:
    """Return all documents for a project, newest first."""
    client = get_client()
    return (
        client.table("documents")
        .select("*")
        .eq("project_id", project_id)
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )


def fetch_document_summaries_for_org(org_id: str) -> list[dict]:
    """
    Lightweight per-document rows for an entire org — only the columns the
    dashboard needs to compute per-project progress (no heavy jsonb columns).
    Used to build project cards without an N+1 query per project.
    """
    client = get_client()
    return (
        client.table("documents")
        .select("project_id, stage, sentence_count, reviewed_count, target_lang, updated_at")
        .eq("org_id", org_id)
        .execute()
        .data
        or []
    )


def fetch_document(document_id: str, org_id: str) -> Optional[dict]:
    """Return one document scoped to org_id (defence-in-depth), or None."""
    client = get_client()
    response = (
        client.table("documents")
        .select("*")
        .eq("id", document_id)
        .eq("org_id", org_id)
        .limit(1)
        .execute()
    )
    return response.data[0] if response.data else None


def update_document(document_id: str, org_id: str, patch: dict) -> dict:
    """Patch a document (stage and/or working state), scoped to org_id."""
    client = get_client()
    clean = {k: v for k, v in patch.items() if k in _DOCUMENT_PATCH_FIELDS}
    clean["updated_at"] = datetime.now(timezone.utc).isoformat()
    response = (
        client.table("documents")
        .update(clean)
        .eq("id", document_id)
        .eq("org_id", org_id)
        .execute()
    )
    rows = response.data
    return rows[0] if rows else {}


def delete_document(document_id: str, org_id: str) -> bool:
    """Delete a document, scoped to org_id. Returns True if a row was deleted."""
    client = get_client()
    response = (
        client.table("documents")
        .delete()
        .eq("id", document_id)
        .eq("org_id", org_id)
        .execute()
    )
    return len(response.data or []) > 0


# ── Original .docx (Supabase Storage) ─────────────────────────────────────────
# Bucket: document-originals (private; see migration 004). Path layout:
# {org_id}/{document_id}.docx. The original uploaded .docx is stored here so the
# format-preserving export can be reproduced after a user leaves and returns to a
# project — the base64 is no longer held only in the browser. All access is via
# the service-role key, so no Storage RLS policies are needed.

_ORIGINALS_BUCKET = "document-originals"
_DOCX_CONTENT_TYPE = (
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)


def _original_docx_storage_path(org_id: str, document_id: str) -> str:
    return f"{org_id}/{document_id}.docx"


def upload_original_docx(document_id: str, org_id: str, raw_bytes: bytes) -> str:
    """
    Upload the original .docx bytes to Storage and record the path on the
    document row. Upserts so a re-upload of the same document overwrites.
    Returns the storage path.
    """
    client = get_client()
    path = _original_docx_storage_path(org_id, document_id)
    client.storage.from_(_ORIGINALS_BUCKET).upload(
        path,
        raw_bytes,
        {"content-type": _DOCX_CONTENT_TYPE, "upsert": "true"},
    )
    update_document(document_id, org_id, {"original_docx_path": path})
    return path


def download_original_docx(path: str) -> Optional[bytes]:
    """Download original .docx bytes from Storage by path, or None on failure."""
    if not path:
        return None
    try:
        client = get_client()
        return client.storage.from_(_ORIGINALS_BUCKET).download(path)
    except Exception as e:
        print(f"[storage] download_original_docx failed (non-fatal): {e}")
        return None


def delete_original_docx(path: str) -> None:
    """Best-effort removal of a stored original .docx from Storage (no raise)."""
    if not path:
        return
    try:
        client = get_client()
        client.storage.from_(_ORIGINALS_BUCKET).remove([path])
    except Exception as e:
        print(f"[storage] delete_original_docx failed (non-fatal): {e}")


def fetch_document_original_b64(document_id: str, org_id: str) -> Optional[str]:
    """
    Return the base64 of a document's stored original .docx, or None when the
    document has no stored original (PDF-sourced, pre-migration, or doc_id that
    isn't a real document — e.g. the legacy project-less flow's "unknown").

    Used by the export routes to restore format-preserving export after the
    browser's in-memory base64 is gone (e.g. the user left and returned).
    """
    try:
        doc = fetch_document(document_id, org_id)
        if not doc:
            return None
        path = doc.get("original_docx_path")
        raw = download_original_docx(path) if path else None
        if not raw:
            return None
        return base64.b64encode(raw).decode("ascii")
    except Exception as e:
        # Non-fatal: export falls back to raw reconstruction.
        print(f"[storage] fetch_document_original_b64 failed (non-fatal): {e}")
        return None
