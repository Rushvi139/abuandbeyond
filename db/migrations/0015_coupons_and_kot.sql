-- Coupons, and a record of which tickets have been printed.
--
-- `orders` already carried promo_code and discount_paise from day one; this is
-- what fills them in.

create table coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  description text,
  kind text not null check (kind in ('percent', 'flat')),
  percent int check (percent between 1 and 100),
  value_paise bigint check (value_paise > 0),
  -- A percentage off an unbounded bill is how a coupon costs more than the
  -- order earns. Optional, but the admin screen nudges hard.
  max_discount_paise bigint check (max_discount_paise > 0),
  min_order_paise bigint not null default 0,
  starts_on date,
  ends_on date,
  max_redemptions int check (max_redemptions > 0),
  per_customer_limit int not null default 1 check (per_customer_limit > 0),
  first_order_only boolean not null default false,
  active boolean not null default true,
  created_by uuid references staff_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  updated_by uuid references staff_users (id),
  -- Exactly one of percent / value_paise, matching `kind`.
  constraint coupons_shape check (
    (kind = 'percent' and percent is not null and value_paise is null) or
    (kind = 'flat' and value_paise is not null and percent is null)
  ),
  constraint coupons_dates check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

-- Codes are matched case-insensitively: nobody types SUMMER20 the same way twice.
create unique index coupons_code_uniq on coupons (upper(code));

create table coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references coupons (id) on delete cascade,
  order_id uuid not null references orders (id) on delete cascade,
  customer_id uuid not null references customers (id),
  discount_paise bigint not null,
  created_at timestamptz not null default now(),
  unique (order_id)
);

create index coupon_redemptions_coupon_idx on coupon_redemptions (coupon_id);
create index coupon_redemptions_customer_idx on coupon_redemptions (coupon_id, customer_id);

-- A row is written when the order is created, for the audit trail, but it only
-- counts against a limit while the order is alive — see `liveRedemptions`. An
-- abandoned checkout must not burn somebody's coupon.

-- Which tickets have been printed, so two kitchen tablets don't both fire the
-- printer for the same order. Claimed with a conditional update.
alter table orders add column if not exists kot_printed_at timestamptz;
