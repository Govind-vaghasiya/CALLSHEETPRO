-- ============================================================
-- 003_production.sql
-- Departments, roles, resources, and resource groups
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

create type resource_type as enum (
  'PERSON', 'EQUIPMENT', 'LOCATION', 'PROP', 'VEHICLE', 'ANIMAL', 'OTHER'
);

-- ============================================================
-- departments
-- ============================================================
create table departments (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references projects(id) on delete cascade,
  name        text not null,
  code        text,                    -- e.g. "CAM", "SND", "ART"
  color       text,                    -- hex color for UI
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(project_id, name)
);

-- ============================================================
-- roles
-- ============================================================
create table roles (
  id            uuid primary key default uuid_generate_v4(),
  department_id uuid not null references departments(id) on delete cascade,
  project_id    uuid not null references projects(id) on delete cascade,
  name          text not null,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(department_id, name)
);

-- ============================================================
-- resources
-- ============================================================
create table resources (
  id             uuid primary key default uuid_generate_v4(),
  project_id     uuid not null references projects(id) on delete cascade,
  resource_type  resource_type not null,
  name           text not null,
  display_name   text,                  -- stage name / call name
  email          text,
  phone          text,
  notes          text,
  is_active      boolean not null default true,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ============================================================
-- resource_roles  (person can have many roles)
-- ============================================================
create table resource_roles (
  id           uuid primary key default uuid_generate_v4(),
  resource_id  uuid not null references resources(id) on delete cascade,
  role_id      uuid not null references roles(id) on delete cascade,
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now(),
  unique(resource_id, role_id)
);

-- ============================================================
-- resource_groups  (e.g. "Camera Package A")
-- ============================================================
create table resource_groups (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references projects(id) on delete cascade,
  name        text not null,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table resource_group_members (
  id                uuid primary key default uuid_generate_v4(),
  resource_group_id uuid not null references resource_groups(id) on delete cascade,
  resource_id       uuid not null references resources(id) on delete cascade,
  created_at        timestamptz not null default now(),
  unique(resource_group_id, resource_id)
);
