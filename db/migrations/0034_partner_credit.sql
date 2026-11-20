-- B2B partners: a hotel (or other business) whose QR link puts every order on
-- its account, settled in bulk on a 15–30 day credit cycle.

-- How a partner's orders are paid: 'guest' (the guest pays as usual, the link
-- only tracks where orders came from) or 'credit' (the partner pays later).
alter table properties add column if not exists billing text not null default 'guest';
do $$ begin
  alter table properties add constraint properties_billing_check check (billing in ('guest', 'credit'));
exception when duplicate_object then null; end $$;
alter table properties add column if not exists credit_days int not null default 15 check (credit_days between 1 and 90);
-- The partner's own read-only page: /p/<token>. Unguessable, rotatable.
alter table properties add column if not exists view_token text unique;
alter table properties alter column view_token set default replace(gen_random_uuid()::text, '-', '');
update properties set view_token = replace(gen_random_uuid()::text, '-', '') where view_token is null;

-- 'credit': on the partner's account; no gateway, nothing collected at the door.
alter table orders drop constraint if exists orders_payment_mode_check;
alter table orders add constraint orders_payment_mode_check check (payment_mode in ('online', 'on_delivery', 'credit'));

create sequence if not exists partner_statement_seq start 1;

create table if not exists partner_statements (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties (id),
  number text not null unique,                 -- ST-0001
  period_from date not null,
  period_to date not null,
  order_count int not null,
  amount_paise bigint not null check (amount_paise >= 0),
  issued_on date not null,
  due_on date not null,
  paid_on date,
  paid_from text check (paid_from in ('hdfc', 'saraspur', 'cash')),
  reference text,
  note text,
  created_by uuid references staff_users (id),
  created_at timestamptz not null default now()
);

alter table orders add column if not exists statement_id uuid references partner_statements (id);
create index if not exists orders_unbilled_credit_idx on orders (property_id) where payment_mode = 'credit' and statement_id is null;
