-- 002_profile_name_and_user_tracking.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds two things needed by the Profile page feature:
--
--   1. memberships.display_name — a per-user display name (default 'User') that
--      the user can change on their Profile page. Stored on memberships because
--      that is the table jwt_bearer already resolves on every request, so no
--      extra join is needed to surface the name.
--
--   2. pipeline_events.user_id — the id of the user who ran the translation.
--      Lets the Profile page show "documents only that user has translated".
--      Nullable on purpose: rows written before this migration have no user_id
--      and simply won't appear under any user's profile (org dashboard is
--      unaffected — it never filters by user).
--
-- Run once in the Supabase SQL editor. The backend degrades gracefully if a
-- column is missing (name falls back to 'User'), but user-scoped document
-- history only populates after this is applied and new translations have run.

-- 1. Per-user display name on memberships.
alter table public.memberships
    add column if not exists display_name text not null default 'User';

-- 2. Track the translating user on pipeline_events.
alter table public.pipeline_events
    add column if not exists user_id text;

-- Profile "my documents" filters by org_id + user_id, newest first.
create index if not exists pipeline_events_org_user_created_idx
    on public.pipeline_events (org_id, user_id, created_at desc);
