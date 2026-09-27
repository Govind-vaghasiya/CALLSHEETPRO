-- ============================================================
-- 002_projects.sql
-- Projects and project-level membership
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

create type project_type as enum (
  'FEATURE', 'SHORT', 'TV', 'COMMERCIAL', 'MUSIC_VIDEO', 'DOCUMENTARY', 'OTHER'
);

create type project_status as enum (
  'DEVELOPMENT', 'PRE_PRODUCTION', 'PRODUCTION', 'POST', 'COMPLETED', 'ARCHIVED'
);

create type project_member_role as enum ('OWNER', 'ADMIN', 'COORDINATOR', 'MEMBER', 'VIEWER');

-- ============================================================
-- projects
-- ============================================================
create table projects (
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

-- ============================================================
-- project_members
-- ============================================================
create table project_members (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        project_member_role not null default 'MEMBER',
  created_at  timestamptz not null default now(),
  unique(project_id, user_id)
);

-- ============================================================
-- project_settings
-- ============================================================
create table project_settings (
  id                       uuid primary key default uuid_generate_v4(),
  project_id               uuid not null unique references projects(id) on delete cascade,
  default_call_time        time not null default '07:00',
  default_wrap_time        time not null default '19:00',
  max_shooting_hours       numeric(4,2) not null default 10.0,
  min_turnaround_hours     numeric(4,2) not null default 12.0,
  company_move_threshold   integer not null default 30, -- minutes
  currency                 text not null default 'USD',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- Auto-create project settings on project creation
create or replace function handle_new_project()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into project_settings (project_id) values (new.id);
  -- Auto-add creator as project owner
  insert into project_members (project_id, user_id, role)
  values (new.id, new.created_by, 'OWNER');
  return new;
end;
$$;

create trigger on_project_created
  after insert on projects
  for each row execute procedure handle_new_project();
