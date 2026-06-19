-- 001_pipeline_events.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Analytics log written at translate-time by POST /api/translate.
--
-- Unlike `translation_memory` (which only stores APPROVED LLM translations and
-- deliberately skips TM-exact / FAISS-direct hits), this table records EVERY
-- processed sentence and its match_type tier. It is the source of truth for the
-- Dashboard's pipeline-tier breakdown and the "recent documents" activity feed.
--
-- Run this once in the Supabase SQL editor before deploying the new dashboard.
-- The backend degrades gracefully if the table is missing (dashboard shows
-- empty), so deploy order is not critical — but stats stay at zero until it
-- exists and new translations have run.

create table if not exists public.pipeline_events (
    id              uuid        primary key default gen_random_uuid(),
    org_id          text        not null,
    source_text     text        not null default '',
    translated_text text        not null default '',
    source_lang     varchar(10) not null default 'en',
    target_lang     varchar(10) not null default '',
    match_type      varchar(20) not null default '',
    source_document text        not null default '',
    created_at      timestamptz not null default now()
);

-- Dashboard queries filter by org_id and order by created_at desc.
create index if not exists pipeline_events_org_created_idx
    on public.pipeline_events (org_id, created_at desc);
