import Link from "next/link";
import { DateRangeBar } from "@/components/admin/date-range";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { nextDay, rangeLabel, readRange } from "@/lib/date-range";
import { PAYMENT_TONE, paymentState } from "@/lib/orders/payment-state";
import { formatINR } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sales — Abu & Beyond" };

const PAGE = 100;
type Row = { id: string; number: number; paidAt: string; status: string; paymentMode: "online" | "on_delivery"; collectedAt: string | null; collectMethod: string | null; refundedPaise: number; totalPaise: number; net: number; source: string; guest: string | null; customerId: string; items: string | null; where: string | null };
const t = (s: string) => new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const SOURCE: Record<string, string> = { web: "Website", manual: "Counter", whatsapp: "WhatsApp", reorder: "Reorder" };

/**
 * Every order in the chosen dates, with what was paid and how — and, for a
 * single day, that day's expenses and vendor bills underneath, so one day can
 * be read top to bottom. Paged, so it never grows past a screenful.
 */
export default async function SalesPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string; page?: string; pay?: string }> }) {
  await requireRole(["owner"], "/admin/accounts/sales");
  const sp = await searchParams;
  const range = readRange(sp, "today");
  const page = Math.max(1, Number(sp.page) || 1);
  const pay = ["online", "on_delivery"].includes(sp.pay ?? "") ? sp.pay! : "";
  const sql = db();
  const where = sql`o.status not in ('pending_payment', 'payment_failed') and not o.is_demo
    and (coalesce(o.paid_at, o.created_at) at time zone 'Asia/Kolkata') >= ${range.from}::date
    and (coalesce(o.paid_at, o.created_at) at time zone 'Asia/Kolkata') < ${nextDay(range.to)}::date
    and (${pay} = '' or o.payment_mode = ${pay})`;
  const oneDay = range.from === range.to;

  const [rows, [tot], expenses, bills] = await Promise.all([
    sql<Row[]>`
      select o.id, o.order_number as number, coalesce(o.paid_at, o.created_at) as "paidAt", o.status, o.payment_mode as "paymentMode",
        o.collected_at as "collectedAt", o.total_paise::bigint as "totalPaise", (o.subtotal_paise - o.discount_paise)::bigint as net, o.source,
        coalesce((select p.method from payments p where p.order_id = o.id and p.gateway = 'on_delivery' limit 1), case when o.comp_reason is not null then 'complimentary' end) as "collectMethod",
        coalesce((select sum(p.refunded_paise) from payments p where p.order_id = o.id), 0)::bigint as "refundedPaise",
        c.name as guest, c.id as "customerId", nullif(concat_ws(', ', o.property_name, o.room_or_landmark), '') as where,
        (select string_agg(oi.quantity || '× ' || oi.name_snapshot, ', ') from order_items oi where oi.order_id = o.id) as items
      from orders o join customers c on c.id = o.customer_id where ${where}
      order by coalesce(o.paid_at, o.created_at) desc limit ${PAGE} offset ${(page - 1) * PAGE}`,
    sql<{ n: number; net: number; gross: number; cancelled: number }[]>`
      select count(*) filter (where o.status <> 'cancelled')::int as n,
        coalesce(sum(o.subtotal_paise - o.discount_paise) filter (where o.status <> 'cancelled'), 0)::bigint as net,
        coalesce(sum(o.total_paise) filter (where o.status <> 'cancelled'), 0)::bigint as gross,
        count(*) filter (where o.status = 'cancelled')::int as cancelled
      from orders o where ${where}`,
    oneDay ? sql<{ id: string; description: string; category: string; amount: number; mode: string | null }[]>`
      select e.id, e.description, c.name as category, e.amount_paise::bigint as amount, e.mode from expenses e join expense_categories c on c.id = e.category_id
      where e.spent_on = ${range.from}::date order by e.created_at` : Promise.resolve([]),
    oneDay ? sql<{ id: string; vendor: string; vendorId: string; billNumber: string | null; amount: number }[]>`
      select b.id, v.name as vendor, v.id as "vendorId", b.bill_number as "billNumber", b.amount_paise::bigint as amount from vendor_bills b join vendors v on v.id = b.vendor_id
      where b.bill_date = ${range.from}::date order by b.created_at` : Promise.resolve([]),
  ]);
  const total = tot.n + tot.cancelled;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const base = `from=${range.from}&to=${range.to}${pay ? `&pay=${pay}` : ""}`;
  const exp = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const bil = bills.reduce((s, b) => s + Number(b.amount), 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-[32px] uppercase leading-none">Sales</h1>
        <p className="mt-1 text-sm text-muted">Orders for {rangeLabel(range)}.</p>
      </div>
      <DateRangeBar path="/admin/accounts/sales" range={range} keep={{ pay }} />
      <div className="flex flex-wrap gap-1 text-[13px]">
        {[["", "All"], ["online", "Online"], ["on_delivery", "Pay on delivery / counter"]].map(([k, l]) => (
          <Link key={k} href={`/admin/accounts/sales?from=${range.from}&to=${range.to}${k ? `&pay=${k}` : ""}`} className={`h-8 rounded-lg px-2.5 font-semibold leading-8 ${pay === k ? "bg-ink text-reversed" : "bg-surface"}`}>{l}</Link>
        ))}
      </div>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Orders" value={String(tot.n)} sub={tot.cancelled ? `${tot.cancelled} cancelled` : ""} />
        <Stat label="Net sales" value={formatINR(Number(tot.net))} />
        <Stat label="Paid by guests" value={formatINR(Number(tot.gross))} sub="incl. GST and delivery" />
        <Stat label="Average order" value={formatINR(tot.n ? Math.round(Number(tot.net) / tot.n) : 0)} />
      </section>

      <section className="overflow-x-auto rounded-2xl bg-surface">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wide text-muted">
            <tr><th className="px-4 py-2.5">Order</th><th className="px-2 py-2.5">When</th><th className="px-2 py-2.5">Guest</th><th className="px-2 py-2.5">Items</th><th className="px-2 py-2.5">From</th><th className="px-2 py-2.5">Payment</th><th className="px-4 py-2.5 text-right">Total</th></tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const p = paymentState({ ...o, totalPaise: Number(o.totalPaise), refundedPaise: Number(o.refundedPaise) });
              return (
                <tr key={o.id} className={`border-t border-line ${o.status === "cancelled" ? "text-muted line-through decoration-line" : ""}`}>
                  <td className="px-4 py-2 font-semibold">#{o.number}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-muted">{t(o.paidAt)}</td>
                  <td className="px-2 py-2"><Link href={`/admin/customers/${o.customerId}`} className="underline-offset-2 hover:underline">{o.guest ?? "Guest"}</Link><span className="block text-[11px] text-muted">{o.where ?? ""}</span></td>
                  <td className="max-w-[260px] truncate px-2 py-2 text-[12px] text-muted" title={o.items ?? ""}>{o.items}</td>
                  <td className="px-2 py-2 text-muted">{SOURCE[o.source] ?? o.source}</td>
                  <td className="px-2 py-2 no-underline"><span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${PAYMENT_TONE[p.kind]}`}>{p.label}</span></td>
                  <td className="px-4 py-2 text-right font-semibold">{formatINR(Number(o.totalPaise))}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">No orders in these dates.</td></tr>}
          </tbody>
        </table>
      </section>
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Page {page} of {pages} · {total} orders</span>
          <span className="flex gap-2">
            {page > 1 && <Link href={`/admin/accounts/sales?${base}&page=${page - 1}`} className="h-9 rounded-lg border border-ink px-3 font-semibold leading-9">← Newer</Link>}
            {page < pages && <Link href={`/admin/accounts/sales?${base}&page=${page + 1}`} className="h-9 rounded-lg border border-ink px-3 font-semibold leading-9">Older →</Link>}
          </span>
        </div>
      )}

      {oneDay && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl bg-surface p-4">
            <div className="mb-2 flex items-baseline justify-between"><h2 className="font-display text-[18px] uppercase">Expenses that day · {formatINR(exp)}</h2><Link href={`/admin/accounts/expenses?from=${range.from}&to=${range.to}`} className="text-sm font-semibold underline-offset-2 hover:underline">Edit →</Link></div>
            {expenses.length === 0 ? <p className="text-sm text-muted">None recorded.</p> : expenses.map((e) => (
              <div key={e.id} className="flex justify-between gap-3 border-b border-line py-1.5 text-sm last:border-0"><span className="min-w-0 truncate">{e.description} <span className="text-[12px] text-muted">· {e.category}{e.mode ? ` · ${e.mode}` : ""}</span></span><b>{formatINR(Number(e.amount))}</b></div>
            ))}
          </section>
          <section className="rounded-2xl bg-surface p-4">
            <div className="mb-2 flex items-baseline justify-between"><h2 className="font-display text-[18px] uppercase">Vendor bills that day · {formatINR(bil)}</h2><Link href={`/admin/accounts/vendors?from=${range.from}&to=${range.to}&status=all`} className="text-sm font-semibold underline-offset-2 hover:underline">Edit →</Link></div>
            {bills.length === 0 ? <p className="text-sm text-muted">None dated this day.</p> : bills.map((b) => (
              <div key={b.id} className="flex justify-between gap-3 border-b border-line py-1.5 text-sm last:border-0"><Link href={`/admin/accounts/vendors/${b.vendorId}`} className="underline-offset-2 hover:underline">{b.vendor}{b.billNumber ? ` #${b.billNumber}` : ""}</Link><b>{formatINR(Number(b.amount))}</b></div>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (<div className="rounded-xl bg-surface px-3 py-2"><div className="text-[11px] uppercase tracking-wide text-muted">{label}</div><div className="font-display text-[22px] leading-tight">{value}</div>{sub && <div className="text-[11px] text-muted">{sub}</div>}</div>);
}
