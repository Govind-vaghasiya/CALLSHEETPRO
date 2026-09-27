-- ============================================================
-- 005_location.sql
-- Location intelligence: address, contact, photos, travel
-- ============================================================

-- ============================================================
-- location_details  (1-to-1 with resource where resource_type = LOCATION)
-- ============================================================
create table location_details (
  id                  uuid primary key default uuid_generate_v4(),
  resource_id         uuid not null unique references resources(id) on delete cascade,
  address_line1       text,
  address_line2       text,
  city                text,
  state_province      text,
  postal_code         text,
  country             text,
  latitude            numeric(10,7),
  longitude           numeric(10,7),
  maps_place_id       text,             -- Google Maps Place ID
  parking_notes       text,
  nearest_hospital    text,
  nearest_hospital_km numeric(6,2),
  access_hours_start  time,             -- location available from
  access_hours_end    time,             -- location available until
  permit_required     boolean not null default false,
  permit_type         text,
  permit_expiry       date,
  permit_notes        text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- location_contacts
-- ============================================================
create table location_contacts (
  id              uuid primary key default uuid_generate_v4(),
  resource_id     uuid not null references resources(id) on delete cascade,
  contact_name    text not null,
  role            text,                  -- e.g. "Location Manager", "Property Owner"
  phone           text,
  email           text,
  is_primary      boolean not null default false,
  notes           text,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- location_photos
-- ============================================================
create table location_photos (
  id           uuid primary key default uuid_generate_v4(),
  resource_id  uuid not null references resources(id) on delete cascade,
  storage_path text not null,
  file_name    text not null,
  caption      text,
  sort_order   integer not null default 0,
  uploaded_by  uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- travel_times  (cached distances between location pairs)
-- ============================================================
create table travel_times (
  id                uuid primary key default uuid_generate_v4(),
  project_id        uuid not null references projects(id) on delete cascade,
  from_location_id  uuid not null references resources(id) on delete cascade,
  to_location_id    uuid not null references resources(id) on delete cascade,
  travel_minutes    integer not null,    -- driving time in minutes
  distance_km       numeric(8,2),
  cached_at         timestamptz not null default now(),
  unique(from_location_id, to_location_id)
);
