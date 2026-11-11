-- Abu & Beyond — schema for our own Postgres 16 (self-hosted, no Supabase).
-- Money: integer paise (bigint). Quantities: numeric(12,3) in the ingredient's base unit.
-- Access control lives in the app (src/lib/auth): staff roles are checked on every
-- server action and API route. Live updates use LISTEN/NOTIFY (channel `orders`).

create extension if not exists pgcrypto;

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
create type price_status as enum ('costed', 'matched', 'new');
create type moderation_status as enum ('pending', 'approved', 'rejected');
create type media_kind as enum ('image', 'video');

-- ---------------------------------------------------------------- staff + sessions
create table staff_users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text unique,
  email text unique,
  password_hash text not null,              -- bcrypt
  role staff_role not null default 'kitchen',
  active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  check (phone is not null or email is not null)
);

create table sessions (
  id text primary key,                      -- sha256 of the cookie token, never the token itself
  staff_id uuid not null references staff_users (id) on delete cascade,
  expires_at timestamptz not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index sessions_staff_idx on sessions (staff_id);

-- ---------------------------------------------------------------- menu
create table stations (
  id text primary key,
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
  slug text not null unique,
  sort_order int not null default 0,
  active boolean not null default true
);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  slug text not null unique,
  name text not null,
  description text,
  category_id uuid not null references categories (id),
  station_id text not null references stations (id),
  cuisine cuisine_sticker not null default 'abu',
  is_veg boolean not null,
  price_paise bigint not null check (price_paise > 0),   -- before GST
  packaging_cost_paise bigint not null default 0,
  pack_kit_id text references pack_kits (id),
  price_status price_status not null default 'costed',
  costing_ref text,                                       -- dish name in the indent workbook
  image_path text,                                        -- relative to UPLOAD_DIR or /public
  available boolean not null default true,                -- sold out today = false
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table option_groups (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references menu_items (id) on delete cascade,
  name text not null,
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

create table addons (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price_paise bigint not null check (price_paise >= 0),
  is_veg boolean not null default true,
  active boolean not null default true
);

create table menu_item_addons (
  menu_item_id uuid references menu_items (id) on delete cascade,
  addon_id uuid references addons (id) on delete cascade,
  primary key (menu_item_id, addon_id)
);

-- ---------------------------------------------------------------- CRM: customers + properties
create table customers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,              -- E.164, +91…
  name text,
  whatsapp_opt_in boolean not null default true,
  tags text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now()
);

create table properties (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,               -- QR links: /?src=<slug>
  name text not null,
  kind stay_type not null default 'hotel',
  contact_person text,
  phone text,
  address text,
  lat double precision,
  lng double precision,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- orders
create sequence order_number_seq start 1001;

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number int not null unique default nextval('order_number_seq'),
  order_code text not null unique default encode(gen_random_bytes(5), 'hex'),
  customer_id uuid not null references customers (id),
  status order_status not null default 'pending_payment',
  source text not null default 'web',      -- web | whatsapp | manual | reorder
  source_ref text,                         -- ?src= from the QR
  property_id uuid references properties (id),
  stay_type stay_type not null,
  property_name text,
  room_or_landmark text,
  address_line text,
  lat double precision,
  lng double precision,
  notes text,
  subtotal_paise bigint not null,
  discount_paise bigint not null default 0,
  gst_paise bigint not null,
  delivery_fee_paise bigint not null default 0,
  total_paise bigint not null,
  promo_code text,
  prep_minutes int,
  rider_id uuid references staff_users (id),
  created_by uuid references staff_users (id),
  razorpay_order_id text unique,
  payment_link_url text,
  paid_at timestamptz,
  delivered_at timestamptz,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_status_idx on orders (status, created_at desc);
create index orders_customer_idx on orders (customer_id, created_at desc);

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
  line_total_paise bigint not null,
  note text
);

create table order_item_options (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items (id) on delete cascade,
  option_id uuid not null references options (id),
  group_name_snapshot text not null,
  name_snapshot text not null,
  price_delta_paise bigint not null default 0
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
  actor_id uuid references staff_users (id),
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

create table webhook_events (
  id text primary key,
  provider text not null,
  received_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- stock
create table ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  procurement_group text,
  unit unit_kind not null default 'g',
  rate_paise_per_unit numeric(14,4) not null default 0,
  reorder_level numeric(12,3) not null default 0,
  active boolean not null default true
);

create table recipe_lines (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references menu_items (id) on delete cascade,
  ingredient_id uuid not null references ingredients (id),
  quantity numeric(12,3) not null check (quantity > 0),
  unique (menu_item_id, ingredient_id)
);

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
  created_by uuid references staff_users (id),
  created_at timestamptz not null default now()
);

create table purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders (id) on delete cascade,
  ingredient_id uuid not null references ingredients (id),
  quantity_ordered numeric(12,3) not null,
  quantity_received numeric(12,3) not null default 0,
  rate_paise_per_unit numeric(14,4)
);

create table stock_movements (
  id bigint generated always as identity primary key,
  ingredient_id uuid not null references ingredients (id),
  kind stock_movement_kind not null,
  quantity numeric(12,3) not null,         -- + in, - out
  unit_cost_paise numeric(14,4),
  order_id uuid references orders (id),
  purchase_order_id uuid references purchase_orders (id),
  note text,
  actor_id uuid references staff_users (id),
  created_at timestamptz not null default now()
);
create index stock_movements_ingredient_idx on stock_movements (ingredient_id, created_at);

-- ---------------------------------------------------------------- finance
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
  mode text,
  reference text,
  notes text,
  created_at timestamptz not null default now()
);

create table expense_categories (
  id text primary key,
  name text not null,
  ceiling_pct numeric(5,2)
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
  created_by uuid references staff_users (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- reviews + wall
create table reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders (id),
  customer_id uuid not null references customers (id),
  rating int not null check (rating between 1 and 5),
  tags text[] not null default '{}',
  body text,
  instagram_handle text,
  consent_to_feature boolean not null default false,
  hidden boolean not null default false,
  hidden_reason text,
  created_at timestamptz not null default now()
);

create table review_media (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references reviews (id) on delete cascade,
  kind media_kind not null,
  storage_path text not null,              -- relative to UPLOAD_DIR (private until approved)
  duration_seconds int check (duration_seconds is null or duration_seconds <= 60),
  bytes bigint check (bytes <= 52428800),
  status moderation_status not null default 'pending',
  moderated_by uuid references staff_users (id),
  moderated_at timestamptz,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- platform
create table whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders (id),
  phone text not null,
  direction text not null check (direction in ('out', 'in')),
  template text,
  body text,
  provider_message_id text,
  status text not null default 'queued',
  error text,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

create table settings (
  key text primary key,
  value jsonb not null
);

-- ---------------------------------------------------------------- triggers
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger menu_items_touch before update on menu_items for each row execute function touch_updated_at();
create trigger orders_touch before update on orders for each row execute function touch_updated_at();

-- live boards (KDS, order board, status page) LISTEN on channel 'orders'
create or replace function notify_order_change() returns trigger language plpgsql as $$
begin
  perform pg_notify('orders', json_build_object('id', new.id, 'status', new.status, 'code', new.order_code)::text);
  return new;
end $$;
create trigger orders_notify after insert or update of status on orders for each row execute function notify_order_change();

create or replace function check_review_order() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from orders where id = new.order_id and status = 'delivered') then
    raise exception 'only delivered orders can be reviewed';
  end if;
  return new;
end $$;
create trigger reviews_delivered_only before insert on reviews for each row execute function check_review_order();

create or replace function check_review_media_limit() returns trigger language plpgsql as $$
declare n_img int; n_vid int;
begin
  select count(*) filter (where kind = 'image'), count(*) filter (where kind = 'video')
    into n_img, n_vid from review_media where review_id = new.review_id;
  if (new.kind = 'image' and (n_img >= 4 or n_vid > 0)) or (new.kind = 'video' and (n_vid >= 1 or n_img > 0)) then
    raise exception 'a review can have up to 4 photos or 1 video';
  end if;
  return new;
end $$;
create trigger review_media_limit before insert on review_media for each row execute function check_review_media_limit();

-- ---------------------------------------------------------------- views
create view stock_on_hand as
  select i.id as ingredient_id, i.name, i.unit, i.reorder_level,
         coalesce(sum(m.quantity), 0) as on_hand,
         coalesce(sum(m.quantity), 0) <= i.reorder_level as is_low
  from ingredients i
  left join stock_movements m on m.ingredient_id = i.id
  where i.active
  group by i.id;

create view daily_sales as
  select (paid_at at time zone 'Asia/Kolkata')::date as day,
         count(*) as orders,
         sum(subtotal_paise - discount_paise) as net_sales_paise,
         sum(gst_paise) as gst_paise,
         sum(total_paise) as gross_paise
  from orders
  where status not in ('pending_payment', 'payment_failed', 'cancelled')
  group by 1;

create view customer_stats as
  select c.id as customer_id, c.phone, c.name, c.tags,
         count(o.id) filter (where o.status = 'delivered') as delivered_orders,
         coalesce(sum(o.total_paise) filter (where o.status = 'delivered'), 0) as lifetime_paise,
         min(o.paid_at) as first_paid_at,
         max(o.paid_at) as last_paid_at
  from customers c
  left join orders o on o.customer_id = c.id
  group by c.id;

create view property_stats as
  select p.id as property_id, p.name, p.slug,
         count(o.id) filter (where o.status = 'delivered') as delivered_orders,
         coalesce(sum(o.subtotal_paise - o.discount_paise) filter (where o.status = 'delivered'), 0) as net_sales_paise
  from properties p
  left join orders o on o.property_id = p.id
  group by p.id;

create view wall_summary as
  select round(avg(rating)::numeric, 1) as avg_rating, count(*) as review_count
  from reviews where not hidden;

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
  ('cod_enabled', 'false'::jsonb),
  ('delivery_fee_paise', '0'),
  ('social_links', '{"instagram": null, "google_review": null, "whatsapp": null}');
