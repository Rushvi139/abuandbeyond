import Link from "next/link";
import { CollectButton } from "@/components/admin/collect-button";
import { DateRangeBar } from "@/components/admin/date-range";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { nextDay, readRange } from "@/lib/date-range";
import { formatINR } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cash book — Abu & Beyond" };

type Entry = {
  orderId: string;
  number: number;
  at: string;
  amount: number;
  method: string;
  by: string | null;
  guest: string | null;
  source: string;
  where: string | null;
};

type Open = { id: string; number: number; amount: number; status: string; createdAt: string; guest: string | null; rider: string | null; where: string | null };

const t = (s: string) => new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const SOURCE: Record<string, string> = { web: "Website", manual: "Counter / phone", whatsapp: "WhatsApp", reorder: "Reorder" };

/**
 * Every rupee taken by hand, order by order: pay-on-delivery collected by a
 * rider, and counter orders paid in cash or UPI. Who took it, when, how. The
 * totals per person are what each of them should be holding (or have sent by
 * UPI) at the end of the night.
 *
 * Above it, the orders where money is still out: pay-on-delivery that hasn't
 * been marked collected. A delivered order on that list is food handed over
 * with nothing recorded — chase it the same night.
 */
export default async function CashBookPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string; by?: string; method?: string }> }) {
  await requireRole(["owner", "manager"], "/admin/accounts/cash");
  const sp = await searchParams;
  const range = readRange(sp, "today");
  const by = sp.by?.trim() || "";
  const method = sp.method === "cash" || sp.method === "upi" ? sp.method : "";
  const sql = db();

  const [entries, open, people] = await Promise.all([
    sql<Entry[]>`
      select o.id as "orderId", o.order_number as number, o.collected_at as at, p.amount_paise::bigint as amount,
        coalesce(p.method, 'cash') as method, u.full_name as by, c.name as guest, o.source,
        nullif(concat_ws(', ', o.property_name, o.room_or_landmark), '') as where
      from orders o
      join payments p on p.order_id = o.id and p.gateway = 'on_delivery'
      join customers c on c.id = o.customer_id
      left join staff_users u on u.id = o.collected_by
      where o.collected_at is not null and not o.is_demo
        and (o.collected_at at time zone 'Asia/Kolkata') >= ${range.from}::date
        and (o.collected_at at time zone 'Asia/Kolkata') < ${nextDay(range.to)}::date
        and (${by} = '' or u.id::text = ${by})
        and (${method} = '' or p.method = ${method})
      order by o.collected_at desc`,
    sql<Open[]>`
      select o.id, o.order_number as number, o.total_paise::bigint as amount, o.status, o.created_at as "createdAt",
        c.name as guest, r.full_name as rider, nullif(concat_ws(', ', o.property_name, o.room_or_landmark), '') as where
      from orders o join customers c on c.id = o.customer_id left join staff_users r on r.id = o.rider_id
      where o.payment_mode = 'on_delivery' and o.collected_at is null and not o.is_demo
        and o.status not in ('pending_payment', 'payment_failed', 'cancelled')
      order by (o.status = 'delivered') desc, o.created_at`,
    sql<{ id: string; name: string }[]>`select id, full_name as name from staff_users where active order by full_name`,
  ]);

  const total = entries.reduce((n, e) => n + Number(e.amount), 0);
  const cash = entries.filter((e) => e.method === "cash").reduce((n, e) => n + Number(e.amount), 0);
  const upi = total - cash;
  const perPerson = [...entries.reduce((m, e) => {
    const k = e.by ?? "Unknown";
    const v = m.get(k) ?? { cash: 0, upi: 0, n: 0 };
    if (e.method === "cash") v.cash += Number(e.amount);
    else v.upi += Number(e.amount);
    v.n += 1;
    return m.set(k, v);
  }, new Map<string, { cash: number; upi: number; n: number }>())].sort((a, b) => b[1].cash - a[1].cash);
  const handedOut = open.filter((o) => o.status === "delivered");
  const keep = { by, method };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-[32px] uppercase leading-none">Cash book</h1>
        <p className="mt-1 text-sm text-muted">Every payment taken by hand — riders at the door and the counter — order by order.</p>
      </div>

      {open.length > 0 && (
        <section className={`rounded-2xl p-4 ${handedOut.length ? "border-2 border-error bg-error/5" : "bg-acid/25"}`}>
          <h2 className="font-display text-[18px] uppercase">Still to collect · {formatINR(open.reduce((n, o) => n + Number(o.amount), 0))}</h2>
          <p className="mb-2 text-sm text-muted">
            {handedOut.length
              ? `${handedOut.length} delivered with no payment marked — check with the rider tonight.`
              : "Pay-on-delivery orders on their way. They leave this list when the rider marks them collected."}
          </p>
          <ul className="flex flex-col gap-1.5">
            {open.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-surface px-3 py-2 text-sm">
                <span className="font-display text-[18px]">#{o.number}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${o.status === "delivered" ? "bg-error text-reversed" : "bg-line"}`}>{o.status === "paid" ? "new" : o.status.replace(/_/g, " ")}</span>
                <span>{o.guest ?? "Guest"}</span>
                <span className="text-muted">{o.where ?? ""}</span>
                <span className="text-muted">{t(o.createdAt)}{o.rider ? ` · ${o.rider}` : ""}</span>
                <span className="ml-auto flex items-center gap-2">
                  <CollectButton orderId={o.id} amountPaise={Number(o.amount)} collected={false} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <DateRangeBar path="/admin/accounts/cash" range={range} keep={keep} />
      <form action="/admin/accounts/cash" className="flex flex-wrap items-center gap-2 text-sm">
        <input type="hidden" name="from" value={range.from} />
        <input type="hidden" name="to" value={range.to} />
        <select name="by" defaultValue={by} className="h-9 rounded-lg border border-line bg-paper px-2">
          <option value="">Everyone</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select name="method" defaultValue={method} className="h-9 rounded-lg border border-line bg-paper px-2">
          <option value="">Cash and UPI</option>
          <option value="cash">Cash only</option>
          <option value="upi">UPI only</option>
        </select>
        <button className="h-9 rounded-lg bg-ink px-3 font-semibold text-reversed">Filter</button>
        {(by || method) && <Link href={`/admin/accounts/cash?from=${range.from}&to=${range.to}`} className="text-muted underline-offset-2 hover:underline">Clear</Link>}
      </form>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Cash" value={formatINR(cash)} />
        <Stat label="UPI" value={formatINR(upi)} />
        <Stat label="Total collected" value={formatINR(total)} />
        <Stat label="Orders" value={String(entries.length)} />
      </section>

      {perPerson.length > 0 && (
        <section className="rounded-2xl bg-surface p-4">
          <h2 className="mb-2 font-display text-[18px] uppercase">Who holds what</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide text-muted">
              <tr><th className="py-1">Collected by</th><th className="py-1 text-right">Orders</th><th className="py-1 text-right">Cash in hand</th><th className="py-1 text-right">UPI</th></tr>
            </thead>
            <tbody>
              {perPerson.map(([name, v]) => (
                <tr key={name} className="border-t border-line">
                  <td className="py-1.5 font-semibold">{name}</td>
                  <td className="py-1.5 text-right">{v.n}</td>
                  <td className="py-1.5 text-right font-bold">{formatINR(v.cash)}</td>
                  <td className="py-1.5 text-right">{formatINR(v.upi)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="overflow-x-auto rounded-2xl bg-surface">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5">When</th><th className="px-2 py-2.5">Order</th><th className="px-2 py-2.5">Guest</th>
              <th className="px-2 py-2.5">From</th><th className="px-2 py-2.5">Method</th><th className="px-2 py-2.5">Taken by</th>
              <th className="px-4 py-2.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.orderId} className="border-t border-line">
                <td className="whitespace-nowrap px-4 py-2 text-muted">{t(e.at)}</td>
                <td className="px-2 py-2 font-semibold">#{e.number}</td>
                <td className="px-2 py-2">{e.guest ?? "—"}<span className="block text-[11px] text-muted">{e.where ?? ""}</span></td>
                <td className="px-2 py-2 text-muted">{SOURCE[e.source] ?? e.source}</td>
                <td className="px-2 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${e.method === "cash" ? "bg-acid text-ink" : "bg-hill text-reversed"}`}>{e.method}</span>
                </td>
                <td className="px-2 py-2">{e.by ?? "—"}</td>
                <td className="px-4 py-2 text-right font-semibold">{formatINR(Number(e.amount))}</td>
              </tr>
            ))}
            {entries.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">Nothing collected by hand in this range.</td></tr>}
          </tbody>
          {entries.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-ink font-bold"><td className="px-4 py-2.5" colSpan={6}>{entries.length} entries</td><td className="px-4 py-2.5 text-right">{formatINR(total)}</td></tr>
            </tfoot>
          )}
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="font-display text-[22px]">{value}</div>
    </div>
  );
}
