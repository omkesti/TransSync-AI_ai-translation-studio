-- 003_projects.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Projects feature: a new scoping layer that sits BETWEEN the organization and
-- the translation work (documents, TM, glossary, FAISS). Users create projects
-- on the dashboard; all translation work happens inside a project context, with
-- project-scoped data falling through to org-scoped data when nothing matches.
--
-- This migration is ADDITIVE and BACKWARD-COMPATIBLE:
--   • New tables: projects, project_members, documents.
--   • New NULLABLE column project_id on translation_memory and glossary.
--   • Nothing existing is dropped or made required. Rows without a project_id
--     remain valid org-scoped data and continue to resolve exactly as before.
--
-- Run once in the Supabase SQL editor (same as 001 / 002). The backend degrades
-- gracefully while this is pending: project endpoints will error until the
-- tables exist, but the existing upload→validate→translate→export flow keeps
-- working because project_id is always optional.
--
-- Notes on types:
--   • org_id is uuid here (FK to organizations.id) — the backend resolves it as
--     a string from the JWT/memberships, which PostgREST coerces to uuid fine.
--     (pipeline_events.org_id is text and has no FK; the new tables use a real
--     FK for referential integrity.)
--   • created_by / user_id reference auth.users(id) (uuid). Inserted from the
--     JWT 'sub' claim (a uuid string).

-- ── 1. projects ───────────────────────────────────────────────────────────────
create table if not exists public.projects (
    id                    uuid        primary key default gen_random_uuid(),
    org_id                uuid        not null references public.organizations(id) on delete cascade,
    created_by            uuid        references auth.users(id) on delete set null,
    name                  text        not null,
    description           text,
    source_language       text        not null default 'en',
    target_language       text,
    domain                text,       -- Legal | Medical | Technical | Marketing | General | (null)
    deadline              date,
    status                text        not null default 'Draft',  -- Draft | Active | In Review | Completed | Archived
    inherit_org_glossary  boolean     not null default true,
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now()
);

-- Dashboard lists projects per org, newest first.
create index if not exists projects_org_created_idx
    on public.projects (org_id, created_at desc);

-- ── 2. project_members ────────────────────────────────────────────────────────
-- Per-project role overrides that layer ON TOP of org-level RBAC. Membership in
-- the owning org is still required (verified in the backend); this table only
-- refines a member's role within a single project.
create table if not exists public.project_members (
    id          uuid        primary key default gen_random_uuid(),
    project_id  uuid        not null references public.projects(id) on delete cascade,
    user_id     uuid        not null references auth.users(id) on delete cascade,
    role        text        not null default 'Translator',  -- Admin | Translator | Reviewer
    joined_at   timestamptz not null default now(),
    unique (project_id, user_id)
);

create index if not exists project_members_project_idx
    on public.project_members (project_id);
create index if not exists project_members_user_idx
    on public.project_members (user_id);

-- ── 3. documents ──────────────────────────────────────────────────────────────
-- NEW table. The backend was previously stateless — documents lived only in the
-- frontend (localStorage + in-memory base64). Projects need a server-side record
-- so a user can leave and return to a project from any device and resume each
-- document at its last persisted stage.
--
-- The full working state (sentences, per-tier results, validation result, review
-- offsets) is persisted as jsonb so the frontend can rehydrate completely. The
-- original .docx base64 is deliberately NOT stored (it can be several MB); the
-- format-preserving export still receives it from the client at export time, as
-- it does today.
create table if not exists public.documents (
    id                 uuid        primary key default gen_random_uuid(),
    project_id         uuid        not null references public.projects(id) on delete cascade,
    org_id             uuid        not null references public.organizations(id) on delete cascade,
    created_by         uuid        references auth.users(id) on delete set null,
    filename           text        not null default 'document',
    source_lang        text        not null default 'en',
    target_lang        text,
    -- uploaded | validating | validated | translating | in_review | approved | exported
    stage              text        not null default 'uploaded',
    sentence_count     integer     not null default 0,
    reviewed_count     integer     not null default 0,
    raw_text           text        not null default '',
    sentences          jsonb       not null default '[]'::jsonb,
    results            jsonb       not null default '[]'::jsonb,
    validation_result  jsonb,
    review_offsets     jsonb       not null default '{}'::jsonb,
    error              text,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

-- Workspace lists a project's documents, newest first.
create index if not exists documents_project_created_idx
    on public.documents (project_id, created_at desc);
create index if not exists documents_org_idx
    on public.documents (org_id);

-- ── 4. project_id scoping on existing tables ──────────────────────────────────
-- Nullable on purpose: existing rows stay org-scoped (project_id IS NULL) and
-- resolve exactly as before. New approvals/terms made inside a project carry the
-- project_id so lookups can prefer project-scoped data and fall through to org.
alter table public.translation_memory
    add column if not exists project_id uuid references public.projects(id) on delete set null;

alter table public.glossary
    add column if not exists project_id uuid references public.projects(id) on delete set null;

-- Project-scoped TM lookups filter by (org_id, project_id, target_lang); these
-- partial-ish composite indexes keep both the project-first and org-fallback
-- queries fast.
create index if not exists translation_memory_project_idx
    on public.translation_memory (project_id);
create index if not exists glossary_project_idx
    on public.glossary (project_id);
