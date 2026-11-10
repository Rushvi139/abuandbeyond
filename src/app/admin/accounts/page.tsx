import Link from "next/link";
import { BillForm, ExpenseForm, PayBill } from "@/components/admin/accounts-forms";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/pricing";
import { spendByHead, uncollected, vendorLedger } from "@/lib/admin/accounts-queries";

export const dynamic = "force-dynamic";

type Day = { day: string; orders: number; net: number; gst: number; gross: number; expenses: number; bills: number };
type Bill = { id: string; vendorId: string; vendor: string; billNumber: string | null; billDate: string; amount: number; gst: number; dueOn: string | null; filePath: string | null; paid: number };
type Expense = { id: string; spentOn: string; category: string; description: string; amount: number; mode: string | null; vendor: string | null; vendorId: string | null; filePath: string | null };

const d = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireRole(["owner"], "/admin/accounts");
  const { month } = await searchParams; // YYYY-MM
  const sql = db();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const m = month && /^\d{4}-\d{2}$/.test(month) ? month : today.slice(0, 7);
  const start = `${m}-01`;
  const monthLabel = new Date(`${start}T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

  const days = await sql<Day[]>`
    with sales as (
      select day, orders::int, net_sales_paise::bigint as net, gst_paise::bigint as gst, gross_paise::bigint as gross from daily_sales
    ), ex as (select spent_on as day, sum(amount_paise)::bigint as expenses from expenses group by 1),
       bi as (select bill_date as day, sum(amount_paise)::bigint as bills from vendor_bills group by 1),
       alld as (select day from sales union select day from ex union select day from bi)
    select alld.day, coalesce(s.orders, 0) as orders, coalesce(s.net, 0) as net, coalesce(s.gst, 0) as gst, coalesce(s.gross, 0) as gross,
      coalesce(ex.expenses, 0) as expenses, coalesce(bi.bills, 0) as bills
    from alld left join sales s on s.day = alld.day left join ex on ex.day = alld.day left join bi on bi.day = alld.day
    where alld.day >= ${start}::date and alld.day < (${start}::date + interval '1 month')
    order by alld.day desc`;
  const tot = days.reduce((a, x) => ({ net: a.net + x.net, gst: a.gst + x.gst, expenses: a.expenses + x.expenses, bills: a.bills + x.bills, orders: a.orders + x.orders }), { net: 0, gst: 0, expenses: 0, bills: 0, orders: 0 });
  const directPct = tot.net ? Math.round((tot.bills / tot.net) * 100) : null;

  const bills = await sql<Bill[]>`
    select b.id, b.vendor_id as "vendorId", v.name as vendor, b.bill_number as "billNumber", b.bill_date as "billDate", b.amount_paise as amount, b.gst_paise as gst, b.due_on as "dueOn", b.file_path as "filePath",
      coalesce((select sum(p.amount_paise) from vendor_payments p where p.vendor_bill_id = b.id), 0)::bigint as paid
    from vendor_bills b join vendors v on v.id = b.vendor_id order by b.bill_date desc limit 60`;
  const expenses = await sql<Expense[]>`
    select e.id, e.spent_on as "spentOn", c.name as category, e.description, e.amount_paise as amount, e.mode, v.name as vendor, e.vendor_id as "vendorId", e.file_path as "filePath"
    from expenses e join expense_categories c on c.id = e.category_id left join vendors v on v.id = e.vendor_id
    where e.spent_on >= ${start}::date and e.spent_on < (${start}::date + interval '1 month') order by e.spent_on desc, e.created_at desc limit 100`;
  const categories = await sql<{ id: string; name: string }[]>`select id, name from expense_categories order by name`;
  const vendors = await sql<{ name: string }[]>`select name from vendors where active order by name`;
  const [ledger, spend, toCollect] = await Promise.all([vendorLedger(start), spendByHead(start), uncollected()]);

  // Outstanding is every unpaid bill, whenever it was raised — an October bill
  // we never settled is still money owed in November.
  const duesTotal = ledger.reduce((n, v) => n + Number(v.outstanding), 0);
  const openCount = ledger.reduce((n, v) => n + v.openBills, 0);
  const paidMonth = ledger.reduce((n, v) => n + Number(v.paidMonth), 0);
  const overdue = ledger.filter((v) => v.oldestDue && v.oldestDue < today);
  const spendTotal = spend.reduce((n, s) => n + Number(s.amount), 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[32px] uppercase">Accounts</h1>
          <p className="text-sm text-muted">Daily ledger from live orders, vendor bills and expenses. Sales are before GST.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form className="flex gap-2"><input type="month" name="month" defaultValue={m} className="h-10 rounded-xl border border-line bg-surface px-3 text-sm" /><button className="h-10 rounded-xl bg-ink px-4 text-sm font-semibold text-reversed">Show</button></form>
          {["ledger", "orders", "bills", "expenses", "vendors"].map((r) => (
            <Link key={r} href={`/admin/export/${r}?month=${m}`} className="h-10 rounded-xl border border-ink px-3 text-sm font-semibold capitalize leading-10">{r} CSV</Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Stat label="Net sales" value={formatINR(tot.net)} sub={`${tot.orders} orders`} />
        <Stat label="Vendor bills" value={formatINR(tot.bills)} sub={directPct !== null ? `${directPct}% of sales (ceiling 33%)` : ""} tone={directPct !== null && directPct > 33 ? "bad" : ""} />
        <Stat label="Expenses" value={formatINR(tot.expenses)} />
        <Stat label="Left over" value={formatINR(tot.net - tot.bills - tot.expenses)} sub="sales − bills − expenses" tone={tot.net - tot.bills - tot.expenses < 0 ? "bad" : "good"} />
        <Stat label="Paid out" value={formatINR(paidMonth)} sub="to vendors this month" />
        {toCollect.count > 0 && (
          <Stat
            label="To collect"
            value={formatINR(toCollect.amountPaise)}
            sub={`${toCollect.count} pay-on-delivery order${toCollect.count === 1 ? "" : "s"} not handed in`}
            tone="warn"
          />
        )}
        <Stat
          label="Still owed"
          value={formatINR(duesTotal)}
          sub={openCount ? `${openCount} bill${openCount === 1 ? "" : "s"}${overdue.length ? ` · ${overdue.length} overdue` : ""}` : "all settled"}
          tone={overdue.length ? "bad" : duesTotal ? "warn" : "good"}
        />
      </div>

      <section>
        <h2 className="mb-2 font-display text-[18px] uppercase">Daily ledger</h2>
        <div className="overflow-x-auto rounded-2xl bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-3">Day</th><th className="px-4 py-3 text-right">Orders</th><th className="px-4 py-3 text-right">Net sales</th><th className="px-4 py-3 text-right">GST</th><th className="px-4 py-3 text-right">Bills</th><th className="px-4 py-3 text-right">Expenses</th><th className="px-4 py-3 text-right">Left over</th></tr></thead>
            <tbody>
              {days.map((x) => (
                <tr key={x.day} className="border-t border-line">
                  <td className="px-4 py-2.5 font-semibold">{d(x.day)}</td>
                  <td className="px-4 py-2.5 text-right">{x.orders}</td>
                  <td className="px-4 py-2.5 text-right">{formatINR(x.net)}</td>
                  <td className="px-4 py-2.5 text-right text-muted">{formatINR(x.gst)}</td>
                  <td className="px-4 py-2.5 text-right">{formatINR(x.bills)}</td>
                  <td className="px-4 py-2.5 text-right">{formatINR(x.expenses)}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${x.net - x.bills - x.expenses < 0 ? "text-error" : ""}`}>{formatINR(x.net - x.bills - x.expenses)}</td>
                </tr>
              ))}
              {days.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted">Nothing in this month yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <div className="mb-2 flex items-baseline gap-3">
            <h2 className="font-display text-[18px] uppercase">Vendors</h2>
            <Link href="/admin/accounts/vendors" className="text-xs font-semibold text-hill underline-offset-2 hover:underline">
              open the bill register →
            </Link>
          </div>
          <div className="overflow-x-auto rounded-2xl bg-surface">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3 text-right">Billed</th>
                  <th className="px-4 py-3 text-right">Cash spends</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Still owed</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((v) => {
                  const late = v.oldestDue && v.oldestDue < today;
                  return (
                    <tr key={v.id} className="border-t border-line">
                      <td className="px-4 py-2.5">
                        <Link href={`/admin/accounts/vendors/${v.id}`} className="font-semibold underline-offset-2 hover:underline">
                          {v.name}
                        </Link>
                        {v.oldestDue && (
                          <span className={`block text-[11px] ${late ? "font-semibold text-error" : "text-muted"}`}>
                            {late ? "overdue since" : "due"} {d(v.oldestDue)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">{Number(v.billedMonth) ? formatINR(Number(v.billedMonth)) : <span className="text-muted">—</span>}</td>
                      <td className="px-4 py-2.5 text-right">{Number(v.expensesMonth) ? formatINR(Number(v.expensesMonth)) : <span className="text-muted">—</span>}</td>
                      <td className="px-4 py-2.5 text-right text-success">{Number(v.paidMonth) ? formatINR(Number(v.paidMonth)) : <span className="text-muted">—</span>}</td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${Number(v.outstanding) ? (late ? "text-error" : "") : "text-muted"}`}>
                        {Number(v.outstanding) ? formatINR(Number(v.outstanding)) : "settled"}
                      </td>
                    </tr>
                  );
                })}
                {ledger.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">No vendor activity this month.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="mt-1.5 text-[11px] text-muted">
            Billed, cash spends and paid are for {monthLabel}. Still owed is every unpaid bill, whenever it was raised.
          </p>
        </section>

        <section className="lg:col-span-2">
          <h2 className="mb-2 font-display text-[18px] uppercase">Where it went</h2>
          <div className="flex flex-col gap-2 rounded-2xl bg-surface p-4">
            {spend.map((s) => {
              const pct = spendTotal ? (Number(s.amount) / spendTotal) * 100 : 0;
              return (
                <div key={`${s.kind}-${s.label}`}>
                  <div className="flex items-baseline gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{s.label}</span>
                    <span className="font-semibold">{formatINR(Number(s.amount))}</span>
                    <span className="w-10 text-right text-[11px] text-muted">{pct < 1 ? "<1" : pct.toFixed(0)}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper">
                    <div className={`h-full rounded-full ${s.kind === "stock" ? "bg-clay" : "bg-hill"}`} style={{ width: `${Math.max(pct, 1.5)}%` }} />
                  </div>
                </div>
              );
            })}
            {spend.length === 0 && <p className="py-4 text-center text-sm text-muted">Nothing spent this month yet.</p>}
            {spend.length > 0 && (
              <p className="mt-1 border-t border-line pt-2 text-sm">
                <span className="font-semibold">{formatINR(spendTotal)}</span> <span className="text-muted">out the door in {monthLabel}</span>
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section>
          <div className="mb-2 flex items-baseline gap-3">
            <h2 className="font-display text-[18px] uppercase">Vendor bills</h2>
            <Link href="/admin/accounts/vendors" className="text-xs font-semibold text-hill underline-offset-2 hover:underline">all bills, filter &amp; edit →</Link>
          </div>
          <BillForm vendors={vendors.map((v) => v.name)} />
          <div className="mt-3 flex flex-col gap-2">
            {bills.map((b) => {
              const late = b.paid < b.amount && (b.dueOn ?? b.billDate) < today;
              return (
              <div key={b.id} className={`rounded-2xl bg-surface p-3 text-sm ${b.paid < b.amount ? (late ? "border border-error" : "border border-acid") : ""}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/accounts/vendors/${b.vendorId}`} className="font-semibold underline-offset-2 hover:underline">{b.vendor}</Link>
                  {b.billNumber && <span className="text-muted">#{b.billNumber}</span>}
                  <span className="text-muted">{d(b.billDate)}</span>
                  {b.filePath ? (
                    <a href={`/files/${b.filePath}`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-hill underline-offset-2 hover:underline">invoice</a>
                  ) : (
                    <span className="text-xs text-muted">no invoice</span>
                  )}
                  <span className="ml-auto font-bold">{formatINR(b.amount)}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  {b.gst > 0 && <span>incl. GST {formatINR(b.gst)}</span>}
                  {b.paid >= b.amount ? (
                    <span className="font-semibold text-success">Paid</span>
                  ) : (
                    <span className={`font-semibold ${late ? "text-error" : ""}`}>
                      {late ? "Overdue" : "Due"} {formatINR(b.amount - b.paid)}{b.dueOn ? ` by ${d(b.dueOn)}` : ""}
                      {b.paid > 0 && ` · ${formatINR(b.paid)} paid so far`}
                    </span>
                  )}
                  {b.paid < b.amount && <PayBill billId={b.id} dueInr={(b.amount - b.paid) / 100} />}
                </div>
              </div>
              );
            })}
            {bills.length === 0 && <p className="rounded-2xl bg-surface p-4 text-center text-sm text-muted">No vendor bills yet.</p>}
          </div>
        </section>
        <section>
          <div className="mb-2 flex items-baseline gap-3">
            <h2 className="font-display text-[18px] uppercase">Expenses</h2>
            <Link href="/admin/accounts/expenses" className="text-xs font-semibold text-hill underline-offset-2 hover:underline">week by week, filter &amp; edit →</Link>
          </div>
          <ExpenseForm categories={categories} vendors={vendors.map((v) => v.name)} />
          <div className="mt-3 overflow-hidden rounded-2xl bg-surface text-sm">
            {expenses.map((e) => (
              <div key={e.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0">
                <span className="w-14 flex-none text-muted">{d(e.spentOn)}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{e.description}</span>{" "}
                  <span className="text-xs text-muted">
                    · {e.category}
                    {e.vendor && e.vendorId && (
                      <>
                        {" · "}
                        <Link href={`/admin/accounts/vendors/${e.vendorId}`} className="underline-offset-2 hover:underline">{e.vendor}</Link>
                      </>
                    )}
                    {e.mode ? ` · ${e.mode}` : ""}
                  </span>
                </span>
                {e.filePath && (
                  <a href={`/files/${e.filePath}`} target="_blank" rel="noreferrer" className="flex-none text-xs font-semibold text-hill underline-offset-2 hover:underline">slip</a>
                )}
                <span className="font-bold">{formatINR(e.amount)}</span>
              </div>
            ))}
            {expenses.length === 0 && <p className="p-4 text-center text-muted">No expenses this month.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone = "" }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className={`rounded-xl bg-surface px-3 py-2 ${tone === "bad" ? "ring-1 ring-error" : tone === "warn" ? "ring-1 ring-acid" : ""}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`font-display text-[20px] ${tone === "bad" ? "text-error" : tone === "good" ? "text-success" : ""}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  );
}
