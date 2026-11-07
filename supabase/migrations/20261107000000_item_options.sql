-- Item options: required choices on a dish (e.g. bowl base: burnt garlic noodles or fried rice,
-- fries flavour: salted or peri peri). Add-ons stay in `addons` (extra cheese, egg).
-- Also records how sure we are of each dish's cost (price_status) and which costed indent dish it maps to.

create type price_status as enum ('costed', 'matched', 'new');

alter table menu_items
  add column price_status price_status not null default 'costed',
  add column costing_ref text,                     -- dish name in the indent workbook used for recipe lines
  add column pack_kit_id text references pack_kits (id);

create table option_groups (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references menu_items (id) on delete cascade,
  name text not null,                              -- "Base", "Flavour"
  required boolean not null default true,
  max_choices int not null default 1,
  sort_order int not null default 0
);

create table options (
  id uuid primary key default gen_random_uuid(),
  option_group_id uuid not null references option_groups (id) on delete cascade,
  name text not null,
  price_delta_paise bigint not null default 0,
  active boolean not null default true,
  sort_order int not null default 0
);

create table order_item_options (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items (id) on delete cascade,
  option_id uuid not null references options (id),
  group_name_snapshot text not null,
  name_snapshot text not null,
  price_delta_paise bigint not null default 0
);

alter table option_groups enable row level security;
alter table options enable row level security;
alter table order_item_options enable row level security;

create policy "option groups public read" on option_groups for select using (true);
create policy "options public read" on options for select using (active);
create policy "staff manage option groups" on option_groups for all using (has_role('{owner,manager}')) with check (has_role('{owner,manager}'));
create policy "staff manage options" on options for all using (has_role('{owner,manager}')) with check (has_role('{owner,manager}'));
create policy "staff read order item options" on order_item_options for select using (has_role('{owner,manager,kitchen,rider}'));
