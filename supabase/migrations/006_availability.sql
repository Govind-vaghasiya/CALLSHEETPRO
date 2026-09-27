-- ============================================================
-- 006_availability.sql
-- Resource availability with time-interval precision
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

create type availability_status as enum (
  'AVAILABLE', 'UNAVAILABLE', 'PARTIAL', 'HOLD', 'TRAVEL'
);

-- ============================================================
-- resource_availability
-- ============================================================
create table resource_availability (
  id           uuid primary key default uuid_generate_v4(),
  resource_id  uuid not null references resources(id) on delete cascade,
  project_id   uuid not null references projects(id) on delete cascade,
  start_at     timestamptz not null,
  end_at       timestamptz not null,
  status       availability_status not null,
  reason       text,
  notes        text,
  is_recurring boolean not null default false,
  recurrence_rule text,                 -- iCal RRULE format for recurring entries
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint valid_interval check (end_at > start_at)
);

-- ============================================================
-- availability_rules (project-wide scheduling rules)
-- ============================================================
create table availability_rules (
  id           uuid primary key default uuid_generate_v4(),
  project_id   uuid not null references projects(id) on delete cascade,
  resource_id  uuid references resources(id) on delete cascade,  -- null = applies to all
  rule_type    text not null,    -- e.g. 'NO_WEEKENDS', 'TRAVEL_BUFFER', 'MAX_CONSECUTIVE_DAYS'
  rule_value   jsonb not null default '{}',
  is_active    boolean not null default true,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
