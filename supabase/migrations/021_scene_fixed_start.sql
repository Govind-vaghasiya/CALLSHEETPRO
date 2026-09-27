-- ============================================================
-- 021_scene_fixed_start.sql
-- Lets the AD pin a scene to an exact start time on its shoot day
-- (e.g. the sunset scene must roll at 18:10). Scenes without it keep
-- flowing from the call time. Safe to run more than once; only adds.
-- ============================================================

alter table shoot_day_scenes add column if not exists fixed_start_time time;
