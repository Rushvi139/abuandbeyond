-- A directory of every place a guest could be staying in Mount Abu, so a rider
-- can find a gate by name instead of ringing the kitchen.
--
-- Deliberately separate from `properties`: that table is the QR partners we
-- place codes in, each with a slug, a printed QR and sales attributed to it.
-- This one is the whole plateau — a few hundred rows swept from Google Places,
-- most of which will never be partners. `property_id` links the two when a
-- stay does become one.

create table stays (
  id uuid primary key default gen_random_uuid(),
  place_id text unique,                           -- Google Places id; null for hand-added
  name text not null,
  lat double precision,
  lng double precision,
  zone text,                                      -- Nakki, Market, Sunset Road, …
  km_from_kitchen numeric(5, 2),
  address text,
  phone text,
  kinds text,                                     -- raw Google types, for triage
  property_id uuid references properties (id) on delete set null,
  note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stays_name_idx on stays (lower(name));
create index stays_zone_idx on stays (zone) where active;
create unique index stays_name_uniq on stays (lower(name), coalesce(zone, '')) where place_id is null;

-- Every import run, so a re-sweep is auditable: who ran it, how many rows the
-- file had, and how they split between new and updated.
create table stay_imports (
  id uuid primary key default gen_random_uuid(),
  file_name text,
  rows_in_file int not null,
  inserted int not null,
  updated int not null,
  skipped int not null,
  actor_id uuid references staff_users (id),
  created_at timestamptz not null default now()
);
