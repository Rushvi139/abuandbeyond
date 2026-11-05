-- Abu & Beyond — initial schema
-- Money: integer paise (bigint). Quantities: numeric(12,3) in the ingredient's base unit.
-- RLS is enabled on every table. Policies below give anonymous users read access to the
-- active menu only; staff access follows profiles.role.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums
create type staff_role as enum ('owner', 'manager', 'kitchen', 'rider');
create type order_status as enum (
  'pending_payment', 'payment_failed', 'paid', 'accepted', 'preparing',
  'ready', 'out_for_delivery', 'delivered', 'cancelled'
);
create type stay_type as enum ('hotel', 'villa', 'homestay', 'home', 'other');
create type cuisine_sticker as enum ('abu', 'italy', 'mexico', 'china', 'lebanon');
create type stock_movement_kind as enum ('purchase', 'consumption', 'wastage', 'adjustment', 'opening');
create type unit_kind as enum ('g', 'ml', 'pc');
create type po_status as enum ('draft', 'sent', 'partially_received', 'received', 'cancelled');
create type payment_status as enum ('created', 'captured', 'failed', 'refunded', 'partially_refunded');

-- ---------------------------------------------------------------- staff
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  phone text,
  role staff_role not null default 'kitchen',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.staff_role() returns staff_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and active
$$;

create or replace function public.has_role(roles staff_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.staff_role() = any (roles), false)
$$;

-- ---------------------------------------------------------------- menu
create table stations (
  id text primary key,                 -- pizza_oven, wok_momos, grill_rolls, fryer, cold_drinks
  name text not null,
  sort_order int not null default 0
);

create table pack_kits (
  id text primary key,
  name text not null,
  cost_paise bigint not null default 0,
  components text
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  active boolean not null default true
);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,            -- AB001…
  slug text not null unique,
  name text not null,
  description text,
  category_id uuid not null references categories (id),
  station_id text not null references stations (id),
  cuisine cuisine_sticker not null default 'abu',
  is_veg boolean not null,
  price_paise bigint not null check (price_paise > 0),   -- before GST
  packaging_cost_paise bigint not null default 0,
  image_path text,
  available boolean not null default true,              -- sold out today = false
  active boolean not null default true,                 -- on the menu at all
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table addons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_paise bigint not null check (price_paise >= 0),
  is_veg boolean not null default true,
  active boolean not null default true
);

create table menu_item_addons (
  menu_item_id uuid references menu_items (id) on delete cascade,
  addon_id uuid references addons (id) on delete cascade,
  primary key (menu_item_id, addon_id)
);

-- ---------------------------------------------------------------- customers + orders
create table customers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,           -- E.164, +91…
  name text,
  whatsapp_opt_in boolean not null default true,
  created_at timestamptz not null default now()
);

create sequence order_number_seq start 1001;

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number int not null unique default nextval('order_number_seq'),
  order_code text not null unique default encode(gen_random_bytes(5), 'hex'), -- public lookup
  customer_id uuid not null references customers (id),
  status order_status not null default 'pending_payment',
  stay_type stay_type not null,
  property_name text,
  room_or_landmark text,
  address_line text,
  lat double precision,
  lng double precision,
  notes text,
  subtotal_paise bigint not null,
  discount_paise bigint not null default 0,
  gst_paise bigint not null,            -- 5% on (subtotal - discount)
  delivery_fee_paise bigint not null default 0,
  total_paise bigint not null,
  promo_code text,
  prep_minutes int,
  rider_id uuid references profiles (id),
  razorpay_order_id text unique,
  source text not null default 'web',   -- web | whatsapp
  paid_at timestamptz,
  delivered_at timestamptz,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_status_idx on orders (status, created_at desc);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  menu_item_id uuid not null references menu_items (id),
  name_snapshot text not null,
  station_id text not null references stations (id),
  cuisine cuisine_sticker not null,
  is_veg boolean not null,
  unit_price_paise bigint not null,
  quantity int not null check (quantity > 0),
  line_total_paise bigint not null
);

create table order_item_addons (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items (id) on delete cascade,
  addon_id uuid not null references addons (id),
  name_snapshot text not null,
  price_paise bigint not null
);

create table order_status_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references orders (id) on delete cascade,
  from_status order_status,
  to_status order_status not null,
  actor_id uuid references profiles (id),   -- null = system / webhook
  note text,
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id),
  razorpay_order_id text not null,
  razorpay_payment_id text unique,
  status payment_status not null default 'created',
  amount_paise bigint not null,
  refunded_paise bigint not null default 0,
  method text,
  raw jsonb,
  created_at timestamptz not null default now()
);

create table webhook_events (            -- idempotency for Razorpay + WhatsApp
  id text primary key,                   -- provider event / message id
  provider text not null,
  received_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- stock
create table ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  procurement_group text,
  unit unit_kind not null default 'g',
  rate_paise_per_unit numeric(14,4) not null default 0,  -- latest purchase rate per base unit
  reorder_level numeric(12,3) not null default 0,
  active boolean not null default true
);

create table recipe_lines (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references menu_items (id) on delete cascade,
  ingredient_id uuid not null references ingredients (id),
  quantity numeric(12,3) not null check (quantity > 0),  -- per portion, base unit
  unique (menu_item_id, ingredient_id)
);

create table stock_movements (
  id bigint generated always as identity primary key,
  ingredient_id uuid not null references ingredients (id),
  kind stock_movement_kind not null,
  quantity numeric(12,3) not null,       -- + in, - out
  unit_cost_paise numeric(14,4),
  order_id uuid references orders (id),
  purchase_order_id uuid,
  note text,
  actor_id uuid references profiles (id),
  created_at timestamptz not null default now()
);
create index stock_movements_ingredient_idx on stock_movements (ingredient_id, created_at);

create view stock_on_hand with (security_invoker = true) as
  select i.id as ingredient_id, i.name, i.unit, i.reorder_level,
         coalesce(sum(m.quantity), 0) as on_hand,
         coalesce(sum(m.quantity), 0) <= i.reorder_level as is_low
  from ingredients i
  left join stock_movements m on m.ingredient_id = i.id
  where i.active
  group by i.id;

-- ---------------------------------------------------------------- vendors + purchasing
create table vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  contact_person text,
  phone text,
  email text,
  gstin text,
  payment_terms_days int,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number int generated always as identity unique,
  vendor_id uuid not null references vendors (id),
  status po_status not null default 'draft',
  expected_on date,
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);
alter table stock_movements
  add constraint stock_movements_po_fk foreign key (purchase_order_id) references purchase_orders (id);

create table purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders (id) on delete cascade,
  ingredient_id uuid not null references ingredients (id),
  quantity_ordered numeric(12,3) not null,
  quantity_received numeric(12,3) not null default 0,
  rate_paise_per_unit numeric(14,4)
);

create table vendor_bills (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors (id),
  purchase_order_id uuid references purchase_orders (id),
  bill_number text,
  bill_date date not null,
  amount_paise bigint not null,
  gst_paise bigint not null default 0,
  due_on date,
  file_path text,
  created_at timestamptz not null default now()
);

create table vendor_payments (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors (id),
  vendor_bill_id uuid references vendor_bills (id),
  paid_on date not null,
  amount_paise bigint not null,
  mode text,                              -- UPI, bank, cash
  reference text,                         -- UTR
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- finance
create table expense_categories (
  id text primary key,                    -- rent, salaries, utilities, delivery, marketing, consumables, setup, misc
  name text not null,
  ceiling_pct numeric(5,2)                -- % of net sales from the margin strategy
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  category_id text not null references expense_categories (id),
  spent_on date not null,
  description text not null,
  amount_paise bigint not null,
  vendor_id uuid references vendors (id),
  mode text,
  reference text,
  is_one_time boolean not null default false,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create view daily_sales with (security_invoker = true) as
  select (paid_at at time zone 'Asia/Kolkata')::date as day,
         count(*) as orders,
         sum(subtotal_paise - discount_paise) as net_sales_paise,
         sum(gst_paise) as gst_paise,
         sum(total_paise) as gross_paise
  from orders
  where status not in ('pending_payment', 'payment_failed', 'cancelled')
  group by 1;

-- ---------------------------------------------------------------- platform
create table whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders (id),
  phone text not null,
  direction text not null check (direction in ('out', 'in')),
  template text,
  body text,
  provider_message_id text,
  status text not null default 'queued',  -- queued, sent, delivered, read, failed
  error text,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

create table settings (
  key text primary key,
  value jsonb not null
);

-- ---------------------------------------------------------------- updated_at
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger menu_items_touch before update on menu_items for each row execute function touch_updated_at();
create trigger orders_touch before update on orders for each row execute function touch_updated_at();

-- ---------------------------------------------------------------- RLS
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','stations','pack_kits','categories','menu_items','addons','menu_item_addons',
    'customers','orders','order_items','order_item_addons','order_status_events','payments',
    'webhook_events','ingredients','recipe_lines','stock_movements','vendors','purchase_orders',
    'purchase_order_lines','vendor_bills','vendor_payments','expense_categories','expenses',
    'whatsapp_messages','settings']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- public menu (anonymous read)
create policy "menu public read" on categories for select using (active);
create policy "menu items public read" on menu_items for select using (active);
create policy "addons public read" on addons for select using (active);
create policy "item addons public read" on menu_item_addons for select using (true);
create policy "stations public read" on stations for select using (true);

-- staff
create policy "own profile" on profiles for select using (id = auth.uid() or has_role('{owner,manager}'));
create policy "owner manages profiles" on profiles for all using (has_role('{owner}')) with check (has_role('{owner}'));

create policy "staff manage menu" on menu_items for all using (has_role('{owner,manager}')) with check (has_role('{owner,manager}'));
create policy "staff manage categories" on categories for all using (has_role('{owner,manager}')) with check (has_role('{owner,manager}'));
create policy "staff manage addons" on addons for all using (has_role('{owner,manager}')) with check (has_role('{owner,manager}'));
create policy "kitchen toggles availability" on menu_items for update using (has_role('{kitchen}')) with check (has_role('{kitchen}'));

-- orders: all staff read; status changes go through server code (service role)
create policy "staff read orders" on orders for select using (has_role('{owner,manager,kitchen,rider}'));
create policy "staff read order items" on order_items for select using (has_role('{owner,manager,kitchen,rider}'));
create policy "staff read order addons" on order_item_addons for select using (has_role('{owner,manager,kitchen,rider}'));
create policy "staff read status events" on order_status_events for select using (has_role('{owner,manager,kitchen,rider}'));
create policy "staff read customers" on customers for select using (has_role('{owner,manager,rider}'));
create policy "managers read payments" on payments for select using (has_role('{owner,manager}'));

-- stock + purchasing
create policy "staff read stock" on ingredients for select using (has_role('{owner,manager,kitchen}'));
create policy "managers manage ingredients" on ingredients for all using (has_role('{owner,manager}')) with check (has_role('{owner,manager}'));
create policy "staff read recipes" on recipe_lines for select using (has_role('{owner,manager,kitchen}'));
create policy "managers manage recipes" on recipe_lines for all using (has_role('{owner,manager}')) with check (has_role('{owner,manager}'));
create policy "staff read movements" on stock_movements for select using (has_role('{owner,manager,kitchen}'));
create policy "staff add wastage" on stock_movements for insert with check (has_role('{owner,manager,kitchen}') and kind in ('wastage','adjustment'));
create policy "managers vendors" on vendors for all using (has_role('{owner,manager}')) with check (has_role('{owner,manager}'));
create policy "managers pos" on purchase_orders for all using (has_role('{owner,manager}')) with check (has_role('{owner,manager}'));
create policy "managers po lines" on purchase_order_lines for all using (has_role('{owner,manager}')) with check (has_role('{owner,manager}'));
create policy "managers pack kits" on pack_kits for all using (has_role('{owner,manager}')) with check (has_role('{owner,manager}'));

-- finance: owner only
create policy "owner bills" on vendor_bills for all using (has_role('{owner}')) with check (has_role('{owner}'));
create policy "owner vendor payments" on vendor_payments for all using (has_role('{owner}')) with check (has_role('{owner}'));
create policy "owner expense cats" on expense_categories for all using (has_role('{owner}')) with check (has_role('{owner}'));
create policy "owner expenses" on expenses for all using (has_role('{owner}')) with check (has_role('{owner}'));
create policy "owner settings" on settings for all using (has_role('{owner}')) with check (has_role('{owner}'));
create policy "managers read whatsapp log" on whatsapp_messages for select using (has_role('{owner,manager}'));

-- realtime for live boards
alter publication supabase_realtime add table orders, order_items, menu_items;

-- ---------------------------------------------------------------- reference data
insert into stations (id, name, sort_order) values
  ('pizza_oven', 'Pizza & Oven', 1),
  ('wok_momos', 'Wok & Momos', 2),
  ('grill_rolls', 'Grill & Rolls', 3),
  ('fryer', 'Fryer', 4),
  ('cold_drinks', 'Cold & Drinks', 5);

insert into expense_categories (id, name, ceiling_pct) values
  ('raw_material', 'Raw material (incl. oil, wastage)', 28),
  ('packaging', 'Packaging', 5),
  ('salaries', 'Staff salaries', 18),
  ('rent', 'Rent', 10),
  ('utilities', 'Gas, electricity, water', 6),
  ('delivery', 'Delivery (rider, fuel)', 4),
  ('marketing', 'Marketing', 4),
  ('consumables', 'Consumables, software, repairs', 3),
  ('setup', 'One-time setup', null),
  ('misc', 'Miscellaneous', null);

insert into settings (key, value) values
  ('gst_pct', '5'),
  ('kitchen_loading_pct', '15'),
  ('target_gross_margin_pct', '68'),
  ('direct_cost_ceiling_pct', '33'),
  ('cod_enabled', 'false'),
  ('delivery_fee_paise', '0');
