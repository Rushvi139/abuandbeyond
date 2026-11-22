-- Editing an order after it is placed: a guest calls to add a dish, drop one
-- or add an add-on. The order keeps its number; every edit is logged.
alter table orders add column if not exists edited_at timestamptz;
alter table orders add column if not exists edit_count int not null default 0;
-- Money already taken vs the new total, for orders paid before the edit:
-- positive = collect this much more at the door, negative = refund owed.
alter table orders add column if not exists balance_paise bigint not null default 0;
-- Extra collected at the door after an edit on an order already paid online,
-- so Bank & cash can count it as cash/UPI and not as PayU.
alter table orders add column if not exists balance_collected_paise bigint not null default 0;

create table if not exists order_edits (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  staff_id uuid references staff_users (id),
  before_total_paise bigint not null,
  after_total_paise bigint not null,
  summary text not null,
  created_at timestamptz not null default now()
);
create index if not exists order_edits_order_idx on order_edits (order_id, created_at);
