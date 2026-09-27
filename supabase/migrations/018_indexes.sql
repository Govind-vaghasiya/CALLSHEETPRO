-- ============================================================
-- 018_indexes.sql
-- Performance indexes for all high-traffic query patterns
-- ============================================================

-- ============================================================
-- IDENTITY & ORGS
-- ============================================================
create index idx_org_members_org_id       on organization_members(organization_id);
create index idx_org_members_user_id      on organization_members(user_id);
create index idx_org_invitations_token    on organization_invitations(token);
create index idx_org_invitations_email    on organization_invitations(email);

-- ============================================================
-- PROJECTS
-- ============================================================
create index idx_projects_org_id          on projects(organization_id);
create index idx_projects_status          on projects(status);
create index idx_project_members_project  on project_members(project_id);
create index idx_project_members_user     on project_members(user_id);

-- ============================================================
-- RESOURCES
-- ============================================================
create index idx_resources_project_id     on resources(project_id);
create index idx_resources_type           on resources(resource_type);
create index idx_resources_active         on resources(project_id, is_active);
create index idx_departments_project      on departments(project_id);
create index idx_roles_department         on roles(department_id);
create index idx_roles_project            on roles(project_id);
create index idx_resource_roles_resource  on resource_roles(resource_id);
create index idx_resource_rates_resource  on resource_rates(resource_id);

-- ============================================================
-- LOCATION
-- ============================================================
create index idx_location_details_resource on location_details(resource_id);
create index idx_travel_times_from         on travel_times(from_location_id);
create index idx_travel_times_to           on travel_times(to_location_id);
create index idx_travel_times_project      on travel_times(project_id);

-- ============================================================
-- AVAILABILITY  (critical — queried on EVERY conflict check)
-- ============================================================
create index idx_availability_resource    on resource_availability(resource_id);
create index idx_availability_project     on resource_availability(project_id);
create index idx_availability_start       on resource_availability(start_at);
create index idx_availability_end         on resource_availability(end_at);
-- Composite: most common query pattern
create index idx_availability_resource_range
  on resource_availability(resource_id, start_at, end_at);

-- ============================================================
-- SCRIPTS & SCENES
-- ============================================================
create index idx_scripts_project          on script_documents(project_id);
create index idx_scripts_is_current       on script_documents(project_id, is_current);
create index idx_script_pages_document    on script_pages(script_document_id);
create index idx_script_pages_number      on script_pages(script_document_id, page_number);
create index idx_scenes_project           on scenes(project_id);
create index idx_scenes_document          on scenes(script_document_id);
create index idx_scenes_status            on scenes(project_id, status);
create index idx_scenes_number            on scenes(project_id, scene_number);
create index idx_scene_elements_scene     on scene_elements(scene_id);
create index idx_scene_elements_type      on scene_elements(scene_id, element_type);
create index idx_scene_requirements_scene on scene_requirements(scene_id);
create index idx_scene_requirements_res   on scene_requirements(resource_id);
create index idx_scene_tags_scene         on scene_tags(scene_id);
create index idx_scene_tags_project       on scene_tags(project_id);

-- ============================================================
-- SCHEDULING  (critical — queried constantly)
-- ============================================================
create index idx_shoot_days_project       on shoot_days(project_id);
create index idx_shoot_days_date          on shoot_days(project_id, shoot_date);
create index idx_shoot_days_status        on shoot_days(project_id, status);
create index idx_shoot_day_scenes_day     on shoot_day_scenes(shoot_day_id);
create index idx_shoot_day_scenes_scene   on shoot_day_scenes(scene_id);
create index idx_bookings_project         on resource_bookings(project_id);
create index idx_bookings_shoot_day       on resource_bookings(shoot_day_id);
create index idx_bookings_resource        on resource_bookings(resource_id);
create index idx_bookings_resource_day    on resource_bookings(resource_id, shoot_day_id);
create index idx_bookings_time_range      on resource_bookings(resource_id, start_at, end_at);

-- ============================================================
-- VERSIONING
-- ============================================================
create index idx_versions_project         on schedule_versions(project_id);
create index idx_versions_current         on schedule_versions(project_id, is_current);
create index idx_versions_created         on schedule_versions(project_id, created_at desc);
create index idx_changes_version          on schedule_changes(version_id);

-- ============================================================
-- CONFLICTS  (queried after every schedule change)
-- ============================================================
create index idx_conflicts_project        on conflicts(project_id);
create index idx_conflicts_status         on conflicts(project_id, status);
create index idx_conflicts_severity       on conflicts(project_id, severity);
create index idx_conflicts_day            on conflicts(shoot_day_id);
create index idx_conflicts_resource       on conflicts(resource_id);

-- ============================================================
-- AI
-- ============================================================
create index idx_ai_jobs_project          on ai_jobs(project_id);
create index idx_ai_jobs_status           on ai_jobs(project_id, status);
create index idx_ai_suggestions_project   on ai_suggestions(project_id);
create index idx_ai_suggestions_status    on ai_suggestions(project_id, status);
create index idx_ai_conversations_project on ai_conversations(project_id);
create index idx_ai_conversations_user    on ai_conversations(project_id, user_id);

-- ============================================================
-- CALL SHEETS
-- ============================================================
create index idx_callsheets_project       on call_sheets(project_id);
create index idx_callsheets_shoot_day     on call_sheets(shoot_day_id);
create index idx_callsheets_token         on call_sheets(share_token);

-- ============================================================
-- COLLABORATION
-- ============================================================
create index idx_comments_project         on comments(project_id);
create index idx_comments_entity          on comments(entity_type, entity_id);
create index idx_notifications_user       on notifications(user_id);
create index idx_notifications_unread     on notifications(user_id, is_read) where is_read = false;
create index idx_activity_project         on activity_logs(project_id);
create index idx_activity_created         on activity_logs(project_id, created_at desc);

-- ============================================================
-- GUEST TOKENS
-- ============================================================
create index idx_guest_tokens_project     on guest_tokens(project_id);
create index idx_guest_tokens_token       on guest_tokens(token);

-- ============================================================
-- PRODUCTION RULES
-- ============================================================
create index idx_prod_rules_project       on production_rules(project_id);
create index idx_prod_rules_active        on production_rules(project_id, is_active);
