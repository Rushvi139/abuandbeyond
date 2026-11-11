import Link from "next/link";
import { OrderCard } from "@/components/admin/order-card";
import { CodToggle } from "@/components/admin/cod-toggle";
import { PaymentLink } from "@/components/admin/payment-link";
import { StaffLive } from "@/components/admin/live";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAbandonedOrders, getLiveOrders, getRecentOrders } from "@/lib/orders/queries";
import { LIVE } from "@/lib/orders/status";
import { formatINR } from "@/lib/pricing";
import { cashfreeConfigured } from "@/lib/payments/cashfree";

export const dynamic = "force-dynamic";

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const staff = await requireRole(["owner", "manager"], "/admin");
  const { q } = await searchParams;
  const [live, recent, riders, today, cod, dropped] = await Promise.all([
    getLiveOrders(LIVE),
    getRecentOrders(30, q),
    db()<{ id: string; name: string }[]>`select id, full_name as name from staff_users where role = 'rider' and active order by full_name`,
    db()<{ orders: number; net: number; gross: number }[]>`select count(*)::int as orders, coalesce(sum(subtotal_paise - discount_paise), 0)::bigint as net, coalesce(sum(total_paise), 0)::bigint as gross
      from orders where status not in ('pending_payment','payment_failed','cancelled') and not is_demo and (paid_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date`,
    db()<{ value: boolean }[]>`select value::boolean from settings where key = 'cod_enabled'`,
    getAbandonedOrders(),
  ]);
  const t = today[0];

  return (
    <div className="flex flex-col gap-5">
      <StaffLive newCount={live.filter((o) => o.status === "paid").length} chime />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-[32px] uppercase">Orders</h1>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <CodToggle on={cod[0]?.value === true} locked={!cashfreeConfigured()} />
          <Stat label="Today" value={String(t?.orders ?? 0)} />
          <Stat label="Net sales" value={formatINR(Number(t?.net ?? 0))} />
          <Stat label="Live" value={String(live.length)} />
        </div>
      </div>

      {live.length === 0 ? (
        <p className="rounded-2xl bg-surface p-6 text-center text-muted">No live orders. New ones appear here the moment they&apos;re paid.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {live.map((o) => <OrderCard key={o.id} order={o} riders={riders} role={staff.role} />)}
        </div>
      )}

      {dropped.length > 0 && (
        <section className="rounded-2xl border-[1.5px] border-dashed border-clay p-4">
          <h2 className="font-display text-[22px] uppercase">Didn&apos;t finish paying</h2>
          <p className="mt-1 text-sm text-muted">
            These got as far as the payment page in the last two days. The link below reopens their own order, so they
            don&apos;t have to build the basket again.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {dropped.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface px-3 py-2 text-sm">
                <span className="font-display text-[20px]">#{o.number}</span>
                <span className="font-medium">{o.customer.name ?? "Guest"}</span>
                <a href={`tel:${o.customer.phone}`} className="text-muted underline-offset-2 hover:underline">{o.customer.phone}</a>
                <span className="text-muted">{[o.propertyName, o.roomOrLandmark].filter(Boolean).join(", ") || o.stayType}</span>
                <span className="text-muted">
                  {new Date(o.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                </span>
                <span className="ml-auto flex items-center gap-2">
                  <span className="font-semibold">{formatINR(o.totalPaise)}</span>
                  <PaymentLink code={o.code} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-[22px] uppercase">History</h2>
          <form className="flex gap-2">
            <input name="q" defaultValue={q} placeholder="Phone, name or order no." className="h-10 w-64 rounded-xl border border-line bg-surface px-3 text-sm" />
            <button className="h-10 rounded-xl bg-ink px-4 text-sm font-semibold text-reversed">Search</button>
            <Link href="/admin/export/orders" className="h-10 rounded-xl border border-ink px-3 text-sm font-semibold leading-10">Export CSV</Link>
          </form>
        </div>
        <div className="mt-3 overflow-x-auto rounded-2xl bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr><th className="px-4 py-3">#</th><th className="px-4 py-3">When</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Where</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Total</th></tr>
            </thead>
            <tbody>
              {recent.map((o) => (
                <tr key={o.id} className="border-t border-line">
                  <td className="px-4 py-2.5 font-semibold">{o.number}</td>
                  <td className="px-4 py-2.5 text-muted">{new Date(o.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}</td>
                  <td className="px-4 py-2.5"><a href={`/admin/customers/${o.customer.id}`} className="font-medium underline-offset-2 hover:underline">{o.customer.name ?? o.customer.phone}</a></td>
                  <td className="px-4 py-2.5 text-muted">{[o.propertyName, o.roomOrLandmark].filter(Boolean).join(", ") || o.stayType}</td>
                  <td className="px-4 py-2.5">
                    <span className="flex flex-wrap items-center gap-2">
                      {o.status.replace(/_/g, " ")}
                      {/* The one row an owner can act on: the guest got as far
                          as the payment page and stopped. Hand them the link
                          back rather than writing the order off. */}
                      {o.status === "pending_payment" && o.paymentSessionId && !o.isDemo && <PaymentLink code={o.code} />}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold">{formatINR(o.totalPaise)}</td>
                </tr>
              ))}
              {recent.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">Nothing yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="font-display text-[20px]">{value}</div>
    </div>
  );
}
