-- ================================================================
-- CALLSHEETPRO — COMPLETE DATABASE SCHEMA
-- Run this entire file in the Supabase SQL Editor
-- Dashboard → SQL Editor → New Query → Paste → Run
--
-- NOTE: If you ever need to reset to a clean slate before running:
--   drop schema public cascade;
--   create schema public;
--   grant all on schema public to postgres, anon, authenticated, service_role;
-- ================================================================

-- ================================================================
-- EXTENSIONS
-- ================================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ================================================================
-- ENUMS
-- ================================================================

do $$ begin create type org_member_role as enum ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER'); exception when duplicate_object then null; end $$;
do $$ begin create type project_type as enum ('FEATURE', 'SHORT', 'TV', 'COMMERCIAL', 'MUSIC_VIDEO', 'DOCUMENTARY', 'OTHER'); exception when duplicate_object then null; end $$;
do $$ begin create type project_status as enum ('DEVELOPMENT', 'PRE_PRODUCTION', 'PRODUCTION', 'POST', 'COMPLETED', 'ARCHIVED'); exception when duplicate_object then null; end $$;
do $$ begin create type project_member_role as enum ('OWNER', 'ADMIN', 'COORDINATOR', 'MEMBER', 'VIEWER'); exception when duplicate_object then null; end $$;
do $$ begin create type resource_type as enum ('PERSON', 'EQUIPMENT', 'LOCATION', 'PROP', 'VEHICLE', 'ANIMAL', 'OTHER'); exception when duplicate_object then null; end $$;
do $$ begin create type rate_type as enum ('FLAT', 'DAILY', 'HOURLY', 'WEEKLY'); exception when duplicate_object then null; end $$;
do $$ begin create type availability_status as enum ('AVAILABLE', 'UNAVAILABLE', 'PARTIAL', 'HOLD', 'TRAVEL'); exception when duplicate_object then null; end $$;
do $$ begin create type script_status as enum ('UPLOADED', 'PROCESSING', 'PROCESSED', 'FAILED', 'ARCHIVED'); exception when duplicate_object then null; end $$;
do $$ begin create type script_file_type as enum ('PDF', 'FDX', 'DOCX', 'TXT', 'OTHER'); exception when duplicate_object then null; end $$;
do $$ begin create type revision_color as enum ('WHITE', 'BLUE', 'PINK', 'YELLOW', 'GREEN', 'GOLDENROD', 'BUFF', 'SALMON', 'CHERRY', 'TAN', 'DOUBLE_WHITE', 'CUSTOM'); exception when duplicate_object then null; end $$;
do $$ begin create type scene_status as enum ('DETECTED', 'REVIEWED', 'CONFIRMED', 'LOCKED'); exception when duplicate_object then null; end $$;
do $$ begin create type int_ext as enum ('INT', 'EXT', 'INT_EXT'); exception when duplicate_object then null; end $$;
do $$ begin create type time_of_day as enum ('DAY', 'NIGHT', 'DAWN', 'DUSK', 'CONTINUOUS', 'LATER', 'MOMENTS_LATER', 'SAME_TIME'); exception when duplicate_object then null; end $$;
do $$ begin create type scene_element_type as enum ('CAST', 'EXTRA', 'PROP', 'LOCATION', 'WARDROBE', 'MAKEUP', 'VEHICLE', 'ANIMAL', 'STUNT', 'VFX', 'SFX', 'SOUND', 'EQUIPMENT', 'MUSIC', 'OTHER'); exception when duplicate_object then null; end $$;
do $$ begin create type element_confirm_status as enum ('AI_DETECTED', 'CONFIRMED', 'EDITED', 'REMOVED'); exception when duplicate_object then null; end $$;
do $$ begin create type scene_tag_type as enum ('INT_EXT', 'TIME_OF_DAY', 'STUNT', 'VFX_HEAVY', 'NIGHT_SHOOT', 'WATER', 'ANIMALS', 'CHILDREN', 'SENSITIVE', 'EXTERIOR_WEATHER', 'CUSTOM'); exception when duplicate_object then null; end $$;
do $$ begin create type shoot_day_status as enum ('DRAFT', 'PLANNED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'); exception when duplicate_object then null; end $$;
do $$ begin create type version_source as enum ('USER', 'AI', 'SYSTEM', 'IMPORT'); exception when duplicate_object then null; end $$;
do $$ begin create type conflict_type as enum ('RESOURCE_UNAVAILABLE', 'RESOURCE_DOUBLE_BOOKED', 'LOCATION_UNAVAILABLE', 'LOCATION_HOURS_VIOLATION', 'EQUIPMENT_UNAVAILABLE', 'TIME_CONFLICT', 'TRAVEL_CONFLICT', 'TURNAROUND_VIOLATION', 'OVERTIME', 'MISSING_RESOURCE', 'DAY_NIGHT_MISMATCH', 'LOCKED_DAY_MODIFIED', 'OTHER'); exception when duplicate_object then null; end $$;
do $$ begin create type conflict_severity as enum ('BLOCKING', 'WARNING', 'INFO'); exception when duplicate_object then null; end $$;
do $$ begin create type conflict_status as enum ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'IGNORED'); exception when duplicate_object then null; end $$;
do $$ begin create type ai_job_type as enum ('SCRIPT_BREAKDOWN', 'SCHEDULE_ANALYSIS', 'SCHEDULE_GENERATION', 'CONFLICT_ANALYSIS', 'RESOURCE_MATCHING', 'AVAILABILITY_IMPACT', 'OPTIMIZATION'); exception when duplicate_object then null; end $$;
do $$ begin create type ai_job_status as enum ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'); exception when duplicate_object then null; end $$;
do $$ begin create type ai_suggestion_status as enum ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'); exception when duplicate_object then null; end $$;
do $$ begin create type callsheet_status as enum ('DRAFT', 'PUBLISHED', 'REVISED', 'ARCHIVED'); exception when duplicate_object then null; end $$;
do $$ begin create type notification_type as enum ('CONFLICT_DETECTED', 'SCHEDULE_PUBLISHED', 'CALL_SHEET_PUBLISHED', 'CALL_SHEET_REVISED', 'AI_JOB_COMPLETE', 'AVAILABILITY_IMPACT', 'COMMENT_MENTION', 'COMMENT_REPLY', 'RESOURCE_BOOKING_CHANGED', 'SCRIPT_REVISION_UPLOADED', 'INVITATION_RECEIVED', 'MEMBER_JOINED'); exception when duplicate_object then null; end $$;
do $$ begin create type notification_channel as enum ('IN_APP', 'EMAIL'); exception when duplicate_object then null; end $$;
do $$ begin create type guest_permission as enum ('READ_SCHEDULE', 'READ_CALLSHEET', 'READ_BREAKDOWN', 'READ_RESOURCES'); exception when duplicate_object then null; end $$;
do $$ begin create type rule_constraint_type as enum ('HARD', 'SOFT'); exception when duplicate_object then null; end $$;
do $$ begin create type rule_category as enum ('WORKING_HOURS', 'TURNAROUND', 'CONSECUTIVE_DAYS', 'COMPANY_MOVE', 'OVERTIME', 'TRAVEL', 'SCHEDULING_PREFERENCE', 'UNION_GUILD', 'CUSTOM'); exception when duplicate_object then null; end $$;

-- ================================================================
-- IDENTITY — Organizations, Members, Invitations, User Profiles
-- ================================================================

create table if not exists organizations (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text not null unique,
  logo_url    text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists organization_members (
  id               uuid primary key default uuid_generate_v4(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  role             org_member_role not null default 'MEMBER',
  invited_by       uuid references auth.users(id) on delete set null,
  joined_at        timestamptz,
  created_at       timestamptz not null default now(),
  unique(organization_id, user_id)
);

create table if not exists organization_invitations (
  id               uuid primary key default uuid_generate_v4(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  email            text not null,
  role             org_member_role not null default 'MEMBER',
  token            text not null unique default encode(gen_random_bytes(32), 'hex'),
  invited_by       uuid not null references auth.users(id) on delete cascade,
  accepted_at      timestamptz,
  expires_at       timestamptz not null default (now() + interval '7 days'),
  created_at       timestamptz not null default now(),
  unique(organization_id, email)
);

create table if not exists user_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  timezone    text not null default 'UTC',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create user profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into user_profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ================================================================
-- PROJECTS
-- ================================================================

create table if not exists projects (
  id               uuid primary key default uuid_generate_v4(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  name             text not null,
  description      text,
  project_type     project_type not null default 'FEATURE',
  status           project_status not null default 'PRE_PRODUCTION',
  start_date       date,
  target_end_date  date,
  timezone         text not null default 'UTC',
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists project_members (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        project_member_role not null default 'MEMBER',
  created_at  timestamptz not null default now(),
  unique(project_id, user_id)
);

create table if not exists project_settings (
  id                     uuid primary key default uuid_generate_v4(),
  project_id             uuid not null unique references projects(id) on delete cascade,
  default_call_time      time not null default '07:00',
  default_wrap_time      time not null default '19:00',
  max_shooting_hours     numeric(4,2) not null default 10.0,
  min_turnaround_hours   numeric(4,2) not null default 12.0,
  company_move_threshold integer not null default 30,
  currency               text not null default 'USD',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Auto-create settings and add creator as owner on project create
create or replace function handle_new_project()
returns trigger language plpgsql security definer as $$
begin
  insert into project_settings (project_id) values (new.id);
  insert into project_members (project_id, user_id, role)
  values (new.id, new.created_by, 'OWNER');
  return new;
end;
$$;

create trigger on_project_created
  after insert on projects
  for each row execute procedure handle_new_project();

-- ================================================================
-- PRODUCTION — Departments, Roles, Resources, Groups
-- ================================================================

create table if not exists departments (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references projects(id) on delete cascade,
  name        text not null,
  code        text,
  color       text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(project_id, name)
);

create table if not exists roles (
  id            uuid primary key default uuid_generate_v4(),
  department_id uuid not null references departments(id) on delete cascade,
  project_id    uuid not null references projects(id) on delete cascade,
  name          text not null,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(department_id, name)
);

create table if not exists resources (
  id             uuid primary key default uuid_generate_v4(),
  project_id     uuid not null references projects(id) on delete cascade,
  resource_type  resource_type not null,
  name           text not null,
  display_name   text,
  email          text,
  phone          text,
  notes          text,
  is_active      boolean not null default true,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists resource_roles (
  id           uuid primary key default uuid_generate_v4(),
  resource_id  uuid not null references resources(id) on delete cascade,
  role_id      uuid not null references roles(id) on delete cascade,
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now(),
  unique(resource_id, role_id)
);

create table if not exists resource_groups (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references projects(id) on delete cascade,
  name        text not null,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists resource_group_members (
  id                uuid primary key default uuid_generate_v4(),
  resource_group_id uuid not null references resource_groups(id) on delete cascade,
  resource_id       uuid not null references resources(id) on delete cascade,
  created_at        timestamptz not null default now(),
  unique(resource_group_id, resource_id)
);

-- ================================================================
-- BUDGET — Rates and Line Items
-- ================================================================

create table if not exists resource_rates (
  id              uuid primary key default uuid_generate_v4(),
  resource_id     uuid not null unique references resources(id) on delete cascade,
  rate_type       rate_type not null default 'DAILY',
  rate_amount     numeric(12,2),
  currency        text not null default 'USD',
  estimated_days  numeric(6,1),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists budget_line_items (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references projects(id) on delete cascade,
  label       text not null,
  amount      numeric(12,2) not null,
  currency    text not null default 'USD',
  category    text,
  notes       text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ================================================================
-- LOCATION INTELLIGENCE
-- ================================================================

create table if not exists location_details (
  id                  uuid primary key default uuid_generate_v4(),
  resource_id         uuid not null unique references resources(id) on delete cascade,
  address_line1       text,
  address_line2       text,
  city                text,
  state_province      text,
  postal_code         text,
  country             text,
  latitude            numeric(10,7),
  longitude           numeric(10,7),
  maps_place_id       text,
  parking_notes       text,
  nearest_hospital    text,
  nearest_hospital_km numeric(6,2),
  access_hours_start  time,
  access_hours_end    time,
  permit_required     boolean not null default false,
  permit_type         text,
  permit_expiry       date,
  permit_notes        text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists location_contacts (
  id            uuid primary key default uuid_generate_v4(),
  resource_id   uuid not null references resources(id) on delete cascade,
  contact_name  text not null,
  role          text,
  phone         text,
  email         text,
  is_primary    boolean not null default false,
  notes         text,
  created_at    timestamptz not null default now()
);

create table if not exists location_photos (
  id           uuid primary key default uuid_generate_v4(),
  resource_id  uuid not null references resources(id) on delete cascade,
  storage_path text not null,
  file_name    text not null,
  caption      text,
  sort_order   integer not null default 0,
  uploaded_by  uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table if not exists travel_times (
  id                uuid primary key default uuid_generate_v4(),
  project_id        uuid not null references projects(id) on delete cascade,
  from_location_id  uuid not null references resources(id) on delete cascade,
  to_location_id    uuid not null references resources(id) on delete cascade,
  travel_minutes    integer not null,
  distance_km       numeric(8,2),
  cached_at         timestamptz not null default now(),
  unique(from_location_id, to_location_id)
);

-- ================================================================
-- AVAILABILITY
-- ================================================================

create table if not exists resource_availability (
  id               uuid primary key default uuid_generate_v4(),
  resource_id      uuid not null references resources(id) on delete cascade,
  project_id       uuid not null references projects(id) on delete cascade,
  start_at         timestamptz not null,
  end_at           timestamptz not null,
  status           availability_status not null,
  reason           text,
  notes            text,
  is_recurring     boolean not null default false,
  recurrence_rule  text,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint valid_interval check (end_at > start_at)
);

create table if not exists availability_rules (
  id           uuid primary key default uuid_generate_v4(),
  project_id   uuid not null references projects(id) on delete cascade,
  resource_id  uuid references resources(id) on delete cascade,
  rule_type    text not null,
  rule_value   jsonb not null default '{}',
  is_active    boolean not null default true,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ================================================================
-- SCRIPTS — Documents, Pages, Revisions
-- ================================================================

create table if not exists script_documents (
  id              uuid primary key default uuid_generate_v4(),
  project_id      uuid not null references projects(id) on delete cascade,
  file_name       text not null,
  storage_path    text not null,
  file_type       script_file_type not null,
  file_size_bytes bigint,
  status          script_status not null default 'UPLOADED',
  version         numeric(6,2) not null default 1,
  revision_color  revision_color not null default 'WHITE',
  revision_date   date,
  revision_notes  text,
  is_current      boolean not null default false,
  total_pages     integer,
  total_scenes    integer,
  uploaded_by     uuid references auth.users(id) on delete set null,
  processed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists script_pages (
  id                  uuid primary key default uuid_generate_v4(),
  script_document_id  uuid not null references script_documents(id) on delete cascade,
  page_number         integer not null,
  raw_text            text,
  created_at          timestamptz not null default now(),
  unique(script_document_id, page_number)
);

-- ================================================================
-- SCENES — Scene Data, Elements, Requirements, Tags, Notes
-- ================================================================

create table if not exists scenes (
  id                  uuid primary key default uuid_generate_v4(),
  project_id          uuid not null references projects(id) on delete cascade,
  script_document_id  uuid references script_documents(id) on delete set null,
  scene_number        text not null,
  scene_order         integer,
  heading             text,
  int_ext             int_ext,
  location_name       text,
  time_of_day         time_of_day,
  page_start          numeric(6,1),
  page_end            numeric(6,1),
  description         text,
  estimated_duration  integer,
  episode_number      text,
  status              scene_status not null default 'DETECTED',
  ai_confidence       integer,
  revision_color      revision_color,
  is_changed          boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique(project_id, scene_number)
);

create table if not exists scene_elements (
  id              uuid primary key default uuid_generate_v4(),
  scene_id        uuid not null references scenes(id) on delete cascade,
  element_type    scene_element_type not null,
  name            text not null,
  description     text,
  ai_confidence   integer,
  confirm_status  element_confirm_status not null default 'AI_DETECTED',
  confirmed_by    uuid references auth.users(id) on delete set null,
  confirmed_at    timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists scene_requirements (
  id           uuid primary key default uuid_generate_v4(),
  scene_id     uuid not null references scenes(id) on delete cascade,
  resource_id  uuid not null references resources(id) on delete cascade,
  element_id   uuid references scene_elements(id) on delete set null,
  required     boolean not null default true,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique(scene_id, resource_id)
);

create table if not exists scene_tags (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references projects(id) on delete cascade,
  scene_id    uuid not null references scenes(id) on delete cascade,
  tag_type    scene_tag_type not null default 'CUSTOM',
  label       text not null,
  color       text,
  created_at  timestamptz not null default now(),
  unique(scene_id, label)
);

create table if not exists scene_notes (
  id          uuid primary key default uuid_generate_v4(),
  scene_id    uuid not null references scenes(id) on delete cascade,
  note        text not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ================================================================
-- SCHEDULING — Shoot Days, Scene Assignments, Resource Bookings
-- ================================================================

create table if not exists shoot_days (
  id                   uuid primary key default uuid_generate_v4(),
  project_id           uuid not null references projects(id) on delete cascade,
  shoot_date           date not null,
  day_number           integer,
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

create table if not exists shoot_day_scenes (
  id                uuid primary key default uuid_generate_v4(),
  shoot_day_id      uuid not null references shoot_days(id) on delete cascade,
  scene_id          uuid not null references scenes(id) on delete cascade,
  sort_order        integer not null default 0,
  estimated_minutes integer,
  actual_minutes    integer,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique(shoot_day_id, scene_id)
);

create table if not exists resource_bookings (
  id           uuid primary key default uuid_generate_v4(),
  project_id   uuid not null references projects(id) on delete cascade,
  shoot_day_id uuid not null references shoot_days(id) on delete cascade,
  resource_id  uuid not null references resources(id) on delete cascade,
  scene_id     uuid references scenes(id) on delete set null,
  call_time    time,
  wrap_time    time,
  start_at     timestamptz,
  end_at       timestamptz,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ================================================================
-- VERSIONING — Schedule Snapshots, Change Log, Locks
-- ================================================================

create table if not exists schedule_versions (
  id              uuid primary key default uuid_generate_v4(),
  project_id      uuid not null references projects(id) on delete cascade,
  version_number  integer not null,
  commit_message  text,
  source          version_source not null default 'USER',
  created_by      uuid references auth.users(id) on delete set null,
  schedule_json   jsonb not null,
  is_current      boolean not null default false,
  created_at      timestamptz not null default now(),
  unique(project_id, version_number)
);

create table if not exists schedule_changes (
  id           uuid primary key default uuid_generate_v4(),
  version_id   uuid not null references schedule_versions(id) on delete cascade,
  change_type  text not null,
  entity_type  text not null,
  entity_id    uuid,
  old_value    jsonb,
  new_value    jsonb,
  reason       text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table if not exists schedule_locks (
  id           uuid primary key default uuid_generate_v4(),
  project_id   uuid not null references projects(id) on delete cascade,
  entity_type  text not null,
  entity_id    uuid not null,
  locked_by    uuid references auth.users(id) on delete set null,
  reason       text,
  created_at   timestamptz not null default now(),
  unique(entity_type, entity_id)
);

-- ================================================================
-- CONFLICT DETECTION
-- ================================================================

create table if not exists conflicts (
  id             uuid primary key default uuid_generate_v4(),
  project_id     uuid not null references projects(id) on delete cascade,
  conflict_type  conflict_type not null,
  severity       conflict_severity not null,
  status         conflict_status not null default 'OPEN',
  shoot_day_id   uuid references shoot_days(id) on delete cascade,
  scene_id       uuid references scenes(id) on delete set null,
  resource_id    uuid references resources(id) on delete set null,
  message        text not null,
  details        jsonb,
  detected_at    timestamptz not null default now(),
  resolved_at    timestamptz,
  resolved_by    uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists validation_runs (
  id              uuid primary key default uuid_generate_v4(),
  project_id      uuid not null references projects(id) on delete cascade,
  triggered_by    text not null,
  blocking_count  integer not null default 0,
  warning_count   integer not null default 0,
  info_count      integer not null default 0,
  duration_ms     integer,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

-- ================================================================
-- AI — Jobs, Suggestions, Conversations
-- ================================================================

create table if not exists ai_jobs (
  id            uuid primary key default uuid_generate_v4(),
  project_id    uuid not null references projects(id) on delete cascade,
  job_type      ai_job_type not null,
  status        ai_job_status not null default 'QUEUED',
  input_data    jsonb,
  output_data   jsonb,
  error_message text,
  model_used    text,
  input_tokens  integer,
  output_tokens integer,
  cost_usd      numeric(10,6),
  duration_ms   integer,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists ai_suggestions (
  id               uuid primary key default uuid_generate_v4(),
  project_id       uuid not null references projects(id) on delete cascade,
  job_id           uuid references ai_jobs(id) on delete set null,
  status           ai_suggestion_status not null default 'PENDING',
  title            text not null,
  description      text,
  reasoning        text,
  changes_json     jsonb not null,
  impact_json      jsonb,
  conflicts_before integer not null default 0,
  conflicts_after  integer not null default 0,
  reviewed_by      uuid references auth.users(id) on delete set null,
  reviewed_at      timestamptz,
  expires_at       timestamptz not null default (now() + interval '48 hours'),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists ai_conversations (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references projects(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  role        text not null,
  content     text not null,
  job_id      uuid references ai_jobs(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ================================================================
-- CALL SHEETS
-- ================================================================

create table if not exists call_sheets (
  id                   uuid primary key default uuid_generate_v4(),
  project_id           uuid not null references projects(id) on delete cascade,
  shoot_day_id         uuid not null references shoot_days(id) on delete cascade,
  version              integer not null default 1,
  status               callsheet_status not null default 'DRAFT',
  title                text,
  general_call_time    time,
  shoot_date           date,
  primary_location_id  uuid references resources(id) on delete set null,
  weather_data         jsonb,
  weather_fetched_at   timestamptz,
  special_instructions text,
  advanced_call        text,
  nearest_hospital     text,
  nearest_hospital_km  numeric(6,2),
  catering_notes       text,
  branding_header      jsonb,
  share_token          text unique default encode(gen_random_bytes(16), 'hex'),
  share_enabled        boolean not null default true,
  pdf_storage_path     text,
  published_at         timestamptz,
  published_by         uuid references auth.users(id) on delete set null,
  created_by           uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists call_sheet_departments (
  id              uuid primary key default uuid_generate_v4(),
  call_sheet_id   uuid not null references call_sheets(id) on delete cascade,
  department_id   uuid references departments(id) on delete set null,
  department_name text not null,
  call_time       time not null,
  notes           text,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now()
);

create table if not exists call_sheet_recipients (
  id               uuid primary key default uuid_generate_v4(),
  call_sheet_id    uuid not null references call_sheets(id) on delete cascade,
  resource_id      uuid references resources(id) on delete set null,
  name             text not null,
  email            text,
  sent_at          timestamptz,
  first_viewed_at  timestamptz,
  view_count       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ================================================================
-- COLLABORATION — Comments, Notifications, Activity Logs
-- ================================================================

create table if not exists comments (
  id           uuid primary key default uuid_generate_v4(),
  project_id   uuid not null references projects(id) on delete cascade,
  entity_type  text not null,
  entity_id    uuid not null,
  parent_id    uuid references comments(id) on delete cascade,
  content      text not null,
  created_by   uuid not null references auth.users(id) on delete cascade,
  edited_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists comment_mentions (
  id          uuid primary key default uuid_generate_v4(),
  comment_id  uuid not null references comments(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique(comment_id, user_id)
);

create table if not exists notifications (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  project_id        uuid references projects(id) on delete cascade,
  notification_type notification_type not null,
  title             text not null,
  body              text,
  link_url          text,
  entity_type       text,
  entity_id         uuid,
  is_read           boolean not null default false,
  read_at           timestamptz,
  created_at        timestamptz not null default now()
);

create table if not exists notification_preferences (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  project_id        uuid references projects(id) on delete cascade,
  notification_type notification_type not null,
  channel           notification_channel not null,
  enabled           boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique(user_id, project_id, notification_type, channel)
);

create table if not exists activity_logs (
  id           uuid primary key default uuid_generate_v4(),
  project_id   uuid not null references projects(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,
  action       text not null,
  entity_type  text,
  entity_id    uuid,
  details      jsonb,
  created_at   timestamptz not null default now()
);

-- ================================================================
-- GUEST ACCESS
-- ================================================================

create table if not exists guest_tokens (
  id           uuid primary key default uuid_generate_v4(),
  project_id   uuid not null references projects(id) on delete cascade,
  token        text not null unique default encode(gen_random_bytes(24), 'hex'),
  label        text not null,
  created_by   uuid not null references auth.users(id) on delete cascade,
  is_active    boolean not null default true,
  expires_at   timestamptz,
  last_used_at timestamptz,
  use_count    integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists guest_token_permissions (
  id          uuid primary key default uuid_generate_v4(),
  token_id    uuid not null references guest_tokens(id) on delete cascade,
  permission  guest_permission not null,
  created_at  timestamptz not null default now(),
  unique(token_id, permission)
);

create table if not exists guest_activity_logs (
  id          uuid primary key default uuid_generate_v4(),
  token_id    uuid not null references guest_tokens(id) on delete cascade,
  action      text not null,
  entity_type text,
  entity_id   uuid,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- ================================================================
-- PRODUCTION RULES & UNION PRESETS
-- ================================================================

create table if not exists production_rules (
  id               uuid primary key default uuid_generate_v4(),
  project_id       uuid not null references projects(id) on delete cascade,
  name             text not null,
  description      text,
  category         rule_category not null,
  constraint_type  rule_constraint_type not null default 'SOFT',
  rule_key         text not null,
  rule_value       jsonb not null,
  applies_to_type  text,
  applies_to_id    uuid,
  is_active        boolean not null default true,
  preset_source    text,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists union_presets (
  id           uuid primary key default uuid_generate_v4(),
  preset_name  text not null unique,
  display_name text not null,
  description  text,
  rules        jsonb not null,
  created_at   timestamptz not null default now()
);

insert into union_presets (preset_name, display_name, description, rules) values
(
  'SAG_AFTRA', 'SAG-AFTRA', 'Screen Actors Guild — American Federation of Television and Radio Artists',
  '[{"key":"min_turnaround_hours","value":12,"name":"Minimum Turnaround","constraint_type":"HARD","category":"TURNAROUND"},{"key":"max_work_hours_day","value":8,"name":"Basic Session Max","constraint_type":"HARD","category":"WORKING_HOURS"},{"key":"meal_penalty_after_minutes","value":330,"name":"Meal Penalty After 5.5h","constraint_type":"HARD","category":"WORKING_HOURS"}]'
),
(
  'IATSE', 'IATSE', 'International Alliance of Theatrical Stage Employees',
  '[{"key":"min_turnaround_hours","value":10,"name":"Minimum Turnaround","constraint_type":"HARD","category":"TURNAROUND"},{"key":"max_shooting_hours","value":12,"name":"Max Shooting Hours","constraint_type":"HARD","category":"WORKING_HOURS"},{"key":"overtime_after_hours","value":8,"name":"Overtime After 8h","constraint_type":"HARD","category":"OVERTIME"}]'
),
(
  'DGA', 'DGA', 'Directors Guild of America',
  '[{"key":"min_turnaround_hours","value":12,"name":"Director Minimum Turnaround","constraint_type":"HARD","category":"TURNAROUND"},{"key":"max_consecutive_days","value":6,"name":"Max Consecutive Days","constraint_type":"HARD","category":"CONSECUTIVE_DAYS"}]'
);

-- ================================================================
-- ROW LEVEL SECURITY — Enable on all tables
-- ================================================================

alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table organization_invitations enable row level security;
alter table user_profiles enable row level security;
alter table projects enable row level security;
alter table project_members enable row level security;
alter table project_settings enable row level security;
alter table departments enable row level security;
alter table roles enable row level security;
alter table resources enable row level security;
alter table resource_roles enable row level security;
alter table resource_groups enable row level security;
alter table resource_group_members enable row level security;
alter table resource_rates enable row level security;
alter table budget_line_items enable row level security;
alter table location_details enable row level security;
alter table location_contacts enable row level security;
alter table location_photos enable row level security;
alter table travel_times enable row level security;
alter table resource_availability enable row level security;
alter table availability_rules enable row level security;
alter table script_documents enable row level security;
alter table script_pages enable row level security;
alter table scenes enable row level security;
alter table scene_elements enable row level security;
alter table scene_requirements enable row level security;
alter table scene_tags enable row level security;
alter table scene_notes enable row level security;
alter table shoot_days enable row level security;
alter table shoot_day_scenes enable row level security;
alter table resource_bookings enable row level security;
alter table schedule_versions enable row level security;
alter table schedule_changes enable row level security;
alter table schedule_locks enable row level security;
alter table conflicts enable row level security;
alter table validation_runs enable row level security;
alter table ai_jobs enable row level security;
alter table ai_suggestions enable row level security;
alter table ai_conversations enable row level security;
alter table call_sheets enable row level security;
alter table call_sheet_departments enable row level security;
alter table call_sheet_recipients enable row level security;
alter table comments enable row level security;
alter table comment_mentions enable row level security;
alter table notifications enable row level security;
alter table notification_preferences enable row level security;
alter table activity_logs enable row level security;
alter table guest_tokens enable row level security;
alter table guest_token_permissions enable row level security;
alter table guest_activity_logs enable row level security;
alter table production_rules enable row level security;
alter table union_presets enable row level security;

-- ================================================================
-- RLS HELPER FUNCTIONS
-- ================================================================

create or replace function is_org_member(org_id uuid)
returns boolean language sql security definer stable as $$
  select exists (select 1 from organization_members where organization_id = org_id and user_id = auth.uid());
$$;

create or replace function is_org_admin(org_id uuid)
returns boolean language sql security definer stable as $$
  select exists (select 1 from organization_members where organization_id = org_id and user_id = auth.uid() and role in ('OWNER', 'ADMIN'));
$$;

create or replace function is_project_member(proj_id uuid)
returns boolean language sql security definer stable as $$
  select exists (select 1 from project_members where project_id = proj_id and user_id = auth.uid());
$$;

create or replace function can_modify_project(proj_id uuid)
returns boolean language sql security definer stable as $$
  select exists (select 1 from project_members where project_id = proj_id and user_id = auth.uid() and role in ('OWNER', 'ADMIN', 'COORDINATOR'));
$$;

-- ================================================================
-- RLS POLICIES
-- ================================================================

-- Organizations
create policy "View orgs you belong to" on organizations for select using (is_org_member(id) or created_by = auth.uid());
create policy "Create orgs when authenticated" on organizations for insert with check (auth.uid() is not null);
create policy "Org admins can update org" on organizations for update using (is_org_admin(id));

-- Organization Members
create policy "View members of your orgs" on organization_members for select using (is_org_member(organization_id));
create policy "Org admins manage members" on organization_members for all using (
  is_org_admin(organization_id) or exists (
    select 1 from organizations where id = organization_members.organization_id and created_by = auth.uid()
  )
);

-- User Profiles
create policy "View own profile" on user_profiles for select using (id = auth.uid());
create policy "Update own profile" on user_profiles for update using (id = auth.uid());
create policy "View co-member profiles" on user_profiles for select
  using (exists (select 1 from project_members pm1 join project_members pm2 on pm1.project_id = pm2.project_id where pm1.user_id = auth.uid() and pm2.user_id = user_profiles.id));

-- Projects
create policy "View your projects" on projects for select using (is_project_member(id));
create policy "Org members create projects" on projects for insert with check (is_org_member(organization_id));
create policy "Project admins update projects" on projects for update using (can_modify_project(id));
create policy "Project owners delete projects" on projects for delete
  using (exists (select 1 from project_members where project_id = projects.id and user_id = auth.uid() and role = 'OWNER'));

-- Project Members & Settings
create policy "View project members" on project_members for select using (is_project_member(project_id));
create policy "Admins manage project members" on project_members for all using (can_modify_project(project_id));
create policy "View project settings" on project_settings for select using (is_project_member(project_id));
create policy "Admins update project settings" on project_settings for all using (can_modify_project(project_id));

-- Departments & Roles
create policy "View departments" on departments for select using (is_project_member(project_id));
create policy "Admins manage departments" on departments for all using (can_modify_project(project_id));
create policy "View roles" on roles for select using (is_project_member(project_id));
create policy "Admins manage roles" on roles for all using (can_modify_project(project_id));

-- Resources
create policy "View resources" on resources for select using (is_project_member(project_id));
create policy "Admins manage resources" on resources for all using (can_modify_project(project_id));
create policy "View resource groups" on resource_groups for select using (is_project_member(project_id));
create policy "Admins manage resource groups" on resource_groups for all using (can_modify_project(project_id));

-- Budget
create policy "View budget items" on budget_line_items for select using (is_project_member(project_id));
create policy "Admins manage budget items" on budget_line_items for all using (can_modify_project(project_id));

-- Location
create policy "View travel times" on travel_times for select using (is_project_member(project_id));
create policy "Admins manage travel times" on travel_times for all using (can_modify_project(project_id));

-- Availability
create policy "View availability" on resource_availability for select using (is_project_member(project_id));
create policy "Admins manage availability" on resource_availability for all using (can_modify_project(project_id));

-- Scripts
create policy "View scripts" on script_documents for select using (is_project_member(project_id));
create policy "Admins manage scripts" on script_documents for all using (can_modify_project(project_id));
create policy "View script pages" on script_pages for select
  using (exists (select 1 from script_documents sd where sd.id = script_pages.script_document_id and is_project_member(sd.project_id)));

-- Scenes
create policy "View scenes" on scenes for select using (is_project_member(project_id));
create policy "Admins manage scenes" on scenes for all using (can_modify_project(project_id));
create policy "View scene tags" on scene_tags for select using (is_project_member(project_id));
create policy "Admins manage scene tags" on scene_tags for all using (can_modify_project(project_id));
create policy "View scene elements" on scene_elements for select
  using (exists (select 1 from scenes s where s.id = scene_elements.scene_id and is_project_member(s.project_id)));
create policy "Admins manage scene elements" on scene_elements for all
  using (exists (select 1 from scenes s where s.id = scene_elements.scene_id and can_modify_project(s.project_id)));
create policy "View scene requirements" on scene_requirements for select
  using (exists (select 1 from scenes s where s.id = scene_requirements.scene_id and is_project_member(s.project_id)));
create policy "Admins manage scene requirements" on scene_requirements for all
  using (exists (select 1 from scenes s where s.id = scene_requirements.scene_id and can_modify_project(s.project_id)));

-- Scheduling
create policy "View shoot days" on shoot_days for select using (is_project_member(project_id));
create policy "Admins manage shoot days" on shoot_days for all using (can_modify_project(project_id));
create policy "View shoot day scenes" on shoot_day_scenes for select
  using (exists (select 1 from shoot_days sd where sd.id = shoot_day_scenes.shoot_day_id and is_project_member(sd.project_id)));
create policy "Admins manage shoot day scenes" on shoot_day_scenes for all
  using (exists (select 1 from shoot_days sd where sd.id = shoot_day_scenes.shoot_day_id and can_modify_project(sd.project_id)));
create policy "View bookings" on resource_bookings for select using (is_project_member(project_id));
create policy "Admins manage bookings" on resource_bookings for all using (can_modify_project(project_id));

-- Versioning
create policy "View schedule versions" on schedule_versions for select using (is_project_member(project_id));
create policy "Admins create versions" on schedule_versions for insert with check (can_modify_project(project_id));
create policy "View schedule changes" on schedule_changes for select
  using (exists (select 1 from schedule_versions sv where sv.id = schedule_changes.version_id and is_project_member(sv.project_id)));
create policy "View schedule locks" on schedule_locks for select using (is_project_member(project_id));
create policy "Admins manage locks" on schedule_locks for all using (can_modify_project(project_id));

-- Conflicts
create policy "View conflicts" on conflicts for select using (is_project_member(project_id));
create policy "Admins manage conflicts" on conflicts for all using (can_modify_project(project_id));
create policy "View validation runs" on validation_runs for select using (is_project_member(project_id));

-- AI
create policy "View AI jobs" on ai_jobs for select using (is_project_member(project_id));
create policy "Admins create AI jobs" on ai_jobs for insert with check (can_modify_project(project_id));
create policy "View AI suggestions" on ai_suggestions for select using (is_project_member(project_id));
create policy "Admins manage AI suggestions" on ai_suggestions for all using (can_modify_project(project_id));
create policy "View AI conversations" on ai_conversations for select using (is_project_member(project_id));
create policy "Members add AI conversations" on ai_conversations for insert with check (is_project_member(project_id) and user_id = auth.uid());

-- Call Sheets
create policy "View call sheets" on call_sheets for select using (is_project_member(project_id));
create policy "Admins manage call sheets" on call_sheets for all using (can_modify_project(project_id));
create policy "View call sheet departments" on call_sheet_departments for select
  using (exists (select 1 from call_sheets cs where cs.id = call_sheet_departments.call_sheet_id and is_project_member(cs.project_id)));
create policy "View call sheet recipients" on call_sheet_recipients for select
  using (exists (select 1 from call_sheets cs where cs.id = call_sheet_recipients.call_sheet_id and is_project_member(cs.project_id)));

-- Collaboration
create policy "View comments" on comments for select using (is_project_member(project_id));
create policy "Members add comments" on comments for insert with check (is_project_member(project_id) and created_by = auth.uid());
create policy "Authors edit comments" on comments for update using (created_by = auth.uid());
create policy "View own notifications" on notifications for select using (user_id = auth.uid());
create policy "Update own notifications" on notifications for update using (user_id = auth.uid());
create policy "Manage own preferences" on notification_preferences for all using (user_id = auth.uid());
create policy "View activity logs" on activity_logs for select using (is_project_member(project_id));

-- Guest Access
create policy "Admins manage guest tokens" on guest_tokens for all using (can_modify_project(project_id));
create policy "Members view guest tokens" on guest_tokens for select using (is_project_member(project_id));

-- Production Rules
create policy "View production rules" on production_rules for select using (is_project_member(project_id));
create policy "Admins manage production rules" on production_rules for all using (can_modify_project(project_id));
create policy "Anyone view union presets" on union_presets for select using (true);

-- ================================================================
-- PERFORMANCE INDEXES
-- ================================================================

create index idx_org_members_org_id on organization_members(organization_id);
create index idx_org_members_user_id on organization_members(user_id);
create index idx_org_invitations_token on organization_invitations(token);
create index idx_projects_org_id on projects(organization_id);
create index idx_projects_status on projects(status);
create index idx_project_members_project on project_members(project_id);
create index idx_project_members_user on project_members(user_id);
create index idx_resources_project_id on resources(project_id);
create index idx_resources_type on resources(resource_type);
create index idx_resources_active on resources(project_id, is_active);
create index idx_departments_project on departments(project_id);
create index idx_roles_department on roles(department_id);
create index idx_roles_project on roles(project_id);
create index idx_resource_rates_resource on resource_rates(resource_id);
create index idx_location_details_resource on location_details(resource_id);
create index idx_travel_times_project on travel_times(project_id);
create index idx_availability_resource on resource_availability(resource_id);
create index idx_availability_project on resource_availability(project_id);
create index idx_availability_resource_range on resource_availability(resource_id, start_at, end_at);
create index idx_scripts_project on script_documents(project_id);
create index idx_scripts_is_current on script_documents(project_id, is_current);
create index idx_script_pages_document on script_pages(script_document_id);
create index idx_scenes_project on scenes(project_id);
create index idx_scenes_status on scenes(project_id, status);
create index idx_scenes_number on scenes(project_id, scene_number);
create index idx_scene_elements_scene on scene_elements(scene_id);
create index idx_scene_requirements_scene on scene_requirements(scene_id);
create index idx_scene_requirements_res on scene_requirements(resource_id);
create index idx_scene_tags_scene on scene_tags(scene_id);
create index idx_scene_tags_project on scene_tags(project_id);
create index idx_shoot_days_project on shoot_days(project_id);
create index idx_shoot_days_date on shoot_days(project_id, shoot_date);
create index idx_shoot_days_status on shoot_days(project_id, status);
create index idx_shoot_day_scenes_day on shoot_day_scenes(shoot_day_id);
create index idx_shoot_day_scenes_scene on shoot_day_scenes(scene_id);
create index idx_bookings_project on resource_bookings(project_id);
create index idx_bookings_shoot_day on resource_bookings(shoot_day_id);
create index idx_bookings_resource on resource_bookings(resource_id);
create index idx_bookings_resource_day on resource_bookings(resource_id, shoot_day_id);
create index idx_versions_project on schedule_versions(project_id);
create index idx_versions_current on schedule_versions(project_id, is_current);
create index idx_versions_created on schedule_versions(project_id, created_at desc);
create index idx_changes_version on schedule_changes(version_id);
create index idx_conflicts_project on conflicts(project_id);
create index idx_conflicts_status on conflicts(project_id, status);
create index idx_conflicts_severity on conflicts(project_id, severity);
create index idx_conflicts_day on conflicts(shoot_day_id);
create index idx_ai_jobs_project on ai_jobs(project_id);
create index idx_ai_jobs_status on ai_jobs(project_id, status);
create index idx_ai_suggestions_project on ai_suggestions(project_id);
create index idx_ai_suggestions_status on ai_suggestions(project_id, status);
create index idx_ai_conversations_project on ai_conversations(project_id);
create index idx_callsheets_project on call_sheets(project_id);
create index idx_callsheets_shoot_day on call_sheets(shoot_day_id);
create index idx_callsheets_token on call_sheets(share_token);
create index idx_comments_project on comments(project_id);
create index idx_comments_entity on comments(entity_type, entity_id);
create index idx_notifications_user on notifications(user_id);
create index idx_notifications_unread on notifications(user_id, is_read) where is_read = false;
create index idx_activity_project on activity_logs(project_id);
create index idx_activity_created on activity_logs(project_id, created_at desc);
create index idx_guest_tokens_project on guest_tokens(project_id);
create index idx_guest_tokens_token on guest_tokens(token);
create index idx_prod_rules_project on production_rules(project_id);
create index idx_prod_rules_active on production_rules(project_id, is_active);

-- ================================================================
-- TRIGGERS — updated_at auto-management
-- ================================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_organizations_updated_at before update on organizations for each row execute function set_updated_at();
create trigger trg_user_profiles_updated_at before update on user_profiles for each row execute function set_updated_at();
create trigger trg_projects_updated_at before update on projects for each row execute function set_updated_at();
create trigger trg_project_settings_updated_at before update on project_settings for each row execute function set_updated_at();
create trigger trg_departments_updated_at before update on departments for each row execute function set_updated_at();
create trigger trg_roles_updated_at before update on roles for each row execute function set_updated_at();
create trigger trg_resources_updated_at before update on resources for each row execute function set_updated_at();
create trigger trg_resource_rates_updated_at before update on resource_rates for each row execute function set_updated_at();
create trigger trg_budget_line_items_updated_at before update on budget_line_items for each row execute function set_updated_at();
create trigger trg_location_details_updated_at before update on location_details for each row execute function set_updated_at();
create trigger trg_resource_availability_updated_at before update on resource_availability for each row execute function set_updated_at();
create trigger trg_script_documents_updated_at before update on script_documents for each row execute function set_updated_at();
create trigger trg_scenes_updated_at before update on scenes for each row execute function set_updated_at();
create trigger trg_scene_elements_updated_at before update on scene_elements for each row execute function set_updated_at();
create trigger trg_scene_requirements_updated_at before update on scene_requirements for each row execute function set_updated_at();
create trigger trg_shoot_days_updated_at before update on shoot_days for each row execute function set_updated_at();
create trigger trg_shoot_day_scenes_updated_at before update on shoot_day_scenes for each row execute function set_updated_at();
create trigger trg_resource_bookings_updated_at before update on resource_bookings for each row execute function set_updated_at();
create trigger trg_conflicts_updated_at before update on conflicts for each row execute function set_updated_at();
create trigger trg_ai_jobs_updated_at before update on ai_jobs for each row execute function set_updated_at();
create trigger trg_ai_suggestions_updated_at before update on ai_suggestions for each row execute function set_updated_at();
create trigger trg_call_sheets_updated_at before update on call_sheets for each row execute function set_updated_at();
create trigger trg_call_sheet_recipients_updated_at before update on call_sheet_recipients for each row execute function set_updated_at();
create trigger trg_comments_updated_at before update on comments for each row execute function set_updated_at();
create trigger trg_notification_preferences_updated_at before update on notification_preferences for each row execute function set_updated_at();
create trigger trg_guest_tokens_updated_at before update on guest_tokens for each row execute function set_updated_at();
create trigger trg_production_rules_updated_at before update on production_rules for each row execute function set_updated_at();

-- Single current script per project
create or replace function enforce_single_current_script()
returns trigger language plpgsql as $$
begin
  if new.is_current = true then
    update script_documents set is_current = false
    where project_id = new.project_id and id != new.id;
  end if;
  return new;
end;
$$;

create trigger trg_single_current_script
  before insert or update on script_documents
  for each row execute function enforce_single_current_script();

-- Single current schedule version per project
create or replace function enforce_single_current_version()
returns trigger language plpgsql as $$
begin
  if new.is_current = true then
    update schedule_versions set is_current = false
    where project_id = new.project_id and id != new.id;
  end if;
  return new;
end;
$$;

create trigger trg_single_current_version
  before insert or update on schedule_versions
  for each row execute function enforce_single_current_version();

-- Auto-increment version number per project
create or replace function auto_version_number()
returns trigger language plpgsql as $$
begin
  new.version_number := coalesce(
    (select max(version_number) from schedule_versions where project_id = new.project_id), 0
  ) + 1;
  return new;
end;
$$;

create trigger trg_auto_version_number
  before insert on schedule_versions
  for each row execute function auto_version_number();

-- ================================================================
-- PERMISSIONS & GRANTS
-- ================================================================
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on all tables in schema public to postgres, anon, authenticated, service_role;
grant all on all functions in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;

-- ================================================================
-- DONE! All tables, enums, RLS policies, indexes, and triggers
-- created successfully. You should see 40+ tables in your
-- Supabase Table Editor.
-- ================================================================
