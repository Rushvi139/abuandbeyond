-- Taking money without a payment gateway.
--
-- `status` stays about fulfilment — paid/accepted/preparing means "cook it".
-- Whether the money has actually arrived is a separate question, because for
-- an order collected at the door those two things happen hours apart.
alter table orders add column if not exists payment_mode text not null default 'online';
alter table orders add column if not exists collected_at timestamptz;
alter table orders add column if not exists collected_by uuid references staff_users (id);

do $$ begin
  alter table orders add constraint orders_payment_mode_check
    check (payment_mode in ('online', 'on_delivery'));
exception when duplicate_object then null; end $$;

-- The rider's list of "still to collect" and the day's cash reconciliation.
create index if not exists orders_uncollected_idx on orders (payment_mode, collected_at)
  where payment_mode = 'on_delivery' and collected_at is null;

-- Where guests send a UPI payment when there is no gateway. Empty until set.
insert into settings (key, value) values ('upi', '{"vpa": null, "name": null}'::jsonb)
  on conflict (key) do nothing;
