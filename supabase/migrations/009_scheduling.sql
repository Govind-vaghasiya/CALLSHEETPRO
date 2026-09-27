-- ============================================================
-- 009_scheduling.sql
-- Shoot days, scene assignments, and resource bookings
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

create type shoot_day_status as enum (
  'DRAFT', 'PLANNED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
);

-- ============================================================
-- shoot_days
-- ============================================================
create table shoot_days (
  id                   uuid primary key default uuid_generate_v4(),
  project_id           uuid not null references projects(id) on delete cascade,
  shoot_date           date not null,
  day_number           integer,           -- "Day 7" of production
  call_time            time,
  wrap_time            time,
  status               shoot_day_status not null default 'DRAFT',
  primary_location_id  uuid references resources(id) on delete set null,
  notes                text,
  is_locked            boolean not null default false,
  created_by           uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique(project_id, shoot_date)
);

-- ============================================================
-- shoot_day_scenes  (which scenes shoot on which day, in what order)
-- ============================================================
create table shoot_day_scenes (
  id                uuid primary key default uuid_generate_v4(),
  shoot_day_id      uuid not null references shoot_days(id) on delete cascade,
  scene_id          uuid not null references scenes(id) on delete cascade,
  sort_order        integer not null default 0,
  estimated_minutes integer,             -- can override scene default
  actual_minutes    integer,             -- filled in after shooting
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique(shoot_day_id, scene_id)
);

-- ============================================================
-- resource_bookings  (resource assigned to a specific shoot day)
-- ============================================================
create table resource_bookings (
  id           uuid primary key default uuid_generate_v4(),
  project_id   uuid not null references projects(id) on delete cascade,
  shoot_day_id uuid not null references shoot_days(id) on delete cascade,
  resource_id  uuid not null references resources(id) on delete cascade,
  scene_id     uuid references scenes(id) on delete set null,  -- null = booked for whole day
  call_time    time,                     -- individual call time (overrides day default)
  wrap_time    time,
  start_at     timestamptz,
  end_at       timestamptz,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
