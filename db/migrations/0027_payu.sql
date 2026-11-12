-- Payments move from Cashfree to PayU.
--
-- PayU has no "create order" step and refuses a txnid it has seen before, so
-- a guest who abandons the payment page and tries again needs a fresh txnid
-- for the same order. Each try is a row here. Any one of them succeeding pays
-- the order, which is why `markPaid` looks attempts up here rather than
-- trusting a single id stored on the order.
--
-- Old Cashfree rows stay as they are: `orders.gateway_order_id` still finds
-- them, and every one of them was taken on sandbox keys.

create table if not exists payment_attempts (
  txnid text primary key,                 -- what PayU knows the attempt by
  order_id uuid not null references orders (id) on delete cascade,
  gateway text not null default 'payu',
  amount_paise bigint not null check (amount_paise > 0),
  env text not null check (env in ('sandbox', 'production')),
  created_at timestamptz not null default now()
);
create index if not exists payment_attempts_order_idx on payment_attempts (order_id, created_at desc);

alter table payments alter column gateway set default 'payu';
