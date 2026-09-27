-- ============================================================
-- 013_callsheets.sql
-- Call sheet generation, distribution, and tracking
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

create type callsheet_status as enum (
  'DRAFT', 'PUBLISHED', 'REVISED', 'ARCHIVED'
);

-- ============================================================
-- call_sheets
-- ============================================================
create table call_sheets (
  id                    uuid primary key default uuid_generate_v4(),
  project_id            uuid not null references projects(id) on delete cascade,
  shoot_day_id          uuid not null references shoot_days(id) on delete cascade,
  version               integer not null default 1,
  status                callsheet_status not null default 'DRAFT',
  title                 text,                    -- e.g. "Day 7 — Sept 25, 2026"
  general_call_time     time,
  shoot_date            date,
  primary_location_id   uuid references resources(id) on delete set null,
  weather_data          jsonb,                   -- cached from OpenWeatherMap
  weather_fetched_at    timestamptz,
  special_instructions  text,
  advanced_call         text,
  nearest_hospital      text,
  nearest_hospital_km   numeric(6,2),
  catering_notes        text,
  branding_header       jsonb,                   -- org name, logo, contact
  share_token           text unique default encode(gen_random_bytes(16), 'hex'),
  share_enabled         boolean not null default true,
  pdf_storage_path      text,                    -- generated PDF in Supabase Storage
  published_at          timestamptz,
  published_by          uuid references auth.users(id) on delete set null,
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ============================================================
-- call_sheet_departments  (per-department call times)
-- ============================================================
create table call_sheet_departments (
  id              uuid primary key default uuid_generate_v4(),
  call_sheet_id   uuid not null references call_sheets(id) on delete cascade,
  department_id   uuid references departments(id) on delete set null,
  department_name text not null,
  call_time       time not null,
  notes           text,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- call_sheet_recipients  (who received the call sheet + view tracking)
-- ============================================================
create table call_sheet_recipients (
  id              uuid primary key default uuid_generate_v4(),
  call_sheet_id   uuid not null references call_sheets(id) on delete cascade,
  resource_id     uuid references resources(id) on delete set null,
  name            text not null,
  email           text,
  sent_at         timestamptz,
  first_viewed_at timestamptz,
  view_count      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
