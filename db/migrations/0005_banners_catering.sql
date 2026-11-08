-- Promo banners across the top of the menu, and catering enquiries from the help page.
create table if not exists banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  link_url text,
  image_path text,
  tone text not null default 'clay' check (tone in ('clay', 'acid', 'hill', 'ink', 'kraft')),
  active boolean not null default true,
  sort_order int not null default 100,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now()
);

create table if not exists catering_enquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  occasion text,
  guests int,
  event_on date,
  notes text,
  status text not null default 'new' check (status in ('new', 'quoted', 'confirmed', 'closed')),
  created_at timestamptz not null default now()
);
create index if not exists catering_enquiries_new_idx on catering_enquiries (created_at desc) where status = 'new';

-- Who filed a vendor bill, so the market run is accountable.
alter table vendor_bills add column if not exists created_by uuid references staff_users (id);
