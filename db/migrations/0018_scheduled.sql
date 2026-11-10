-- "Deliver at 9pm", rather than as soon as it's cooked.
--
-- Null means now, which is every order so far — so the column is simply
-- absent for ASAP orders rather than being filled with the created_at time.
-- The kitchen's queries key off "is this null" and must keep doing so.
alter table orders add column if not exists scheduled_for timestamptz;

-- The pass sorts by it, and the kitchen screen asks for the next few hours.
create index if not exists orders_scheduled_idx on orders (scheduled_for)
  where scheduled_for is not null;
