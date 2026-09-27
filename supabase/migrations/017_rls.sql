-- ============================================================
-- 017_rls.sql
-- Row Level Security policies for all tables
-- ============================================================

-- Enable RLS on every table
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

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Check if the current user is a member of an organization
create or replace function is_org_member(org_id uuid)
returns boolean
language sql
security definer stable
as $$
  select exists (
    select 1 from organization_members
    where organization_id = org_id
    and user_id = auth.uid()
  );
$$;

-- Check if the current user is an org admin or owner
create or replace function is_org_admin(org_id uuid)
returns boolean
language sql
security definer stable
as $$
  select exists (
    select 1 from organization_members
    where organization_id = org_id
    and user_id = auth.uid()
    and role in ('OWNER', 'ADMIN')
  );
$$;

-- Check if the current user is a member of a project
create or replace function is_project_member(proj_id uuid)
returns boolean
language sql
security definer stable
as $$
  select exists (
    select 1 from project_members
    where project_id = proj_id
    and user_id = auth.uid()
  );
$$;

-- Check if the current user can modify a project (owner, admin, coordinator)
create or replace function can_modify_project(proj_id uuid)
returns boolean
language sql
security definer stable
as $$
  select exists (
    select 1 from project_members
    where project_id = proj_id
    and user_id = auth.uid()
    and role in ('OWNER', 'ADMIN', 'COORDINATOR')
  );
$$;

-- Get org_id from project_id (used in policies)
create or replace function get_project_org_id(proj_id uuid)
returns uuid
language sql
security definer stable
as $$
  select organization_id from projects where id = proj_id;
$$;

-- ============================================================
-- ORGANIZATIONS
-- ============================================================

create policy "Users can view orgs they belong to"
  on organizations for select
  using (is_org_member(id));

create policy "Authenticated users can create orgs"
  on organizations for insert
  with check (auth.uid() is not null);

create policy "Org admins can update their org"
  on organizations for update
  using (is_org_admin(id));

-- ============================================================
-- ORGANIZATION MEMBERS
-- ============================================================

create policy "Members can view their org's members"
  on organization_members for select
  using (is_org_member(organization_id));

create policy "Org admins can manage members"
  on organization_members for all
  using (is_org_admin(organization_id));

create policy "Users can insert themselves (join via invite)"
  on organization_members for insert
  with check (user_id = auth.uid());

-- ============================================================
-- USER PROFILES
-- ============================================================

create policy "Users can view their own profile"
  on user_profiles for select
  using (id = auth.uid());

create policy "Users can update their own profile"
  on user_profiles for update
  using (id = auth.uid());

-- Allow project members to see co-members' basic profiles
create policy "Project members can view co-member profiles"
  on user_profiles for select
  using (
    exists (
      select 1 from project_members pm1
      join project_members pm2 on pm1.project_id = pm2.project_id
      where pm1.user_id = auth.uid()
      and pm2.user_id = user_profiles.id
    )
  );

-- ============================================================
-- PROJECTS  (and all project-scoped tables use is_project_member)
-- ============================================================

create policy "Project members can view their projects"
  on projects for select
  using (is_project_member(id));

create policy "Org members can create projects"
  on projects for insert
  with check (is_org_member(organization_id));

create policy "Project admins can update projects"
  on projects for update
  using (can_modify_project(id));

create policy "Project owners can delete projects"
  on projects for delete
  using (
    exists (
      select 1 from project_members
      where project_id = projects.id
      and user_id = auth.uid()
      and role = 'OWNER'
    )
  );

-- ============================================================
-- PROJECT-SCOPED TABLE POLICIES (generic pattern)
-- For: departments, roles, resources, scenes, shoot_days, etc.
-- ============================================================

-- project_members
create policy "Project members can view project members"
  on project_members for select
  using (is_project_member(project_id));

create policy "Project admins can manage project members"
  on project_members for all
  using (can_modify_project(project_id));

-- project_settings
create policy "Project members can view settings"
  on project_settings for select
  using (is_project_member(project_id));

create policy "Project admins can update settings"
  on project_settings for all
  using (can_modify_project(project_id));

-- departments
create policy "Project members can view departments"
  on departments for select using (is_project_member(project_id));
create policy "Project admins can modify departments"
  on departments for all using (can_modify_project(project_id));

-- roles
create policy "Project members can view roles"
  on roles for select using (is_project_member(project_id));
create policy "Project admins can modify roles"
  on roles for all using (can_modify_project(project_id));

-- resources
create policy "Project members can view resources"
  on resources for select using (is_project_member(project_id));
create policy "Project admins can modify resources"
  on resources for all using (can_modify_project(project_id));

-- resource_roles
create policy "Project members can view resource roles"
  on resource_roles for select
  using (exists (select 1 from resources r where r.id = resource_roles.resource_id and is_project_member(r.project_id)));
create policy "Project admins can modify resource roles"
  on resource_roles for all
  using (exists (select 1 from resources r where r.id = resource_roles.resource_id and can_modify_project(r.project_id)));

-- resource_groups
create policy "Project members can view resource groups"
  on resource_groups for select using (is_project_member(project_id));
create policy "Project admins can modify resource groups"
  on resource_groups for all using (can_modify_project(project_id));

-- resource_rates
create policy "Project members can view rates"
  on resource_rates for select
  using (exists (select 1 from resources r where r.id = resource_rates.resource_id and is_project_member(r.project_id)));
create policy "Project admins can modify rates"
  on resource_rates for all
  using (exists (select 1 from resources r where r.id = resource_rates.resource_id and can_modify_project(r.project_id)));

-- budget_line_items
create policy "Project members can view budget items"
  on budget_line_items for select using (is_project_member(project_id));
create policy "Project admins can modify budget items"
  on budget_line_items for all using (can_modify_project(project_id));

-- location_details
create policy "Project members can view location details"
  on location_details for select
  using (exists (select 1 from resources r where r.id = location_details.resource_id and is_project_member(r.project_id)));
create policy "Project admins can modify location details"
  on location_details for all
  using (exists (select 1 from resources r where r.id = location_details.resource_id and can_modify_project(r.project_id)));

-- location_contacts, location_photos (same pattern)
create policy "Project members can view location contacts"
  on location_contacts for select
  using (exists (select 1 from resources r where r.id = location_contacts.resource_id and is_project_member(r.project_id)));
create policy "Project admins can modify location contacts"
  on location_contacts for all
  using (exists (select 1 from resources r where r.id = location_contacts.resource_id and can_modify_project(r.project_id)));

create policy "Project members can view location photos"
  on location_photos for select
  using (exists (select 1 from resources r where r.id = location_photos.resource_id and is_project_member(r.project_id)));
create policy "Project admins can modify location photos"
  on location_photos for all
  using (exists (select 1 from resources r where r.id = location_photos.resource_id and can_modify_project(r.project_id)));

-- travel_times
create policy "Project members can view travel times"
  on travel_times for select using (is_project_member(project_id));
create policy "Project admins can modify travel times"
  on travel_times for all using (can_modify_project(project_id));

-- resource_availability
create policy "Project members can view availability"
  on resource_availability for select using (is_project_member(project_id));
create policy "Project admins can modify availability"
  on resource_availability for all using (can_modify_project(project_id));

-- script_documents
create policy "Project members can view scripts"
  on script_documents for select using (is_project_member(project_id));
create policy "Project admins can modify scripts"
  on script_documents for all using (can_modify_project(project_id));

-- script_pages
create policy "Project members can view script pages"
  on script_pages for select
  using (exists (select 1 from script_documents sd where sd.id = script_pages.script_document_id and is_project_member(sd.project_id)));

-- scenes
create policy "Project members can view scenes"
  on scenes for select using (is_project_member(project_id));
create policy "Project admins can modify scenes"
  on scenes for all using (can_modify_project(project_id));

-- scene_elements
create policy "Project members can view scene elements"
  on scene_elements for select
  using (exists (select 1 from scenes s where s.id = scene_elements.scene_id and is_project_member(s.project_id)));
create policy "Project admins can modify scene elements"
  on scene_elements for all
  using (exists (select 1 from scenes s where s.id = scene_elements.scene_id and can_modify_project(s.project_id)));

-- scene_requirements
create policy "Project members can view requirements"
  on scene_requirements for select
  using (exists (select 1 from scenes s where s.id = scene_requirements.scene_id and is_project_member(s.project_id)));
create policy "Project admins can modify requirements"
  on scene_requirements for all
  using (exists (select 1 from scenes s where s.id = scene_requirements.scene_id and can_modify_project(s.project_id)));

-- scene_tags, scene_notes
create policy "Project members can view tags"
  on scene_tags for select using (is_project_member(project_id));
create policy "Project admins can modify tags"
  on scene_tags for all using (can_modify_project(project_id));

create policy "Project members can view scene notes"
  on scene_notes for select
  using (exists (select 1 from scenes s where s.id = scene_notes.scene_id and is_project_member(s.project_id)));
create policy "Project admins can modify scene notes"
  on scene_notes for all
  using (exists (select 1 from scenes s where s.id = scene_notes.scene_id and can_modify_project(s.project_id)));

-- shoot_days
create policy "Project members can view shoot days"
  on shoot_days for select using (is_project_member(project_id));
create policy "Project admins can modify shoot days"
  on shoot_days for all using (can_modify_project(project_id));

-- shoot_day_scenes
create policy "Project members can view shoot day scenes"
  on shoot_day_scenes for select
  using (exists (select 1 from shoot_days sd where sd.id = shoot_day_scenes.shoot_day_id and is_project_member(sd.project_id)));
create policy "Project admins can modify shoot day scenes"
  on shoot_day_scenes for all
  using (exists (select 1 from shoot_days sd where sd.id = shoot_day_scenes.shoot_day_id and can_modify_project(sd.project_id)));

-- resource_bookings
create policy "Project members can view bookings"
  on resource_bookings for select using (is_project_member(project_id));
create policy "Project admins can modify bookings"
  on resource_bookings for all using (can_modify_project(project_id));

-- schedule_versions
create policy "Project members can view versions"
  on schedule_versions for select using (is_project_member(project_id));
create policy "Project admins can create versions"
  on schedule_versions for insert with check (can_modify_project(project_id));

-- schedule_changes, schedule_locks
create policy "Project members can view changes"
  on schedule_changes for select
  using (exists (select 1 from schedule_versions sv where sv.id = schedule_changes.version_id and is_project_member(sv.project_id)));

create policy "Project members can view locks"
  on schedule_locks for select using (is_project_member(project_id));
create policy "Project admins can manage locks"
  on schedule_locks for all using (can_modify_project(project_id));

-- conflicts, validation_runs
create policy "Project members can view conflicts"
  on conflicts for select using (is_project_member(project_id));
create policy "Project admins can manage conflicts"
  on conflicts for all using (can_modify_project(project_id));

create policy "Project members can view validation runs"
  on validation_runs for select using (is_project_member(project_id));

-- ai_jobs, ai_suggestions, ai_conversations
create policy "Project members can view AI jobs"
  on ai_jobs for select using (is_project_member(project_id));
create policy "Project admins can create AI jobs"
  on ai_jobs for insert with check (can_modify_project(project_id));

create policy "Project members can view AI suggestions"
  on ai_suggestions for select using (is_project_member(project_id));
create policy "Project admins can manage AI suggestions"
  on ai_suggestions for all using (can_modify_project(project_id));

create policy "Project members can view AI conversations"
  on ai_conversations for select using (is_project_member(project_id));
create policy "Project members can insert AI conversations"
  on ai_conversations for insert with check (is_project_member(project_id) and user_id = auth.uid());

-- call_sheets
create policy "Project members can view call sheets"
  on call_sheets for select using (is_project_member(project_id));
create policy "Project admins can manage call sheets"
  on call_sheets for all using (can_modify_project(project_id));

create policy "Project members can view call sheet departments"
  on call_sheet_departments for select
  using (exists (select 1 from call_sheets cs where cs.id = call_sheet_departments.call_sheet_id and is_project_member(cs.project_id)));

create policy "Project members can view call sheet recipients"
  on call_sheet_recipients for select
  using (exists (select 1 from call_sheets cs where cs.id = call_sheet_recipients.call_sheet_id and is_project_member(cs.project_id)));

-- comments, notifications
create policy "Project members can view comments"
  on comments for select using (is_project_member(project_id));
create policy "Project members can insert comments"
  on comments for insert with check (is_project_member(project_id) and created_by = auth.uid());
create policy "Comment authors can update their comments"
  on comments for update using (created_by = auth.uid());

create policy "Users can view their own notifications"
  on notifications for select using (user_id = auth.uid());
create policy "Users can update their own notifications"
  on notifications for update using (user_id = auth.uid());

create policy "Users can view their own preferences"
  on notification_preferences for select using (user_id = auth.uid());
create policy "Users can manage their own preferences"
  on notification_preferences for all using (user_id = auth.uid());

-- activity_logs
create policy "Project members can view activity logs"
  on activity_logs for select using (is_project_member(project_id));

-- guest_tokens
create policy "Project admins can manage guest tokens"
  on guest_tokens for all using (can_modify_project(project_id));
create policy "Project members can view guest tokens"
  on guest_tokens for select using (is_project_member(project_id));

-- production_rules
create policy "Project members can view production rules"
  on production_rules for select using (is_project_member(project_id));
create policy "Project admins can manage production rules"
  on production_rules for all using (can_modify_project(project_id));

-- union_presets are public read
create policy "Anyone can view union presets"
  on union_presets for select using (true);
