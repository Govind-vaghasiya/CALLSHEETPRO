-- ============================================================
-- 016_production_rules.sql
-- Production rules and union/guild presets
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

create type rule_constraint_type as enum ('HARD', 'SOFT');

create type rule_category as enum (
  'WORKING_HOURS',
  'TURNAROUND',
  'CONSECUTIVE_DAYS',
  'COMPANY_MOVE',
  'OVERTIME',
  'TRAVEL',
  'SCHEDULING_PREFERENCE',
  'UNION_GUILD',
  'CUSTOM'
);

-- ============================================================
-- production_rules  (per-project configurable rules)
-- ============================================================
create table production_rules (
  id              uuid primary key default uuid_generate_v4(),
  project_id      uuid not null references projects(id) on delete cascade,
  name            text not null,
  description     text,
  category        rule_category not null,
  constraint_type rule_constraint_type not null default 'SOFT',
  rule_key        text not null,          -- machine-readable key e.g. 'max_shooting_hours'
  rule_value      jsonb not null,         -- flexible value store e.g. {"hours": 10}
  applies_to_type text,                   -- 'PERSON', 'LOCATION', 'EQUIPMENT', or null (all)
  applies_to_id   uuid,                   -- specific resource, or null (all of type)
  is_active       boolean not null default true,
  preset_source   text,                   -- 'SAG_AFTRA', 'IATSE', 'DGA', 'CUSTOM'
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null  default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- union_presets  (read-only template rules)
-- ============================================================
create table union_presets (
  id           uuid primary key default uuid_generate_v4(),
  preset_name  text not null unique,      -- 'SAG_AFTRA', 'IATSE', 'DGA', 'BECTU'
  display_name text not null,
  description  text,
  rules        jsonb not null,            -- array of rule templates
  created_at   timestamptz not null default now()
);

-- Insert standard union presets
insert into union_presets (preset_name, display_name, description, rules) values
(
  'SAG_AFTRA',
  'SAG-AFTRA',
  'Screen Actors Guild — American Federation of Television and Radio Artists',
  '[
    {"key": "min_turnaround_hours", "value": 12, "name": "Minimum Turnaround", "constraint_type": "HARD", "category": "TURNAROUND"},
    {"key": "max_work_hours_day", "value": 8, "name": "Basic Session Max", "constraint_type": "HARD", "category": "WORKING_HOURS"},
    {"key": "meal_penalty_after_minutes", "value": 330, "name": "Meal Penalty After 5.5h", "constraint_type": "HARD", "category": "WORKING_HOURS"}
  ]'
),
(
  'IATSE',
  'IATSE',
  'International Alliance of Theatrical Stage Employees',
  '[
    {"key": "min_turnaround_hours", "value": 10, "name": "Minimum Turnaround", "constraint_type": "HARD", "category": "TURNAROUND"},
    {"key": "max_shooting_hours", "value": 12, "name": "Max Shooting Hours", "constraint_type": "HARD", "category": "WORKING_HOURS"},
    {"key": "overtime_after_hours", "value": 8, "name": "Overtime After 8h", "constraint_type": "HARD", "category": "OVERTIME"}
  ]'
),
(
  'DGA',
  'DGA',
  'Directors Guild of America',
  '[
    {"key": "min_turnaround_hours", "value": 12, "name": "Director Minimum Turnaround", "constraint_type": "HARD", "category": "TURNAROUND"},
    {"key": "max_consecutive_days", "value": 6, "name": "Max Consecutive Days", "constraint_type": "HARD", "category": "CONSECUTIVE_DAYS"}
  ]'
);
