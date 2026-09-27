-- ============================================================
-- 012_ai.sql
-- AI jobs, suggestions, conversations, and actions
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

create type ai_job_type as enum (
  'SCRIPT_BREAKDOWN',
  'SCHEDULE_ANALYSIS',
  'SCHEDULE_GENERATION',
  'CONFLICT_ANALYSIS',
  'RESOURCE_MATCHING',
  'AVAILABILITY_IMPACT',
  'OPTIMIZATION'
);

create type ai_job_status as enum (
  'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'
);

create type ai_suggestion_status as enum (
  'PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'
);

-- ============================================================
-- ai_jobs
-- ============================================================
create table ai_jobs (
  id            uuid primary key default uuid_generate_v4(),
  project_id    uuid not null references projects(id) on delete cascade,
  job_type      ai_job_type not null,
  status        ai_job_status not null default 'QUEUED',
  input_data    jsonb,                   -- snapshot sent to AI
  output_data   jsonb,                   -- raw AI response
  error_message text,
  model_used    text,                    -- e.g. "claude-3-5-sonnet-20241022"
  input_tokens  integer,
  output_tokens integer,
  cost_usd      numeric(10,6),
  duration_ms   integer,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- ai_suggestions  (proposed schedule changes from AI)
-- ============================================================
create table ai_suggestions (
  id              uuid primary key default uuid_generate_v4(),
  project_id      uuid not null references projects(id) on delete cascade,
  job_id          uuid references ai_jobs(id) on delete set null,
  status          ai_suggestion_status not null default 'PENDING',
  title           text not null,
  description     text,
  reasoning       text,
  changes_json    jsonb not null,         -- proposed schedule diffs
  impact_json     jsonb,                  -- expected impact summary
  conflicts_before integer not null default 0,
  conflicts_after  integer not null default 0,
  reviewed_by     uuid references auth.users(id) on delete set null,
  reviewed_at     timestamptz,
  expires_at      timestamptz not null default (now() + interval '48 hours'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- ai_conversations  (chat history per project)
-- ============================================================
create table ai_conversations (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references projects(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  role        text not null,             -- 'user' or 'assistant'
  content     text not null,
  job_id      uuid references ai_jobs(id) on delete set null,
  created_at  timestamptz not null default now()
);
