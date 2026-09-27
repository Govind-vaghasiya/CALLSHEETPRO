-- ============================================================
-- 014_collaboration.sql
-- Comments, notifications, preferences, and activity logs
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

create type notification_type as enum (
  'CONFLICT_DETECTED',
  'SCHEDULE_PUBLISHED',
  'CALL_SHEET_PUBLISHED',
  'CALL_SHEET_REVISED',
  'AI_JOB_COMPLETE',
  'AVAILABILITY_IMPACT',
  'COMMENT_MENTION',
  'COMMENT_REPLY',
  'RESOURCE_BOOKING_CHANGED',
  'SCRIPT_REVISION_UPLOADED',
  'INVITATION_RECEIVED',
  'MEMBER_JOINED'
);

create type notification_channel as enum ('IN_APP', 'EMAIL');

-- ============================================================
-- comments  (on scenes, shoot_days, resources, conflicts, ai_suggestions)
-- ============================================================
create table comments (
  id           uuid primary key default uuid_generate_v4(),
  project_id   uuid not null references projects(id) on delete cascade,
  entity_type  text not null,            -- 'scene', 'shoot_day', 'resource', 'conflict', 'ai_suggestion'
  entity_id    uuid not null,
  parent_id    uuid references comments(id) on delete cascade,  -- for threads
  content      text not null,
  created_by   uuid not null references auth.users(id) on delete cascade,
  edited_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============================================================
-- comment_mentions
-- ============================================================
create table comment_mentions (
  id          uuid primary key default uuid_generate_v4(),
  comment_id  uuid not null references comments(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique(comment_id, user_id)
);

-- ============================================================
-- notifications
-- ============================================================
create table notifications (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  project_id        uuid references projects(id) on delete cascade,
  notification_type notification_type not null,
  title             text not null,
  body              text,
  link_url          text,                -- deep link into the app
  entity_type       text,
  entity_id         uuid,
  is_read           boolean not null default false,
  read_at           timestamptz,
  created_at        timestamptz not null default now()
);

-- ============================================================
-- notification_preferences (per user, per project)
-- ============================================================
create table notification_preferences (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  project_id        uuid references projects(id) on delete cascade,  -- null = global default
  notification_type notification_type not null,
  channel           notification_channel not null,
  enabled           boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique(user_id, project_id, notification_type, channel)
);

-- ============================================================
-- activity_logs  (immutable audit of all project actions)
-- ============================================================
create table activity_logs (
  id           uuid primary key default uuid_generate_v4(),
  project_id   uuid not null references projects(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,
  action       text not null,            -- e.g. 'SCENE_MOVED', 'CALL_SHEET_PUBLISHED'
  entity_type  text,
  entity_id    uuid,
  details      jsonb,
  created_at   timestamptz not null default now()
);
