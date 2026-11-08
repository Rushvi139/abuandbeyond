-- A photo of the slip is the receipt. Vendor bills could already carry one;
-- expenses could not, which meant the gas bill and the market cash run had no
-- paper behind them at all.
alter table expenses add column if not exists file_path text;

-- The accounts page now groups by vendor and by day, and the vendor page walks
-- one vendor's whole history. These make those scans cheap.
create index if not exists expenses_vendor_idx on expenses (vendor_id) where vendor_id is not null;
create index if not exists expenses_spent_on_idx on expenses (spent_on);
create index if not exists vendor_bills_vendor_idx on vendor_bills (vendor_id);
create index if not exists vendor_payments_bill_idx on vendor_payments (vendor_bill_id);
create index if not exists vendor_payments_vendor_idx on vendor_payments (vendor_id);
