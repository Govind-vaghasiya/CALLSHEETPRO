-- ============================================================
-- 019_triggers.sql
-- updated_at triggers and audit helpers
-- ============================================================

-- ============================================================
-- Generic updated_at trigger function
-- ============================================================
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply updated_at trigger to every table that has the column
create trigger trg_organizations_updated_at
  before update on organizations
  for each row execute function set_updated_at();

create trigger trg_user_profiles_updated_at
  before update on user_profiles
  for each row execute function set_updated_at();

create trigger trg_projects_updated_at
  before update on projects
  for each row execute function set_updated_at();

create trigger trg_project_settings_updated_at
  before update on project_settings
  for each row execute function set_updated_at();

create trigger trg_departments_updated_at
  before update on departments
  for each row execute function set_updated_at();

create trigger trg_roles_updated_at
  before update on roles
  for each row execute function set_updated_at();

create trigger trg_resources_updated_at
  before update on resources
  for each row execute function set_updated_at();

create trigger trg_resource_rates_updated_at
  before update on resource_rates
  for each row execute function set_updated_at();

create trigger trg_budget_line_items_updated_at
  before update on budget_line_items
  for each row execute function set_updated_at();

create trigger trg_location_details_updated_at
  before update on location_details
  for each row execute function set_updated_at();

create trigger trg_resource_availability_updated_at
  before update on resource_availability
  for each row execute function set_updated_at();

create trigger trg_availability_rules_updated_at
  before update on availability_rules
  for each row execute function set_updated_at();

create trigger trg_script_documents_updated_at
  before update on script_documents
  for each row execute function set_updated_at();

create trigger trg_scenes_updated_at
  before update on scenes
  for each row execute function set_updated_at();

create trigger trg_scene_elements_updated_at
  before update on scene_elements
  for each row execute function set_updated_at();

create trigger trg_scene_requirements_updated_at
  before update on scene_requirements
  for each row execute function set_updated_at();

create trigger trg_shoot_days_updated_at
  before update on shoot_days
  for each row execute function set_updated_at();

create trigger trg_shoot_day_scenes_updated_at
  before update on shoot_day_scenes
  for each row execute function set_updated_at();

create trigger trg_resource_bookings_updated_at
  before update on resource_bookings
  for each row execute function set_updated_at();

create trigger trg_conflicts_updated_at
  before update on conflicts
  for each row execute function set_updated_at();

create trigger trg_ai_jobs_updated_at
  before update on ai_jobs
  for each row execute function set_updated_at();

create trigger trg_ai_suggestions_updated_at
  before update on ai_suggestions
  for each row execute function set_updated_at();

create trigger trg_call_sheets_updated_at
  before update on call_sheets
  for each row execute function set_updated_at();

create trigger trg_call_sheet_recipients_updated_at
  before update on call_sheet_recipients
  for each row execute function set_updated_at();

create trigger trg_comments_updated_at
  before update on comments
  for each row execute function set_updated_at();

create trigger trg_notification_preferences_updated_at
  before update on notification_preferences
  for each row execute function set_updated_at();

create trigger trg_guest_tokens_updated_at
  before update on guest_tokens
  for each row execute function set_updated_at();

create trigger trg_production_rules_updated_at
  before update on production_rules
  for each row execute function set_updated_at();

-- ============================================================
-- Ensure only one 'current' script per project
-- ============================================================
create or replace function enforce_single_current_script()
returns trigger
language plpgsql
as $$
begin
  if new.is_current = true then
    update script_documents
    set is_current = false
    where project_id = new.project_id
    and id != new.id;
  end if;
  return new;
end;
$$;

create trigger trg_single_current_script
  before insert or update on script_documents
  for each row execute function enforce_single_current_script();

-- ============================================================
-- Ensure only one 'current' schedule version per project
-- ============================================================
create or replace function enforce_single_current_version()
returns trigger
language plpgsql
as $$
begin
  if new.is_current = true then
    update schedule_versions
    set is_current = false
    where project_id = new.project_id
    and id != new.id;
  end if;
  return new;
end;
$$;

create trigger trg_single_current_version
  before insert or update on schedule_versions
  for each row execute function enforce_single_current_version();

-- ============================================================
-- Auto-increment version_number per project
-- ============================================================
create or replace function auto_version_number()
returns trigger
language plpgsql
as $$
begin
  new.version_number := coalesce(
    (select max(version_number) from schedule_versions where project_id = new.project_id),
    0
  ) + 1;
  return new;
end;
$$;

create trigger trg_auto_version_number
  before insert on schedule_versions
  for each row execute function auto_version_number();
