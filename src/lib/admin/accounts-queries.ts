import "server-only";
import { db } from "@/lib/db";

/**
 * Two different questions get mixed up in a vendor list, so this answers both
 * separately:
 *
 *  - what we bought from them *this month* (billed, paid, cash expenses), and
 *  - what we still owe them *at all*, which does not reset on the 1st.
 *
 * A bill from October that is still unpaid is money owed today, so
 * `outstanding` and `oldestDue` ignore the month filter on purpose.
 */
export type VendorLedgerRow = {
  id: string;
  name: string;
  billedMonth: number;
  paidMonth: number;
  expensesMonth: number;
  outstanding: number;
  oldestDue: string | null;
  openBills: number;
};

export async function vendorLedger(monthStart: string): Promise<VendorLedgerRow[]> {
  return db()<VendorLedgerRow[]>`
    with span as (select ${monthStart}::date as a, (${monthStart}::date + interval '1 month')::date as b),
    billed as (
      select b.vendor_id, sum(b.amount_paise)::bigint as amt
      from vendor_bills b, span where b.bill_date >= span.a and b.bill_date < span.b group by 1
    ),
    paid as (
      select p.vendor_id, sum(p.amount_paise)::bigint as amt
      from vendor_payments p, span where p.paid_on >= span.a and p.paid_on < span.b group by 1
    ),
    spent as (
      select e.vendor_id, sum(e.amount_paise)::bigint as amt
      from expenses e, span where e.vendor_id is not null and e.spent_on >= span.a and e.spent_on < span.b group by 1
    ),
    open_bills as (
      select b.vendor_id,
        sum(b.amount_paise - coalesce(pp.paid, 0))::bigint as due,
        min(coalesce(b.due_on, b.bill_date)) as oldest,
        count(*)::int as n
      from vendor_bills b
      left join lateral (select sum(p.amount_paise) as paid from vendor_payments p where p.vendor_bill_id = b.id) pp on true
      where b.amount_paise > coalesce(pp.paid, 0)
      group by 1
    )
    select v.id, v.name,
      coalesce(billed.amt, 0)::bigint as "billedMonth",
      coalesce(paid.amt, 0)::bigint as "paidMonth",
      coalesce(spent.amt, 0)::bigint as "expensesMonth",
      coalesce(open_bills.due, 0)::bigint as outstanding,
      open_bills.oldest::text as "oldestDue",
      coalesce(open_bills.n, 0) as "openBills"
    from vendors v
    left join billed on billed.vendor_id = v.id
    left join paid on paid.vendor_id = v.id
    left join spent on spent.vendor_id = v.id
    left join open_bills on open_bills.vendor_id = v.id
    where coalesce(billed.amt, 0) > 0 or coalesce(paid.amt, 0) > 0
       or coalesce(spent.amt, 0) > 0 or coalesce(open_bills.due, 0) > 0
    order by open_bills.due desc nulls last, coalesce(billed.amt, 0) + coalesce(spent.amt, 0) desc`;
}

/**
 * Where the month's money actually went, as one list rather than two. Vendor
 * bills (the food) and expense categories (gas, rent, wages) are different
 * kinds of thing, but they come out of the same till, so the owner wants to
 * see them against each other.
 */
export type SpendSlice = { label: string; kind: "stock" | "expense"; amount: number; entries: number };

export async function spendByHead(monthStart: string): Promise<SpendSlice[]> {
  return db()<SpendSlice[]>`
    with span as (select ${monthStart}::date as a, (${monthStart}::date + interval '1 month')::date as b)
    select 'Stock — ' || v.name as label, 'stock' as kind, sum(b.amount_paise)::bigint as amount, count(*)::int as entries
      from vendor_bills b join vendors v on v.id = b.vendor_id, span
      where b.bill_date >= span.a and b.bill_date < span.b
      group by v.name
    union all
    select c.name as label, 'expense' as kind, sum(e.amount_paise)::bigint as amount, count(*)::int as entries
      from expenses e join expense_categories c on c.id = e.category_id, span
      where e.spent_on >= span.a and e.spent_on < span.b
      group by c.name
    order by amount desc`;
}

/** Everything one vendor has ever sent us, and everything we have paid them. */
export async function vendorDetail(id: string) {
  const sql = db();
  const [vendor] = await sql<{ id: string; name: string; category: string | null; contactPerson: string | null; phone: string | null; email: string | null; gstin: string | null; paymentTermsDays: number | null; notes: string | null; active: boolean }[]>`
    select id, name, category, contact_person as "contactPerson", phone, email, gstin,
      payment_terms_days as "paymentTermsDays", notes, active
    from vendors where id = ${id}`;
  if (!vendor) return null;

  const bills = await sql<{ id: string; billNumber: string | null; billDate: string; amount: number; gst: number; dueOn: string | null; filePath: string | null; paid: number }[]>`
    select b.id, b.bill_number as "billNumber", b.bill_date::text as "billDate", b.amount_paise::bigint as amount,
      b.gst_paise::bigint as gst, b.due_on::text as "dueOn", b.file_path as "filePath",
      coalesce((select sum(p.amount_paise) from vendor_payments p where p.vendor_bill_id = b.id), 0)::bigint as paid
    from vendor_bills b where b.vendor_id = ${id} order by b.bill_date desc, b.created_at desc`;

  const payments = await sql<{ id: string; paidOn: string; amount: number; mode: string | null; reference: string | null; billNumber: string | null }[]>`
    select p.id, p.paid_on::text as "paidOn", p.amount_paise::bigint as amount, p.mode, p.reference, b.bill_number as "billNumber"
    from vendor_payments p left join vendor_bills b on b.id = p.vendor_bill_id
    where p.vendor_id = ${id} order by p.paid_on desc, p.created_at desc limit 100`;

  const expenses = await sql<{ id: string; spentOn: string; description: string; category: string; amount: number; mode: string | null; filePath: string | null }[]>`
    select e.id, e.spent_on::text as "spentOn", e.description, c.name as category, e.amount_paise::bigint as amount, e.mode, e.file_path as "filePath"
    from expenses e join expense_categories c on c.id = e.category_id
    where e.vendor_id = ${id} order by e.spent_on desc, e.created_at desc limit 100`;

  const byMonth = await sql<{ month: string; billed: number; paid: number; spent: number }[]>`
    with m as (
      select to_char(bill_date, 'YYYY-MM') as month, sum(amount_paise)::bigint as billed, 0::bigint as paid, 0::bigint as spent
        from vendor_bills where vendor_id = ${id} group by 1
      union all
      select to_char(paid_on, 'YYYY-MM'), 0, sum(amount_paise)::bigint, 0 from vendor_payments where vendor_id = ${id} group by 1
      union all
      select to_char(spent_on, 'YYYY-MM'), 0, 0, sum(amount_paise)::bigint from expenses where vendor_id = ${id} group by 1
    )
    select month, sum(billed)::bigint as billed, sum(paid)::bigint as paid, sum(spent)::bigint as spent
    from m group by month order by month desc limit 12`;

  return { vendor, bills, payments, expenses, byMonth };
}

/** Pay-on-delivery orders the rider hasn't handed in yet. */
export async function uncollected() {
  const [row] = await db()<{ n: number; amount: number }[]>`
    select count(*)::int as n, coalesce(sum(total_paise), 0)::bigint as amount
    from orders
    where payment_mode = 'on_delivery' and collected_at is null and not is_demo
      and status not in ('pending_payment', 'payment_failed', 'cancelled')`;
  return { count: row?.n ?? 0, amountPaise: Number(row?.amount ?? 0) };
}
