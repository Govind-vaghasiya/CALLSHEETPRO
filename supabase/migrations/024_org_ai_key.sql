-- ============================================================
-- 024_org_ai_key.sql
-- Each organization stores its own AI (Anthropic) API key, set once in
-- Organization settings and used for all its productions.
--
-- Security:
--   * The key itself lives encrypted in Supabase Vault (vault.secrets), never
--     in a normal table. organization_ai_settings only keeps a pointer to it and
--     the last 4 characters for display.
--   * Only org OWNER/ADMIN can set or remove it (set_org_ai_key / clear_org_ai_key).
--   * Only the server (service role) can read it back (get_org_ai_key); browsers
--     and signed-in users cannot, not even admins.
-- Safe to run more than once. Only adds; nothing is changed or deleted.
-- ============================================================

create extension if not exists supabase_vault with schema vault;

create table if not exists organization_ai_settings (
  organization_id  uuid primary key references organizations(id) on delete cascade,
  provider         text not null default 'ANTHROPIC',
  vault_secret_id  uuid not null,
  key_hint         text not null,                 -- last 4 characters, e.g. "x9Qa"
  updated_by       uuid references auth.users(id) on delete set null,
  updated_at       timestamptz not null default now()
);

alter table organization_ai_settings enable row level security;

-- Members may see whether a key is set (and its last 4 characters); nobody writes directly
drop policy if exists "Org members can view AI settings" on organization_ai_settings;
create policy "Org members can view AI settings"
  on organization_ai_settings for select using (is_org_member(organization_id));

-- Set or replace the key (owners/admins only)
create or replace function set_org_ai_key(org_id uuid, api_key text)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  clean_key text := trim(api_key);
  existing_id uuid;
begin
  if not is_org_admin(org_id) then
    raise exception 'Only organization owners and admins can change the AI key';
  end if;
  if clean_key is null or length(clean_key) < 20 then
    raise exception 'That does not look like an API key';
  end if;

  select vault_secret_id into existing_id from organization_ai_settings where organization_id = org_id;
  if existing_id is not null then
    perform vault.update_secret(existing_id, clean_key);
    update organization_ai_settings
      set key_hint = right(clean_key, 4), updated_by = auth.uid(), updated_at = now()
      where organization_id = org_id;
  else
    insert into organization_ai_settings (organization_id, vault_secret_id, key_hint, updated_by)
    values (
      org_id,
      vault.create_secret(clean_key, 'org_ai_key_' || org_id::text, 'CallSheetPro AI key'),
      right(clean_key, 4),
      auth.uid()
    );
  end if;
  return right(clean_key, 4);
end;
$$;

-- Remove the key (owners/admins only); the encrypted secret is deleted too
create or replace function clear_org_ai_key(org_id uuid)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  existing_id uuid;
begin
  if not is_org_admin(org_id) then
    raise exception 'Only organization owners and admins can change the AI key';
  end if;
  select vault_secret_id into existing_id from organization_ai_settings where organization_id = org_id;
  delete from organization_ai_settings where organization_id = org_id;
  if existing_id is not null then
    delete from vault.secrets where id = existing_id;
  end if;
end;
$$;

-- Read the key back: server only
create or replace function get_org_ai_key(org_id uuid)
returns text
language sql
security definer stable
set search_path = public, vault
as $$
  select ds.decrypted_secret
  from organization_ai_settings s
  join vault.decrypted_secrets ds on ds.id = s.vault_secret_id
  where s.organization_id = org_id;
$$;

revoke all on function get_org_ai_key(uuid) from public, anon, authenticated;
grant execute on function get_org_ai_key(uuid) to service_role;

revoke all on function set_org_ai_key(uuid, text) from public, anon;
revoke all on function clear_org_ai_key(uuid) from public, anon;
grant execute on function set_org_ai_key(uuid, text) to authenticated;
grant execute on function clear_org_ai_key(uuid) to authenticated;
