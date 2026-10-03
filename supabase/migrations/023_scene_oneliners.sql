-- ============================================================
-- 023_scene_oneliners.sql
-- One-liners and page eighths for the breakdown and the one-liner report.
--   synopsis         the scene's one-line summary ("Sid checks himself out in the mirror")
--   synopsis_source  'AI' (drafted by AI, may be redrafted) or 'USER' (written/edited by
--                    someone — AI never overwrites it)
--   page_eighths     scene length in 1/8 pages (6 = 6/8, 10 = 1 2/8), counted from the script
--   time_of_day_label time of day as written in the slugline ("EARLY MORNING", "PRE DAWN");
--                    time_of_day stays the scheduling category (DAY/NIGHT/…)
-- Safe to run more than once. Only adds; nothing is changed or deleted.
-- ============================================================

alter table scenes add column if not exists synopsis text;
alter table scenes add column if not exists synopsis_source text check (synopsis_source in ('AI', 'USER'));
alter table scenes add column if not exists page_eighths integer check (page_eighths > 0);
alter table scenes add column if not exists time_of_day_label text;
