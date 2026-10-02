-- ============================================================
-- 022_production_calendar.sql
-- Production calendar: which weekdays are shooting days, and holidays /
-- dark days. Shoot-day dates follow this calendar when the AD pushes the
-- schedule (rain day, late actor) or inserts a day off.
-- Safe to run more than once; only adds.
-- ============================================================

-- 0 = Sunday … 6 = Saturday. Default: six-day week, Sunday off.
alter table project_settings
  add column if not exists work_days smallint[] not null default '{1,2,3,4,5,6}';

-- [{ "date": "2026-11-08", "label": "Diwali" }, …]
alter table project_settings
  add column if not exists holidays jsonb not null default '[]'::jsonb;
