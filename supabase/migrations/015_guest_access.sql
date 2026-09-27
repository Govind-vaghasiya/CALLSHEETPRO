-- ============================================================
-- 015_guest_access.sql
-- Guest tokens for external stakeholder access (no login required)
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

create type guest_permission as enum (
  'READ_SCHEDULE',
  'READ_CALLSHEET',
  'READ_BREAKDOWN',
  'READ_RESOURCES'
);

-- ============================================================
-- guest_tokens
-- ============================================================
create table guest_tokens (
  id           uuid primary key default uuid_generate_v4(),
  project_id   uuid not null references projects(id) on delete cascade,
  token        text not null unique default encode(gen_random_bytes(24), 'hex'),
  label        text not null,            -- e.g. "Actor Agent - Sarah Lee's Agent"
  created_by   uuid not null references auth.users(id) on delete cascade,
  is_active    boolean not null default true,
  expires_at   timestamptz,             -- null = no expiry
  last_used_at timestamptz,
  use_count    integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============================================================
-- guest_permissions  (what each token can access)
-- ============================================================
create table guest_token_permissions (
  id          uuid primary key default uuid_generate_v4(),
  token_id    uuid not null references guest_tokens(id) on delete cascade,
  permission  guest_permission not null,
  created_at  timestamptz not null default now(),
  unique(token_id, permission)
);

-- ============================================================
-- guest_activity_logs  (what guests accessed and when)
-- ============================================================
create table guest_activity_logs (
  id           uuid primary key default uuid_generate_v4(),
  token_id     uuid not null references guest_tokens(id) on delete cascade,
  action       text not null,            -- e.g. 'VIEW_SCHEDULE', 'DOWNLOAD_CALLSHEET'
  entity_type  text,
  entity_id    uuid,
  ip_address   text,
  user_agent   text,
  created_at   timestamptz not null default now()
);
