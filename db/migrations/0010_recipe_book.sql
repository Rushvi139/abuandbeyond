-- The recipe book: how a dish is actually made, on top of the ingredient lines
-- that already drive costing and stock.
create table if not exists recipes (
  menu_item_id uuid primary key references menu_items (id) on delete cascade,
  method text,                       -- one step per line
  chef_notes text,                   -- what goes wrong, what to watch for
  prep_minutes int check (prep_minutes is null or prep_minutes between 0 and 600),
  yield_note text,                   -- "one plate, about 280g"
  updated_by uuid references staff_users (id),
  updated_at timestamptz not null default now()
);

create table if not exists recipe_photos (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references menu_items (id) on delete cascade,
  file_path text not null,
  caption text,
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);
create index if not exists recipe_photos_item_idx on recipe_photos (menu_item_id, sort_order);
