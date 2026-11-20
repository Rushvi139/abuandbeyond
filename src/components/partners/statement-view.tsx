import type { PartnerOrder, Statement } from "@/lib/partners/data";
import { PAID_FROM_LABEL, isPaidFrom } from "@/lib/admin/paid-from";
import { formatINR } from "@/lib/pricing";

const day = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const when = (s: string) => new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

/**
 * One statement, as the partner and the owner both see it: who, which days,
 * every order with its room and items, the total, when it's due and whether
 * it's paid. Plain enough to screenshot and send on WhatsApp.
 */
export function StatementView({ partner, statement, orders }: { partner: { name: string; address: string | null }; statement: Statement; orders: PartnerOrder[] }) {
  const overdue = !statement.paidOn && statement.dueOn < new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  return (
    <article className="rounded-2xl bg-surface p-5">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Statement {statement.number}</p>
          <h1 className="font-display text-[28px] uppercase leading-none">{partner.name}</h1>
          {partner.address && <p className="mt-1 text-sm text-muted">{partner.address}</p>}
          <p className="mt-2 text-sm">Orders from <b>{day(statement.periodFrom)}</b> to <b>{day(statement.periodTo)}</b></p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-muted">Amount</p>
          <p className="font-display text-[30px] leading-none tabular-nums">{formatINR(Number(statement.amountPaise))}</p>
          <p className="mt-2 text-sm">Issued {day(statement.issuedOn)}</p>
          {statement.paidOn ? (
            <p className="mt-1 inline-block rounded-full bg-success/15 px-2.5 py-0.5 text-[12px] font-bold text-success">
              Paid {day(statement.paidOn)}{isPaidFrom(statement.paidFrom) ? ` · ${PAID_FROM_LABEL[statement.paidFrom]}` : ""}
            </p>
          ) : (
            <p className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[12px] font-bold ${overdue ? "bg-error text-reversed" : "bg-acid"}`}>
              {overdue ? "Overdue · was due" : "Due"} {day(statement.dueOn)}
            </p>
          )}
        </div>
      </header>
      <div className="overflow-x-auto">
        <table className="mt-3 w-full min-w-[560px] text-sm tabular-nums">
          <thead className="text-left text-[11px] uppercase tracking-wide text-muted">
            <tr><th className="py-2">Order</th><th className="py-2">When</th><th className="py-2">Room · guest</th><th className="py-2">Items</th><th className="py-2 text-right">Amount</th></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-line align-top">
                <td className="py-2 font-semibold">#{o.number}</td>
                <td className="whitespace-nowrap py-2 text-muted">{when(o.at)}</td>
                <td className="py-2">{[o.room, o.guest].filter(Boolean).join(" · ") || "—"}</td>
                <td className="py-2 text-muted">{o.items ?? ""}</td>
                <td className="py-2 text-right font-semibold">{formatINR(Number(o.totalPaise))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-ink font-bold"><td className="py-2.5" colSpan={4}>{statement.orderCount} orders</td><td className="py-2.5 text-right">{formatINR(Number(statement.amountPaise))}</td></tr>
          </tfoot>
        </table>
      </div>
      {statement.note && <p className="mt-3 text-sm text-muted">Note: {statement.note}</p>}
      {statement.reference && <p className="mt-1 text-sm text-muted">Payment ref: {statement.reference}</p>}
      <p className="mt-4 text-[12px] text-muted">Abu & Beyond, The Global Kitchen · Mount Abu · 8628910887 | 9462612045</p>
    </article>
  );
}
