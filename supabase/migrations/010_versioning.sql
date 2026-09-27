-- ============================================================
-- 010_versioning.sql
-- Schedule versions, change tracking, and locks
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

create type version_source as enum ('USER', 'AI', 'SYSTEM', 'IMPORT');

-- ============================================================
-- schedule_versions  (immutable snapshots)
-- ============================================================
create table schedule_versions (
  id              uuid primary key default uuid_generate_v4(),
  project_id      uuid not null references projects(id) on delete cascade,
  version_number  integer not null,
  commit_message  text,
  source          version_source not null default 'USER',
  created_by      uuid references auth.users(id) on delete set null,
  schedule_json   jsonb not null,         -- full snapshot of the schedule
  is_current      boolean not null default false,
  created_at      timestamptz not null default now(),
  unique(project_id, version_number)
);

-- ============================================================
-- schedule_changes  (individual change records within a version)
-- ============================================================
create table schedule_changes (
  id           uuid primary key default uuid_generate_v4(),
  version_id   uuid not null references schedule_versions(id) on delete cascade,
  change_type  text not null,            -- e.g. 'SCENE_MOVED', 'CALL_TIME_CHANGED'
  entity_type  text not null,            -- e.g. 'shoot_day', 'scene', 'resource_booking'
  entity_id    uuid,
  old_value    jsonb,
  new_value    jsonb,
  reason       text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- schedule_locks  (granular locks on days/scenes/resources)
-- ============================================================
create table schedule_locks (
  id           uuid primary key default uuid_generate_v4(),
  project_id   uuid not null references projects(id) on delete cascade,
  entity_type  text not null,            -- 'shoot_day', 'scene', 'resource'
  entity_id    uuid not null,
  locked_by    uuid references auth.users(id) on delete set null,
  reason       text,
  created_at   timestamptz not null default now(),
  unique(entity_type, entity_id)
);
