-- Back office CRM: customer profile fields, properties (hotels / villas sending orders),
-- order attribution (QR source) and staff-created orders paid by WhatsApp payment link.

create table properties (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,                 -- used in QR links: /?src=<slug>
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

alter table customers
  add column tags text[] not null default '{}',        -- tourist, local, repeat, vip
  add column notes text,
  add column first_order_at timestamptz,
  add column last_order_at timestamptz;

alter table orders
  add column property_id uuid references properties (id),
  add column source_ref text,                           -- ?src= value from the QR (hamper, hoarding, property slug)
  add column created_by uuid references profiles (id),  -- set for manual (staff) orders
  add column payment_link_url text;                     -- WhatsApp / Razorpay link for manual and reorder orders

-- orders.source already exists: 'web' | 'whatsapp' | 'manual' | 'reorder'

create view customer_stats with (security_invoker = true) as
  select c.id as customer_id, c.phone, c.name, c.tags,
         count(o.id) filter (where o.status = 'delivered') as delivered_orders,
         coalesce(sum(o.total_paise) filter (where o.status = 'delivered'), 0) as lifetime_paise,
         min(o.paid_at) as first_paid_at,
         max(o.paid_at) as last_paid_at
  from customers c
  left join orders o on o.customer_id = c.id
  group by c.id;

create view property_stats with (security_invoker = true) as
  select p.id as property_id, p.name, p.slug,
         count(o.id) filter (where o.status = 'delivered') as delivered_orders,
         coalesce(sum(o.subtotal_paise - o.discount_paise) filter (where o.status = 'delivered'), 0) as net_sales_paise
  from properties p
  left join orders o on o.property_id = p.id
  group by p.id;

alter table properties enable row level security;
create policy "staff read properties" on properties for select using (has_role('{owner,manager,rider}'));
create policy "managers manage properties" on properties for all using (has_role('{owner,manager}')) with check (has_role('{owner,manager}'));
create policy "managers update customers" on customers for update using (has_role('{owner,manager}')) with check (has_role('{owner,manager}'));
