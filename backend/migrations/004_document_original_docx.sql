-- 004_document_original_docx.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Persist the ORIGINAL uploaded .docx so format-preserving export survives a
-- user leaving and returning to a project (from any device).
--
-- Previously the original .docx travelled only as base64 in the browser
-- (AppContext, runtime-only — stripped before localStorage and never sent to
-- Supabase). On return, the document rehydrated with no original file, so export
-- silently fell back to the raw from-scratch reconstruction and ALL formatting
-- was lost. We now store the original .docx in a private Supabase Storage bucket
-- and remember its path on the document row; export downloads it on demand.
--
-- This migration is ADDITIVE and BACKWARD-COMPATIBLE:
--   • New NULLABLE column documents.original_docx_path.
--   • New private storage bucket 'document-originals'.
--   • Rows without an original_docx_path behave exactly as before (PDF-sourced
--     docs, or DOCX docs uploaded before this migration → raw reconstruction).
--
-- Run once in the Supabase SQL editor (same as 001 / 002 / 003).
--
-- Access model: the backend uses the service-role key (SUPABASE_KEY), which
-- bypasses Storage RLS, and is the ONLY party that reads/writes this bucket. The
-- frontend never touches Storage directly, so no per-user storage policies are
-- required. The bucket is private (public = false) so objects are never exposed
-- via a public URL.

-- ── 1. document → original .docx path ─────────────────────────────────────────
alter table public.documents
    add column if not exists original_docx_path text;

-- ── 2. private storage bucket for original uploads ────────────────────────────
-- Path layout inside the bucket: {org_id}/{document_id}.docx
insert into storage.buckets (id, name, public)
values ('document-originals', 'document-originals', false)
on conflict (id) do nothing;
