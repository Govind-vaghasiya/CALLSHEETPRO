-- ============================================================
-- 020_characters.sql
-- Characters are separate from people: LAKHAN (character) is played by
-- Anil Kapoor (a PERSON in resources). Breakdown CAST items point at a
-- character; casting the character once updates the whole app.
-- Safe to run more than once. Only adds; nothing is changed or deleted.
-- ============================================================

create table if not exists characters (
  id                 uuid primary key default uuid_generate_v4(),
  project_id         uuid not null references projects(id) on delete cascade,
  name               text not null,                 -- e.g. "LAKHAN"
  cast_number        integer,                       -- call sheet / DOOD cast ID
  actor_resource_id  uuid references resources(id) on delete set null,  -- who plays them
  description        text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- One character per name per production (stops duplicates like two "MAGAN PATEL")
create unique index if not exists characters_project_name_key on characters (project_id, upper(name));
create index if not exists characters_project_idx on characters (project_id);
create index if not exists characters_actor_idx on characters (actor_resource_id);

-- Breakdown CAST items point at their character
alter table scene_elements add column if not exists character_id uuid references characters(id) on delete set null;
create index if not exists scene_elements_character_idx on scene_elements (character_id);

-- Row level security: same rules as the rest of the production data
alter table characters enable row level security;

drop policy if exists "Project members can view characters" on characters;
create policy "Project members can view characters"
  on characters for select using (is_project_member(project_id));

drop policy if exists "Project admins can modify characters" on characters;
create policy "Project admins can modify characters"
  on characters for all using (can_modify_project(project_id));
