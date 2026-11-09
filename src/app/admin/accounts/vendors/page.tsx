import Link from "next/link";
import { BillRegister, type BillRow } from "@/components/admin/bill-register";
import { BOOKKEEPERS, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vendor bills — Abu & Beyond" };

type Search = { from?: string; to?: string; vendor?: string; status?: string; q?: string };
const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export default async function VendorBillsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const staff = await requireRole(BOOKKEEPERS, "/admin/accounts/vendors");
  const sp = await searchParams;

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const from = isDate(sp.from) ? sp.from! : "";
  const to = isDate(sp.to) ? sp.to! : "";
  const vendor = sp.vendor?.trim() || "";
  const q = sp.q?.trim() || "";
  // Default to what is unpaid, because that is the list anyone opens this
  // screen to act on. "all" is one tap away.
  const status = ["all", "open", "overdue", "paid"].includes(sp.status ?? "") ? sp.status! : "open";

  const sql = db();
  const [rows, vendorNames] = await Promise.all([
    sql<BillRow[]>`
      with b as (
        select vb.id, vb.vendor_id as "vendorId", v.name as vendor, vb.bill_number as "billNumber",
          vb.bill_date::text as "billDate", vb.due_on::text as "dueOn",
          vb.amount_paise::bigint as amount, vb.gst_paise::bigint as gst,
          coalesce((select sum(p.amount_paise) from vendor_payments p where p.vendor_bill_id = vb.id), 0)::bigint as paid,
          vb.note, vb.file_path as "filePath", u.full_name as "updatedBy"
        from vendor_bills vb
        join vendors v on v.id = vb.vendor_id
        left join staff_users u on u.id = vb.updated_by
        -- nullif, rather than comparing the parameter to an empty string:
        -- Postgres does not promise to short-circuit OR, so a blank filter
        -- still reaches the date cast and throws. A null here just fails the
        -- comparison instead.
        where (nullif(${from}, '')::date is null or vb.bill_date >= nullif(${from}, '')::date)
          and (nullif(${to}, '')::date is null or vb.bill_date <= nullif(${to}, '')::date)
          and (${vendor} = '' or v.name = ${vendor})
          and (${q} = '' or coalesce(vb.bill_number, '') ilike ${"%" + q + "%"})
      )
      select * from b
      where case ${status}
        when 'open' then b.amount > b.paid
        when 'paid' then b.amount <= b.paid
        when 'overdue' then b.amount > b.paid and coalesce(b."dueOn", b."billDate") < ${today}
        else true end
      order by
        case when b.amount > b.paid then 0 else 1 end,
        coalesce(b."dueOn", b."billDate") asc
      limit 500`,
    sql<{ name: string }[]>`select name from vendors order by name`,
  ]);

  const counts = await sql<{ open: number; overdue: number }[]>`
    select
      count(*) filter (where vb.amount_paise > coalesce(p.paid, 0))::int as open,
      count(*) filter (where vb.amount_paise > coalesce(p.paid, 0)
        and coalesce(vb.due_on, vb.bill_date) < ${today}::date)::int as overdue
    from vendor_bills vb
    left join lateral (select sum(x.amount_paise) as paid from vendor_payments x where x.vendor_bill_id = vb.id) p on true`;
  const { open, overdue } = counts[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/accounts" className="text-sm font-semibold text-muted underline-offset-2 hover:underline">← Accounts</Link>
          <h1 className="mt-1 font-display text-[32px] uppercase">Vendor bills</h1>
          <p className="text-sm text-muted">
            {open} open{overdue > 0 && <span className="font-semibold text-error"> · {overdue} overdue</span>}. Unpaid first, soonest due at the top.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/accounts/expenses" className="h-10 rounded-xl border-[1.5px] border-ink px-3 text-sm font-semibold leading-10">
            Expenses
          </Link>
          <a href={`/admin/export/bills?month=${(to || today).slice(0, 7)}`} className="h-10 rounded-xl bg-ink px-3 text-sm font-semibold leading-10 text-reversed">
            Excel
          </a>
        </div>
      </div>

      <form className="grid grid-cols-2 gap-2 rounded-2xl bg-surface p-3 sm:grid-cols-3 lg:grid-cols-6">
        <Labelled label="Status">
          <select name="status" defaultValue={status} className={inp}>
            <option value="open">Unpaid</option>
            <option value="overdue">Overdue</option>
            <option value="paid">Settled</option>
            <option value="all">All</option>
          </select>
        </Labelled>
        <Labelled label="Vendor">
          <select name="vendor" defaultValue={vendor} className={inp}>
            <option value="">All</option>
            {vendorNames.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
          </select>
        </Labelled>
        <Labelled label="From"><input type="date" name="from" defaultValue={from} className={inp} /></Labelled>
        <Labelled label="To"><input type="date" name="to" defaultValue={to} className={inp} /></Labelled>
        <Labelled label="Bill no."><input name="q" defaultValue={q} placeholder="e.g. KD-10" className={inp} /></Labelled>
        <div className="flex items-end gap-2">
          <button type="submit" className="h-10 flex-1 rounded-xl bg-ink text-sm font-semibold text-reversed">Apply</button>
          <Link href="/admin/accounts/vendors" className="h-10 rounded-xl px-2 text-sm leading-10 text-muted">Clear</Link>
        </div>
      </form>

      <BillRegister
        rows={rows.map((r) => ({ ...r, amount: Number(r.amount), gst: Number(r.gst), paid: Number(r.paid) }))}
        today={today}
        canEdit={BOOKKEEPERS.includes(staff.role)}
        canDelete={staff.role === "owner"}
      />

      {rows.length === 500 && <p className="text-center text-sm text-muted">Showing 500 bills. Narrow the dates to see further back.</p>}
      <p className="px-1 text-[11px] text-muted">
        Totals are for the bills listed above, not the whole year. For one vendor&apos;s full history, open a row and tap their name.
      </p>
    </div>
  );
}

const inp = "h-10 w-full rounded-xl border-[1.5px] border-line bg-paper px-2.5 text-sm outline-none focus:border-ink";

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}
