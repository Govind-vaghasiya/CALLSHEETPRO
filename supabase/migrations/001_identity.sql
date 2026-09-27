-- ============================================================
-- 001_identity.sql
-- Organizations, members, and user profiles
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

create type org_member_role as enum ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- ============================================================
-- organizations
-- ============================================================
create table organizations (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  slug          text not null unique,
  logo_url      text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- organization_members
-- ============================================================
create table organization_members (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            org_member_role not null default 'MEMBER',
  invited_by      uuid references auth.users(id) on delete set null,
  joined_at       timestamptz,
  created_at      timestamptz not null default now(),
  unique(organization_id, user_id)
);

-- ============================================================
-- organization_invitations
-- ============================================================
create table organization_invitations (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email           text not null,
  role            org_member_role not null default 'MEMBER',
  token           text not null unique default encode(gen_random_bytes(32), 'hex'),
  invited_by      uuid not null references auth.users(id) on delete cascade,
  accepted_at     timestamptz,
  expires_at      timestamptz not null default (now() + interval '7 days'),
  created_at      timestamptz not null default now(),
  unique(organization_id, email)
);

-- ============================================================
-- user_profiles
-- ============================================================
create table user_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  timezone    text not null default 'UTC',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into user_profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
