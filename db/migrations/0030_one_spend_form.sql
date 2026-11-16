-- One form for all money going out.
--
-- The team had two forms ("vendor bill" and "expense") and no rule for which
-- to use, so vegetables landed in both. Now there is one form with a
-- category, and the only other question is whether it was paid on the spot
-- or is owed: paid now is stored as an expense, on credit as a vendor bill.
-- Either can carry item lines, which is what raises stock.
--
-- Categories are the owner's list. Three old ones are the same thing under a
-- longer name, so they are renamed in place and their past entries follow;
-- nothing is moved between categories.

alter table expense_categories add column if not exists active boolean not null default true;
alter table expense_categories add column if not exists sort_order int not null default 100;
alter table expense_categories add column if not exists has_items boolean not null default false;

update expense_categories set name = 'Kitchen', sort_order = 1, has_items = true where id = 'raw_material';
update expense_categories set name = 'Disposables', sort_order = 2, has_items = true where id = 'packaging';
update expense_categories set name = 'Staff', sort_order = 3 where id = 'salaries';
update expense_categories set sort_order = 4 where id = 'marketing';
insert into expense_categories (id, name, sort_order) values
  ('it', 'IT', 5), ('maintenance', 'Maintenance', 6), ('others', 'Others', 99)
on conflict (id) do nothing;
update expense_categories set sort_order = 7 where id = 'utilities';
update expense_categories set sort_order = 8 where id = 'rent';
update expense_categories set sort_order = 9 where id = 'delivery';
-- "Consumables, software, repairs" is three of the new categories at once;
-- its past entries keep it, new ones choose IT, Maintenance or Disposables.
update expense_categories set active = false where id in ('consumables', 'misc');  -- misc is "Others" now

alter table expenses add column if not exists staff_name text;
alter table vendor_bills add column if not exists category_id text references expense_categories (id);
alter table vendor_bills add column if not exists description text;
update vendor_bills set category_id = 'raw_material' where category_id is null;

-- What was bought, line by line. Belongs to exactly one expense or one bill.
create table if not exists spend_lines (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid references expenses (id) on delete cascade,
  vendor_bill_id uuid references vendor_bills (id) on delete cascade,
  ingredient_id uuid references ingredients (id),
  item_name text not null,
  quantity numeric(12,3) not null check (quantity > 0),   -- in the ingredient's base unit (g, ml, pc)
  amount_paise bigint not null check (amount_paise >= 0),
  created_at timestamptz not null default now(),
  check ((expense_id is null) <> (vendor_bill_id is null))
);
create index if not exists spend_lines_expense_idx on spend_lines (expense_id);
create index if not exists spend_lines_bill_idx on spend_lines (vendor_bill_id);
create index if not exists spend_lines_ingredient_idx on spend_lines (ingredient_id, created_at desc);
