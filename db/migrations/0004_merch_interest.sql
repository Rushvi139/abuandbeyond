-- Waiting list for the merchandise run (keychains, magnets, t-shirts, caps).
create table if not exists merch_interest (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  name text,
  wants text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (phone)
);
