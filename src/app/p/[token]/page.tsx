import Image from "next/image";
import { LEGAL } from "@/lib/legal";
import Link from "next/link";
import { notFound } from "next/navigation";
import { partnerByToken, partnerOrders, partnerStatements } from "@/lib/partners/data";
import { formatINR } from "@/lib/pricing";

export const dynamic = "force-dynamic";
// A private page: kept out of search results and link previews.
export const metadata = { title: "Your account — Abu & Beyond", robots: { index: false, follow: false } };

const day = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const when = (s: string) => new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

/**
 * A partner's own view, behind an unguessable link: what their guests
 * ordered, which statements are out, what is owed. Read-only.
 */
export default async function PartnerView({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await partnerByToken(token);
  if (!p) notFound();
  const [orders, statements] = await Promise.all([partnerOrders(p.id, 150), partnerStatements(p.id)]);
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const owed = Number(p.outstandingPaise) + Number(p.unbilledPaise);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center gap-3">
        <Image src="/brand/patch-primary-tilted.png" alt="Abu & Beyond" width={84} height={63} />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Partner account</p>
          <h1 className="font-display text-[28px] uppercase leading-none">{p.name}</h1>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Box label="Owed in all" value={formatINR(owed)} />
        <Box label="On statements, unpaid" value={formatINR(Number(p.outstandingPaise))} alert={p.overdue > 0} sub={p.overdue ? `${p.overdue} overdue` : undefined} />
        <Box label="Not billed yet" value={formatINR(Number(p.unbilledPaise))} sub={`${p.unbilledOrders} orders`} />
      </section>
      {p.billing === "credit" && <p className="text-sm text-muted">Orders from your QR go on this account. We send a statement; please pay within {p.creditDays} days of it.</p>}

      <section className="rounded-2xl bg-surface p-4">
        <h2 className="mb-2 font-display text-[18px] uppercase">Statements</h2>
        {statements.length === 0 ? <p className="text-sm text-muted">No statements yet.</p> : (
          <ul className="flex flex-col">
            {statements.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-2.5 text-sm last:border-0">
                <Link href={`/p/${token}/s/${s.id}`} className="font-bold underline-offset-2 hover:underline">{s.number}</Link>
                <span className="text-muted">{day(s.periodFrom)} – {day(s.periodTo)} · {s.orderCount} orders</span>
                <span className="ml-auto font-semibold">{formatINR(Number(s.amountPaise))}</span>
                {s.paidOn ? (
                  <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-bold text-success">Paid {day(s.paidOn)}</span>
                ) : (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${s.dueOn < today ? "bg-error text-reversed" : "bg-acid"}`}>Due {day(s.dueOn)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-x-auto rounded-2xl bg-surface">
        <h2 className="px-4 pt-4 font-display text-[18px] uppercase">Orders</h2>
        <table className="mt-2 w-full min-w-[520px] text-sm tabular-nums">
          <thead className="text-left text-[11px] uppercase tracking-wide text-muted">
            <tr><th className="px-4 py-2">Order</th><th className="px-2 py-2">When</th><th className="px-2 py-2">Room · guest</th><th className="px-2 py-2">Items</th><th className="px-4 py-2 text-right">Amount</th></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-line align-top">
                <td className="px-4 py-2 font-semibold">#{o.number}</td>
                <td className="whitespace-nowrap px-2 py-2 text-muted">{when(o.at)}</td>
                <td className="px-2 py-2">{[o.room, o.guest].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-2 py-2 text-muted">{o.items}</td>
                <td className="px-4 py-2 text-right font-semibold">{formatINR(Number(o.totalPaise))}</td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">No orders yet.</td></tr>}
          </tbody>
        </table>
      </section>
      <p className="text-center text-[12px] text-muted">Questions about a bill? Call or WhatsApp {LEGAL.support.phoneDisplay}</p>
    </main>
  );
}

function Box({ label, value, sub, alert = false }: { label: string; value: string; sub?: string; alert?: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-2 ${alert ? "bg-error/10" : "bg-surface"}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="font-display text-[22px] leading-tight">{value}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  );
}
