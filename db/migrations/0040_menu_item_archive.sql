-- "Remove forever" from Admin → Menu → Off the menu. A dish that was never
-- ordered is deleted outright; one with orders is archived instead, so old
-- orders, bills and sales reports keep its name and price. Archived dishes
-- no longer show anywhere in Admin.
alter table menu_items add column if not exists archived_at timestamptz;
