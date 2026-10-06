-- ============================================================
-- 025_script_versions_and_tracked_changes.sql
-- 1. Decimal draft versions: 1.1, 1.2, 5.6 (was whole numbers only).
-- 2. Tracked changes on the master script: when a new draft is merged, each changed scene keeps
--    its last confirmed text, so the reader can highlight what is new (yellow) until someone
--    accepts or rejects it.
--      accepted_heading / accepted_description  the scene before the merge; null = nothing to
--                                               review ('' = a scene the draft added)
--      changes_from_document_id                 the draft the unreviewed changes came from
-- Safe to run more than once. Nothing is deleted.
-- ============================================================

alter table script_documents alter column version type numeric(6,2) using version::numeric;
alter table script_documents alter column version set default 1;

alter table scenes add column if not exists accepted_heading text;
alter table scenes add column if not exists accepted_description text;
alter table scenes add column if not exists changes_from_document_id uuid references script_documents(id) on delete set null;
