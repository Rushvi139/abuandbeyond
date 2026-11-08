-- Payments move from Razorpay to Cashfree. The columns become gateway-neutral:
-- `gateway_order_id` is our own order code at Cashfree, `gateway_payment_id`
-- is their cf_payment_id. Razorpay rows (none in production yet) carry over.

alter table payments add column if not exists gateway text not null default 'cashfree';
alter table payments rename column razorpay_order_id to gateway_order_id;
alter table payments rename column razorpay_payment_id to gateway_payment_id;

alter table orders rename column razorpay_order_id to gateway_order_id;

-- A refund needs an id we generate ourselves, and Cashfree keys refunds by order.
create table if not exists refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id),
  refund_id text not null unique,            -- the id we hand Cashfree
  amount_paise bigint not null check (amount_paise > 0),
  status text not null default 'PENDING',
  reason text,
  raw jsonb,
  created_by uuid references staff_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists refunds_order_idx on refunds (order_id);
