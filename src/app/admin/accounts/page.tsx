import Link from "next/link";
import { DateRangeBar } from "@/components/admin/date-range";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { nextDay, rangeLabel, readRange } from "@/lib/date-range";
import { formatINR } from "@/lib/pricing";
import { spendByHead, uncollected, vendorLedger } from "@/lib/admin/accounts-queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Accounts — Abu & Beyond" };

type Day = { day: string; orders: number; net: number; gst: number; expenses: number; bills: number; cash: number; upi: number };

const d = (s: string) => new Date(`${String(s).slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/**
 * The summary only: totals for the chosen dates, one line per day, and where
 * the money went. Entering and editing lives on the other tabs (Expenses,
 * Vendor bills), and each day's line opens that day's sales — so this page
 * stays the same size however long the kitchen runs.
 */
export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  await requireRole(["owner"], "/admin/accounts");
  const range = readRange(await searchParams, "month");
  const sql = db();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  const [days, ledger, spend, toCollect] = await Promise.all([
    sql<Day[]>`
      with sales as (
        select (paid_at at time zone 'Asia/Kolkata')::date as day, count(*)::int as orders,
          sum(subtotal_paise - discount_paise)::bigint as net, sum(gst_paise)::bigint as gst,
          sum(total_paise) filter (where payment_mode = 'on_delivery')::bigint as cash,
          sum(total_paise) filter (where payment_mode = 'online')::bigint as upi
        from orders where status not in ('pending_payment', 'payment_failed', 'cancelled') and not is_demo group by 1
      ),
      -- "bills" here means stock bought (Kitchen, Disposables), whether paid
      -- on the spot or on credit; "expenses" means running costs. How it was
      -- paid doesn't change which it is.
      spend as (
        select e.spent_on as day, e.amount_paise, coalesce(c.has_items, false) as stock
          from expenses e left join expense_categories c on c.id = e.category_id
        union all
        select b.bill_date, b.amount_paise, coalesce(c.has_items, true)
          from vendor_bills b left join expense_categories c on c.id = b.category_id
      ),
      ex as (select day, sum(amount_paise) filter (where not stock)::bigint as expenses from spend group by 1),
      bi as (select day, sum(amount_paise) filter (where stock)::bigint as bills from spend group by 1),
         alld as (select day from sales union select day from ex union select day from bi)
      select alld.day::text as day, coalesce(s.orders, 0) as orders, coalesce(s.net, 0) as net, coalesce(s.gst, 0) as gst,
        coalesce(ex.expenses, 0) as expenses, coalesce(bi.bills, 0) as bills, coalesce(s.cash, 0) as cash, coalesce(s.upi, 0) as upi
      from alld left join sales s on s.day = alld.day left join ex on ex.day = alld.day left join bi on bi.day = alld.day
      where alld.day >= ${range.from}::date and alld.day < ${nextDay(range.to)}::date
      order by alld.day desc`,
    vendorLedger(range.from, range.to),
    spendByHead(range.from, range.to),
    uncollected(),
  ]);
  const n = (x: unknown) => Number(x);
  const tot = days.reduce((a, x) => ({ net: a.net + n(x.net), gst: a.gst + n(x.gst), expenses: a.expenses + n(x.expenses), bills: a.bills + n(x.bills), orders: a.orders + x.orders, cash: a.cash + n(x.cash), upi: a.upi + n(x.upi) }), { net: 0, gst: 0, expenses: 0, bills: 0, orders: 0, cash: 0, upi: 0 });
  const left = tot.net - tot.bills - tot.expenses;
  const billPct = tot.net ? Math.round((tot.bills / tot.net) * 100) : null;
  const owed = ledger.reduce((s, v) => s + n(v.outstanding), 0);
  const overdue = ledger.filter((v) => v.oldestDue && v.oldestDue < today).length;
  const spendTotal = spend.reduce((s, x) => s + n(x.amount), 0);
  const q = `from=${range.from}&to=${range.to}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[32px] uppercase leading-none">Accounts</h1>
          <p className="mt-1 text-sm text-muted">Summary for {rangeLabel(range)}. Sales are before GST.</p>
        </div>
        <details className="relative">
          <summary className="h-10 cursor-pointer list-none rounded-xl border-[1.5px] border-ink px-3 text-sm font-semibold leading-10">Download Excel ▾</summary>
          <div className="absolute right-0 z-10 mt-1 flex w-44 flex-col rounded-xl border border-line bg-surface p-1 shadow-lg">
            {["ledger", "orders", "bills", "expenses", "vendors"].map((r) => (
              <a key={r} href={`/admin/export/${r}?${q}`} className="rounded-lg px-3 py-2 text-sm font-semibold capitalize hover:bg-paper">{r}</a>
            ))}
          </div>
        </details>
      </div>

      <DateRangeBar path="/admin/accounts" range={range} />

      <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Net sales" value={formatINR(tot.net)} sub={`${tot.orders} orders`} href={`/admin/accounts/sales?${q}`} />
        <Stat label="Purchases (stock)" value={formatINR(tot.bills)} sub={billPct !== null ? `${billPct}% of sales · ceiling 33%` : "Kitchen + Disposables"} tone={billPct !== null && billPct > 33 ? "bad" : ""} href={`/admin/accounts/vendors?${q}&status=all`} />
        <Stat label="Running costs" value={formatINR(tot.expenses)} sub="staff, rent, gas, marketing…" href={`/admin/accounts/expenses?${q}`} />
        <Stat label="Left over" value={formatINR(left)} sub="sales − purchases − running costs" tone={left < 0 ? "bad" : "good"} />
        <Stat label="Online (PayU)" value={formatINR(tot.upi)} />
        <Stat label="Pay on delivery" value={formatINR(tot.cash)} href={`/admin/accounts/cash?${q}`} />
        <Stat label="To collect now" value={formatINR(toCollect.amountPaise)} sub={toCollect.count ? `${toCollect.count} order${toCollect.count === 1 ? "" : "s"} not handed in` : "all in"} tone={toCollect.count ? "warn" : ""} href="/admin/accounts/cash" />
        <Stat label="Owed to vendors" value={formatINR(owed)} sub={owed ? (overdue ? `${overdue} overdue` : "none overdue") : "all settled"} tone={overdue ? "bad" : owed ? "warn" : ""} href="/admin/accounts/vendor-list" />
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <h2 className="mb-2 font-display text-[18px] uppercase">Day by day</h2>
          <div className="overflow-x-auto rounded-2xl bg-surface">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-muted">
                <tr><th className="px-4 py-2.5">Day</th><th className="px-2 py-2.5 text-right">Orders</th><th className="px-2 py-2.5 text-right">Sales</th><th className="px-2 py-2.5 text-right">Purchases</th><th className="px-2 py-2.5 text-right">Running</th><th className="px-4 py-2.5 text-right">Left over</th></tr>
              </thead>
              <tbody>
                {days.map((x) => {
                  const l = n(x.net) - n(x.bills) - n(x.expenses);
                  return (
                    <tr key={x.day} className="border-t border-line hover:bg-paper/60">
                      <td className="px-4 py-2 font-semibold"><Link href={`/admin/accounts/sales?from=${x.day}&to=${x.day}`} className="underline-offset-2 hover:underline">{d(x.day)}</Link></td>
                      <td className="px-2 py-2 text-right">{x.orders || "—"}</td>
                      <td className="px-2 py-2 text-right">{n(x.net) ? formatINR(n(x.net)) : "—"}</td>
                      <td className="px-2 py-2 text-right">{n(x.bills) ? formatINR(n(x.bills)) : "—"}</td>
                      <td className="px-2 py-2 text-right">{n(x.expenses) ? formatINR(n(x.expenses)) : "—"}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${l < 0 ? "text-error" : ""}`}>{formatINR(l)}</td>
                    </tr>
                  );
                })}
                {days.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">Nothing in these dates.</td></tr>}
              </tbody>
              {days.length > 1 && (
                <tfoot><tr className="border-t-2 border-ink font-bold"><td className="px-4 py-2.5">Total</td><td className="px-2 py-2.5 text-right">{tot.orders}</td><td className="px-2 py-2.5 text-right">{formatINR(tot.net)}</td><td className="px-2 py-2.5 text-right">{formatINR(tot.bills)}</td><td className="px-2 py-2.5 text-right">{formatINR(tot.expenses)}</td><td className="px-4 py-2.5 text-right">{formatINR(left)}</td></tr></tfoot>
              )}
            </table>
          </div>
          <p className="mt-1.5 text-[11px] text-muted">Tap a day to see every order, expense and bill for it.</p>
        </section>

        <section className="lg:col-span-2">
          <h2 className="mb-2 font-display text-[18px] uppercase">Where it went</h2>
          <div className="flex flex-col gap-2 rounded-2xl bg-surface p-4">
            {spend.slice(0, 12).map((s) => {
              const pct = spendTotal ? (n(s.amount) / spendTotal) * 100 : 0;
              return (
                <div key={`${s.kind}-${s.label}`}>
                  <div className="flex items-baseline gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{s.label}</span>
                    <span className="font-semibold">{formatINR(n(s.amount))}</span>
                    <span className="w-9 text-right text-[11px] text-muted">{pct < 1 ? "<1" : pct.toFixed(0)}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper"><div className={`h-full rounded-full ${s.kind === "stock" ? "bg-clay" : "bg-hill"}`} style={{ width: `${Math.max(pct, 1.5)}%` }} /></div>
                </div>
              );
            })}
            {spend.length === 0 && <p className="py-4 text-center text-sm text-muted">Nothing spent in these dates.</p>}
            {spend.length > 0 && <p className="mt-1 border-t border-line pt-2 text-sm"><b>{formatINR(spendTotal)}</b> <span className="text-muted">out the door</span></p>}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone = "", href }: { label: string; value: string; sub?: string; tone?: string; href?: string }) {
  const body = (
    <>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`font-display text-[22px] leading-tight ${tone === "bad" ? "text-error" : tone === "good" ? "text-success" : ""}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </>
  );
  const cls = `block rounded-xl bg-surface px-3 py-2 ${tone === "bad" ? "ring-1 ring-error" : tone === "warn" ? "ring-1 ring-acid" : ""}`;
  return href ? <Link href={href} className={`${cls} hover:ring-1 hover:ring-ink`}>{body}</Link> : <div className={cls}>{body}</div>;
}
