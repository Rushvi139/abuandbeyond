-- Expenses and bills become editable in place, so every row has to say when it
-- was last touched and by whom. Five people share these books; a changed amount
-- with nobody's name on it is how an argument starts.
alter table expenses add column if not exists updated_at timestamptz;
alter table expenses add column if not exists updated_by uuid references staff_users (id);
alter table vendor_bills add column if not exists updated_at timestamptz;
alter table vendor_bills add column if not exists updated_by uuid references staff_users (id);

-- The registers filter by category and by mode, and sort by date.
create index if not exists expenses_category_idx on expenses (category_id);
create index if not exists vendor_bills_date_idx on vendor_bills (bill_date desc);
