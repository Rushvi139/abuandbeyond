import Link from "next/link";
import { OrderCard } from "@/components/admin/order-card";
import { CodToggle } from "@/components/admin/cod-toggle";
import { UpiSetting } from "@/components/admin/upi-setting";
import { PaymentLink } from "@/components/admin/payment-link";
import { StaffLive } from "@/components/admin/live";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentBusinessDay, dayClose } from "@/lib/admin/day-close";
import { getAbandonedOrders, getLiveOrders } from "@/lib/orders/queries";
import { LIVE } from "@/lib/orders/status";
import { formatINR } from "@/lib/pricing";
import { payuConfigured } from "@/lib/payments/payu";
import { getUpiId } from "@/lib/orders/override-actions";

export const dynamic = "force-dynamic";

/**
 * Today, and nothing else. The live orders, what's come in, what's gone out,
 * and one tap to the four things done most: take an order by hand, add an
 * expense, open the kitchen screen, close the day. History lives under
 * Orders; the books under Finance.
 *
 * "Today" is the business day (5 AM to 5 AM), so at 1 AM it is still the
 * evening's numbers, the same as Day Close.
 */
export default async function AdminHome() {
  const staff = await requireRole(["owner", "manager"], "/admin");
  const day = currentBusinessDay();
  const sql = db();
  const [live, riders, c, cod, dropped, upiId, expenses] = await Promise.all([
    getLiveOrders(LIVE),
    sql<{ id: string; name: string }[]>`select id, full_name as name from staff_users where role = 'rider' and active order by full_name`,
    dayClose(day),
    sql<{ value: boolean }[]>`select value::boolean from settings where key = 'cod_enabled'`,
    getAbandonedOrders(12),
    getUpiId(),
    sql<{ id: string; description: string; amount: number; category: string; mode: string | null }[]>`
      select e.id, e.description, e.amount_paise::bigint as amount, c.name as category, e.mode
      from expenses e join expense_categories c on c.id = e.category_id
      where e.spent_on = ${day}::date order by e.created_at desc limit 6`,
  ]);
  const isOwner = staff.role === "owner";
  const label = new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const fresh = live.filter((o) => o.status === "paid").length;

  return (
    <div className="flex flex-col gap-5">
      <StaffLive newCount={fresh} chime />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[32px] uppercase leading-none">Today</h1>
          <p className="mt-1 text-sm text-muted">{label}</p>
        </div>
        <nav className="flex flex-wrap gap-2" aria-label="Shortcuts">
          <Shortcut href="/admin/pos" primary>+ New order</Shortcut>
          <Shortcut href="/admin/expenses/new">+ Add spend</Shortcut>
          <Shortcut href="/kitchen">Kitchen screen</Shortcut>
          {isOwner && <Shortcut href="/admin/day-close">Close the day</Shortcut>}
        </nav>
      </div>

      <section className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Stat label="Live now" value={String(live.length)} sub={fresh ? `${fresh} new` : "all accepted"} tone={fresh ? "alert" : ""} />
        <Stat label="Orders" value={String(c.orders)} sub={`${c.itemsSold} items`} />
        <Stat label="Sales" value={formatINR(c.netPaise)} sub="before GST" />
        <Stat
          label="Cash to collect"
          value={formatINR(c.cashUncollectedPaise)}
          sub="pay-on-delivery not in hand"
          tone={c.cashUncollectedPaise ? "warn" : ""}
          href="/admin/accounts/cash"
        />
        <Stat label="Spent today" value={formatINR(c.spentPaise.expenses + c.spentPaise.bills)} sub="expenses + bills" href="/admin/accounts/expenses" />
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-display text-[22px] uppercase">Live orders</h2>
          <Link href="/admin/orders" className="text-sm font-semibold underline-offset-2 hover:underline">All orders →</Link>
        </div>
        {live.length === 0 ? (
          <p className="rounded-2xl bg-surface p-6 text-center text-muted">No live orders. New ones appear here the moment they&apos;re paid.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {live.map((o) => <OrderCard key={o.id} order={o} riders={riders} role={staff.role} />)}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-surface p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-display text-[18px] uppercase">Spent today</h2>
            <Link href="/admin/expenses/new" className="text-sm font-semibold underline-offset-2 hover:underline">+ Add</Link>
          </div>
          {expenses.length === 0 ? (
            <p className="text-sm text-muted">Nothing recorded yet today.</p>
          ) : (
            <ul className="flex flex-col">
              {expenses.map((e) => (
                <li key={e.id} className="flex items-baseline justify-between gap-3 border-b border-line py-1.5 text-sm last:border-0">
                  <span className="min-w-0 truncate">
                    {e.description} <span className="text-[12px] text-muted">· {e.category}{e.mode ? ` · ${e.mode}` : ""}</span>
                  </span>
                  <span className="flex-none font-semibold">{formatINR(Number(e.amount))}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-surface p-4">
          <h2 className="mb-2 font-display text-[18px] uppercase">Running low</h2>
          {c.lowStock.length === 0 ? (
            <p className="text-sm text-muted">Nothing at or below its reorder level.</p>
          ) : (
            <ul className="flex flex-col">
              {c.lowStock.slice(0, 6).map((s) => (
                <li key={s.name} className="flex justify-between gap-3 border-b border-line py-1.5 text-sm last:border-0">
                  <span>{s.name}</span>
                  <span className="font-semibold text-error">{s.onHand.toLocaleString("en-IN")} {s.unit}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/stock" className="mt-2 inline-block text-sm font-semibold underline-offset-2 hover:underline">Inventory →</Link>
        </section>
      </div>

      {dropped.length > 0 && (
        <section className="rounded-2xl border-[1.5px] border-dashed border-clay p-4">
          <h2 className="font-display text-[18px] uppercase">Didn&apos;t finish paying</h2>
          <p className="mt-1 text-sm text-muted">Reached the payment page in the last 12 hours and stopped. The link reopens their own order.</p>
          <ul className="mt-3 flex flex-col gap-2">
            {dropped.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface px-3 py-2 text-sm">
                <span className="font-display text-[18px]">#{o.number}</span>
                <span className="font-medium">{o.customer.name ?? "Guest"}</span>
                <a href={`tel:${o.customer.phone}`} className="text-muted underline-offset-2 hover:underline">{o.customer.phone}</a>
                <span className="ml-auto flex items-center gap-2">
                  <span className="font-semibold">{formatINR(o.totalPaise)}</span>
                  <PaymentLink code={o.code} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Settings changed once in a while, not every night — kept out of the way. */}
      <details className="rounded-2xl bg-surface p-4 text-sm">
        <summary className="cursor-pointer font-semibold">Payment settings</summary>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <CodToggle on={cod[0]?.value === true} locked={!payuConfigured()} />
          <UpiSetting current={upiId} />
        </div>
      </details>
    </div>
  );
}

function Shortcut({ href, children, primary = false }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={`h-11 rounded-xl px-4 text-sm font-bold leading-[2.75rem] ${primary ? "bg-clay text-ink" : "border-[1.5px] border-ink"}`}
    >
      {children}
    </Link>
  );
}

function Stat({ label, value, sub, tone = "", href }: { label: string; value: string; sub?: string; tone?: "" | "warn" | "alert"; href?: string }) {
  const body = (
    <>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="font-display text-[22px] leading-tight">{value}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </>
  );
  const cls = `block rounded-xl px-3 py-2 ${tone === "alert" ? "bg-acid" : tone === "warn" ? "bg-acid/40" : "bg-surface"}`;
  return href ? <Link href={href} className={`${cls} hover:ring-1 hover:ring-ink`}>{body}</Link> : <div className={cls}>{body}</div>;
}
