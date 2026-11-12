-- Hotels the guests teach us.
--
-- When a guest types a hotel, villa or homestay that isn't in the directory,
-- the order adds it, so the next guest finds it in the suggestions. If that
-- guest also shared a precise GPS pin, it becomes the place's location — the
-- rider can then navigate there for every later order.
--
-- `source` says where a row came from, so staff can review what guests added
-- (Stay Directory → "Added by guests") and fix or delete a typo. Rows from
-- before this were all imported or hand-added, so they stay null.

alter table stays add column if not exists source text
  check (source is null or source in ('sweep', 'staff', 'guest'));
alter table stays add column if not exists first_order_id uuid references orders (id) on delete set null;
create index if not exists stays_guest_idx on stays (created_at desc) where source = 'guest';
