-- ============================================================
-- 008_scenes.sql
-- Scenes, elements, requirements, tags, and notes
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

create type scene_status as enum (
  'DETECTED', 'REVIEWED', 'CONFIRMED', 'LOCKED'
);

create type int_ext as enum ('INT', 'EXT', 'INT_EXT');

create type time_of_day as enum (
  'DAY', 'NIGHT', 'DAWN', 'DUSK', 'CONTINUOUS', 'LATER', 'MOMENTS_LATER', 'SAME_TIME'
);

create type scene_element_type as enum (
  'CAST', 'EXTRA', 'PROP', 'LOCATION', 'WARDROBE', 'MAKEUP',
  'VEHICLE', 'ANIMAL', 'STUNT', 'VFX', 'SFX', 'SOUND',
  'EQUIPMENT', 'MUSIC', 'OTHER'
);

create type element_confirm_status as enum (
  'AI_DETECTED', 'CONFIRMED', 'EDITED', 'REMOVED'
);

-- ============================================================
-- scenes
-- ============================================================
create table scenes (
  id                  uuid primary key default uuid_generate_v4(),
  project_id          uuid not null references projects(id) on delete cascade,
  script_document_id  uuid references script_documents(id) on delete set null,
  scene_number        text not null,     -- "42", "42A", "42B" etc.
  scene_order         integer,           -- sequential order in script
  heading             text,              -- full scene heading e.g. "INT. RESTAURANT - NIGHT"
  int_ext             int_ext,
  location_name       text,              -- raw text from heading
  time_of_day         time_of_day,
  page_start          numeric(6,1),      -- supports "42.5" (page 42, half way)
  page_end            numeric(6,1),
  description         text,              -- action lines summary
  estimated_duration  integer,           -- minutes
  episode_number      text,              -- for TV series
  status              scene_status not null default 'DETECTED',
  ai_confidence       integer,           -- 0-100 overall breakdown confidence
  revision_color      revision_color,    -- which revision this scene was added in
  is_changed          boolean not null default false, -- changed in current revision
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique(project_id, scene_number)
);

-- ============================================================
-- scene_elements  (AI-detected production elements per scene)
-- ============================================================
create table scene_elements (
  id             uuid primary key default uuid_generate_v4(),
  scene_id       uuid not null references scenes(id) on delete cascade,
  element_type   scene_element_type not null,
  name           text not null,          -- raw detected name ("John Smith", "Red briefcase")
  description    text,
  ai_confidence  integer,               -- 0-100
  confirm_status element_confirm_status not null default 'AI_DETECTED',
  confirmed_by   uuid references auth.users(id) on delete set null,
  confirmed_at   timestamptz,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ============================================================
-- scene_requirements (scene elements linked to actual resources)
-- ============================================================
create table scene_requirements (
  id           uuid primary key default uuid_generate_v4(),
  scene_id     uuid not null references scenes(id) on delete cascade,
  resource_id  uuid not null references resources(id) on delete cascade,
  element_id   uuid references scene_elements(id) on delete set null,
  required     boolean not null default true,  -- false = nice to have
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique(scene_id, resource_id)
);

-- ============================================================
-- scene_tags  (color tags + custom tags on scenes)
-- ============================================================
create type scene_tag_type as enum (
  'INT_EXT',        -- auto
  'TIME_OF_DAY',    -- auto
  'STUNT',          -- predefined
  'VFX_HEAVY',      -- predefined
  'NIGHT_SHOOT',    -- predefined
  'WATER',          -- predefined
  'ANIMALS',        -- predefined
  'CHILDREN',       -- predefined
  'SENSITIVE',      -- predefined
  'EXTERIOR_WEATHER', -- predefined
  'CUSTOM'          -- user-defined
);

create table scene_tags (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references projects(id) on delete cascade,
  scene_id    uuid not null references scenes(id) on delete cascade,
  tag_type    scene_tag_type not null default 'CUSTOM',
  label       text not null,
  color       text,                      -- hex color
  created_at  timestamptz not null default now(),
  unique(scene_id, label)
);

-- ============================================================
-- scene_notes
-- ============================================================
create table scene_notes (
  id          uuid primary key default uuid_generate_v4(),
  scene_id    uuid not null references scenes(id) on delete cascade,
  note        text not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
