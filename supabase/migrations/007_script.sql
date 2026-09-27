-- ============================================================
-- 007_script.sql
-- Script documents, pages, and revision tracking
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

create type script_status as enum (
  'UPLOADED', 'PROCESSING', 'PROCESSED', 'FAILED', 'ARCHIVED'
);

create type script_file_type as enum (
  'PDF', 'FDX', 'DOCX', 'TXT', 'OTHER'
);

-- Film industry script revision color system
create type revision_color as enum (
  'WHITE',      -- Original / First draft
  'BLUE',       -- 1st revision
  'PINK',       -- 2nd revision
  'YELLOW',     -- 3rd revision
  'GREEN',      -- 4th revision
  'GOLDENROD',  -- 5th revision
  'BUFF',       -- 6th revision
  'SALMON',     -- 7th revision
  'CHERRY',     -- 8th revision
  'TAN',        -- 9th revision
  'DOUBLE_WHITE', -- 10th revision restart
  'CUSTOM'
);

-- ============================================================
-- script_documents
-- ============================================================
create table script_documents (
  id              uuid primary key default uuid_generate_v4(),
  project_id      uuid not null references projects(id) on delete cascade,
  file_name       text not null,
  storage_path    text not null,
  file_type       script_file_type not null,
  file_size_bytes bigint,
  status          script_status not null default 'UPLOADED',
  version         integer not null default 1,
  revision_color  revision_color not null default 'WHITE',
  revision_date   date,
  revision_notes  text,
  is_current      boolean not null default false,  -- marks the active script
  total_pages     integer,
  total_scenes    integer,
  uploaded_by     uuid references auth.users(id) on delete set null,
  processed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- script_pages
-- ============================================================
create table script_pages (
  id                  uuid primary key default uuid_generate_v4(),
  script_document_id  uuid not null references script_documents(id) on delete cascade,
  page_number         integer not null,
  raw_text            text,
  created_at          timestamptz not null default now(),
  unique(script_document_id, page_number)
);
