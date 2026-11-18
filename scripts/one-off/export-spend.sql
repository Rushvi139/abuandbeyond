-- Everything entered as money going out since a date, one row per entry,
-- with its item lines. Read-only. Run on the server:
--   docker compose exec -T db psql -U abu -d abuandbeyond -v since=2026-11-10 \
--     -f - < scripts/one-off/export-spend.sql > spend-since.csv
copy (
  with lines as (
    select coalesce(expense_id, vendor_bill_id) as parent,
      string_agg(item_name || ' x' || quantity::text || ' = ' || (amount_paise / 100)::text, ' | ' order by item_name) as items
    from spend_lines group by 1
  )
  select 'expense' as kind, e.spent_on as date, c.name as category, v.name as paid_to, e.description,
    e.mode, e.reference, (e.amount_paise / 100.0)::numeric(12,2) as amount_inr, e.staff_name, e.note, l.items,
    u.full_name as entered_by, e.created_at, e.id
  from expenses e join expense_categories c on c.id = e.category_id
  left join vendors v on v.id = e.vendor_id left join staff_users u on u.id = e.created_by
  left join lines l on l.parent = e.id
  where e.spent_on >= :'since'::date
  union all
  select 'vendor_bill', b.bill_date, c.name, v.name, coalesce(b.description, b.bill_number),
    null, b.bill_number, (b.amount_paise / 100.0)::numeric(12,2), null, b.note, l.items,
    u.full_name, b.created_at, b.id
  from vendor_bills b join vendors v on v.id = b.vendor_id
  left join expense_categories c on c.id = b.category_id
  left join staff_users u on u.id = b.created_by left join lines l on l.parent = b.id
  where b.bill_date >= :'since'::date
  union all
  select 'bill_payment', p.paid_on, null, v.name, p.notes, p.mode, p.reference, (p.amount_paise / 100.0)::numeric(12,2),
    null, null, null, null, p.created_at, p.id
  from vendor_payments p join vendors v on v.id = p.vendor_id
  where p.paid_on >= :'since'::date
  order by 2, 13
) to stdout with csv header;
