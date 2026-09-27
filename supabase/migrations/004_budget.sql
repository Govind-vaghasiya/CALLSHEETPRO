-- ============================================================
-- 004_budget.sql
-- Budget integration: rates per resource, estimates, actuals
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

create type rate_type as enum ('FLAT', 'DAILY', 'HOURLY', 'WEEKLY');

-- ============================================================
-- resource_rates
-- ============================================================
create table resource_rates (
  id              uuid primary key default uuid_generate_v4(),
  resource_id     uuid not null unique references resources(id) on delete cascade,
  rate_type       rate_type not null default 'DAILY',
  rate_amount     numeric(12,2),
  currency        text not null default 'USD',
  estimated_days  numeric(6,1),          -- estimated shoot days on project
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- budget_line_items  (manual overrides / additional costs)
-- ============================================================
create table budget_line_items (
  id           uuid primary key default uuid_generate_v4(),
  project_id   uuid not null references projects(id) on delete cascade,
  label        text not null,
  amount       numeric(12,2) not null,
  currency     text not null default 'USD',
  category     text,
  notes        text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
