-- ============================================================
-- 011_validation.sql
-- Conflicts, validation runs, and validation results
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

create type conflict_type as enum (
  'RESOURCE_UNAVAILABLE',
  'RESOURCE_DOUBLE_BOOKED',
  'LOCATION_UNAVAILABLE',
  'LOCATION_HOURS_VIOLATION',
  'EQUIPMENT_UNAVAILABLE',
  'TIME_CONFLICT',
  'TRAVEL_CONFLICT',
  'TURNAROUND_VIOLATION',
  'OVERTIME',
  'MISSING_RESOURCE',
  'DAY_NIGHT_MISMATCH',
  'LOCKED_DAY_MODIFIED',
  'OTHER'
);

create type conflict_severity as enum ('BLOCKING', 'WARNING', 'INFO');

create type conflict_status as enum ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'IGNORED');

-- ============================================================
-- conflicts
-- ============================================================
create table conflicts (
  id             uuid primary key default uuid_generate_v4(),
  project_id     uuid not null references projects(id) on delete cascade,
  conflict_type  conflict_type not null,
  severity       conflict_severity not null,
  status         conflict_status not null default 'OPEN',
  shoot_day_id   uuid references shoot_days(id) on delete cascade,
  scene_id       uuid references scenes(id) on delete set null,
  resource_id    uuid references resources(id) on delete set null,
  message        text not null,
  details        jsonb,                  -- structured extra data
  detected_at    timestamptz not null default now(),
  resolved_at    timestamptz,
  resolved_by    uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ============================================================
-- validation_runs  (audit of when validation was run)
-- ============================================================
create table validation_runs (
  id                 uuid primary key default uuid_generate_v4(),
  project_id         uuid not null references projects(id) on delete cascade,
  triggered_by       text not null,      -- 'MANUAL', 'SCHEDULE_CHANGE', 'AVAILABILITY_CHANGE', 'AI'
  blocking_count     integer not null default 0,
  warning_count      integer not null default 0,
  info_count         integer not null default 0,
  duration_ms        integer,
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now()
);
