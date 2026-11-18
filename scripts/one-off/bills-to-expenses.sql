-- Empty Vendor bills so the owner can enter bills from zero. Every vendor bill
-- entered so far (eggs, milk, vegetables…) becomes an expense on its bill
-- date, with its item lines; then the bills and their payments go.
--
-- Stock is untouched: the items already went into stock through
-- stock_movements when they were first entered, and nothing here changes that.
--
-- A full copy of vendor_bills, vendor_payments, spend_lines and expenses is
-- kept first in schema backup_bills_20261118, so nothing is lost.
--
-- PREVIEW (changes nothing, shows what would move):
--   docker compose exec -T db psql -U abu -d abuandbeyond -f - < scripts/one-off/bills-to-expenses.sql
-- APPLY (does it):
--   docker compose exec -T db psql -U abu -d abuandbeyond -v apply=1 -f - < scripts/one-off/bills-to-expenses.sql

\set ON_ERROR_STOP on
\pset pager off
begin;

create schema if not exists backup_bills_20261118;
create table if not exists backup_bills_20261118.vendor_bills as select * from vendor_bills;
create table if not exists backup_bills_20261118.vendor_payments as select * from vendor_payments;
create table if not exists backup_bills_20261118.spend_lines as select * from spend_lines;
create table if not exists backup_bills_20261118.expenses as select * from expenses;

-- One new expense id per bill, with what the bill's payments say.
create temp table moving on commit drop as
select b.id as bill_id, gen_random_uuid() as expense_id, b.*,
  v.name as vendor_name,
  coalesce(p.paid, 0) as paid,
  p.accounts,
  p.modes,
  (select string_agg(item_name, ', ' order by created_at) from spend_lines l where l.vendor_bill_id = b.id) as items
from vendor_bills b
join vendors v on v.id = b.vendor_id
left join lateral (
  select sum(amount_paise) as paid,
    array_agg(distinct paid_from) filter (where paid_from is not null) as accounts,
    string_agg(distinct mode, ', ') as modes
  from vendor_payments where vendor_bill_id = b.id
) p on true;

\echo
\echo '=== Vendor bills that will become expenses on their bill date ==='
select bill_date as date, vendor_name as vendor, coalesce(bill_number, '—') as bill_no,
  (amount_paise / 100.0)::numeric(12,2) as amount_inr, (paid / 100.0)::numeric(12,2) as paid_inr,
  left(coalesce(items, description, ''), 70) as items
from moving order by bill_date, vendor_name;

select count(*) as bills, (sum(amount_paise) / 100.0)::numeric(12,2) as total_inr from moving;

\echo '=== Payments not tied to any bill (also removed; they were paying off these bills) ==='
select paid_on, v.name as vendor, (amount_paise / 100.0)::numeric(12,2) as amount_inr, mode
from vendor_payments p join vendors v on v.id = p.vendor_id where p.vendor_bill_id is null order by paid_on;

insert into expenses (id, category_id, spent_on, description, amount_paise, vendor_id, mode, paid_from,
                      reference, file_path, created_by, note, created_at)
select expense_id,
  coalesce(category_id, 'raw_material'),
  bill_date,
  coalesce(nullif(description, ''), nullif(left(items, 200), ''), 'Bill from ' || vendor_name),
  amount_paise,
  vendor_id,
  -- One account across all its payments → keep it; otherwise leave it to tag on Bank & cash.
  case when array_length(accounts, 1) = 1 then (case accounts[1] when 'hdfc' then 'HDFC' when 'saraspur' then 'Saraspur' else 'Cash' end) else modes end,
  case when array_length(accounts, 1) = 1 then accounts[1] end,
  bill_number,
  file_path,
  created_by,
  nullif(concat_ws(' · ', 'Moved from vendor bills 18 Nov',
    case when paid < amount_paise then 'bill showed ₹' || ((amount_paise - paid) / 100.0)::numeric(12,2) || ' unpaid' end,
    note), ''),
  created_at
from moving;

update spend_lines l set expense_id = m.expense_id, vendor_bill_id = null
from moving m where l.vendor_bill_id = m.bill_id;

delete from vendor_payments;
delete from vendor_bills;

\echo '=== After ==='
select (select count(*) from vendor_bills) as vendor_bills_left,
       (select count(*) from vendor_payments) as payments_left,
       (select count(*) from expenses where note like 'Moved from vendor bills 18 Nov%') as expenses_added;

\if :{?apply}
  commit;
  \echo 'DONE: bills moved to expenses. Backup kept in schema backup_bills_20261118.'
\else
  rollback;
  \echo 'PREVIEW ONLY: nothing was changed. Run again with -v apply=1 to do it.'
\endif
