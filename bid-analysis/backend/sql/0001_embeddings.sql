-- PROPOSED, NOT APPLIED. Vector storage for matching. Per data/README.md, schema changes go through a PR with a new
-- file in supabase/migrations/ and only one person applies migrations; move/rename this file when the team agrees.
-- Untested: written without access to the database. all-MiniLM-L6-v2 produces 384-dimension vectors.

create extension if not exists vector with schema extensions;

alter table public.bids
  add column embedding         extensions.vector(384),
  add column embedding_model   text,
  add column embedding_version text;

-- The profile summary + embedding are stored with the user record (SRS D-20 / ONB-13). No user or profile table exists
-- yet; whoever builds accounts should add these columns to it (names are a suggestion):
--   text_summary text, embedding extensions.vector(384), embedding_model text, embedding_version text, profile_revision int
