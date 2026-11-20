import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { BillingForm, CreateStatement, MarkPaid, PartnerLink } from "@/components/admin/partner-controls";
import { requireRole } from "@/lib/auth";
import { partnerById, partnerOrders, partnerStatements } from "@/lib/partners/data";
import { PAID_FROM_LABEL, isPaidFrom } from "@/lib/admin/paid-from";
import { formatINR } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const day = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const when = (s: string) => new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default async function PartnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireRole(["owner", "manager"], `/admin/partners/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const p = await partnerById(id);
  if (!p) notFound();
  const [orders, statements] = await Promise.all([partnerOrders(id), partnerStatements(id)]);
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const orderLink = `${site}/?src=${p.slug}`;
  const qr = await QRCode.toDataURL(orderLink, { width: 640, margin: 2, color: { dark: "#141414", light: "#FFFFFF" } });
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/admin/partners" className="text-sm text-muted">← Partners</Link>
        <h1 className="mt-1 font-display text-[32px] uppercase leading-none">{p.name}</h1>
        <p className="mt-1 text-sm text-muted">{[p.contactPerson, p.phone, p.address].filter(Boolean).join(" · ") || "No contact details yet"}</p>
      </div>

      <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Orders" value={String(p.orders)} />
        <Stat label="Unbilled" value={formatINR(Number(p.unbilledPaise))} sub={`${p.unbilledOrders} orders`} />
        <Stat label="On statements, unpaid" value={formatINR(Number(p.outstandingPaise))} tone={p.overdue ? "alert" : ""} sub={p.overdue ? `${p.overdue} overdue` : undefined} />
        <Stat label="Billing" value={p.billing === "credit" ? "Credit" : "Guests pay"} sub={p.billing === "credit" ? `${p.creditDays} days to pay` : undefined} />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
          <h2 className="font-display text-[18px] uppercase">Ordering QR</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`QR for ${p.name}`} width={180} height={180} className="rounded-lg bg-white" />
          <code className="break-all text-xs text-hill">{orderLink}</code>
          <a href={qr} download={`qr-${p.slug}.png`} className="h-9 w-fit rounded-lg bg-paper px-3 text-xs font-semibold leading-9">Download QR</a>
        </section>
        <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
          <h2 className="font-display text-[18px] uppercase">Billing</h2>
          <BillingForm id={p.id} billing={p.billing} creditDays={p.creditDays} />
        </section>
        <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
          <h2 className="font-display text-[18px] uppercase">Partner&apos;s own page</h2>
          <p className="text-sm text-muted">Send this to {p.contactPerson ?? "the partner"}: their orders, statements and what they owe. Read-only; no login.</p>
          <PartnerLink url={`${site}/p/${p.viewToken}`} propertyId={p.id} />
        </section>
      </div>

      {p.billing === "credit" && (
        <section className="rounded-2xl bg-surface p-4">
          <h2 className="mb-2 font-display text-[18px] uppercase">New statement</h2>
          <CreateStatement propertyId={p.id} unbilledOrders={p.unbilledOrders} />
        </section>
      )}

      <section className="rounded-2xl bg-surface p-4">
        <h2 className="mb-2 font-display text-[18px] uppercase">Statements</h2>
        {statements.length === 0 ? (
          <p className="text-sm text-muted">No statements yet.</p>
        ) : (
          <ul className="flex flex-col">
            {statements.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line py-2.5 text-sm last:border-0">
                <Link href={`/admin/partners/statement/${s.id}`} className="font-bold underline-offset-2 hover:underline">{s.number}</Link>
                <span className="text-muted">{day(s.periodFrom)} – {day(s.periodTo)} · {s.orderCount} orders</span>
                <span className="font-semibold">{formatINR(Number(s.amountPaise))}</span>
                {s.paidOn ? (
                  <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-bold text-success">Paid {day(s.paidOn)}{isPaidFrom(s.paidFrom) ? ` · ${PAID_FROM_LABEL[s.paidFrom]}` : ""}</span>
                ) : (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${s.dueOn < today ? "bg-error text-reversed" : "bg-acid"}`}>Due {day(s.dueOn)}</span>
                )}
                <span className="ml-auto"><MarkPaid id={s.id} paid={!!s.paidOn} isOwner={staff.role === "owner"} /></span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-x-auto rounded-2xl bg-surface">
        <h2 className="px-4 pt-4 font-display text-[18px] uppercase">Orders from this partner</h2>
        <table className="mt-2 w-full min-w-[640px] text-sm tabular-nums">
          <thead className="text-left text-[11px] uppercase tracking-wide text-muted">
            <tr><th className="px-4 py-2">Order</th><th className="px-2 py-2">When</th><th className="px-2 py-2">Room · guest</th><th className="px-2 py-2">Items</th><th className="px-2 py-2">Statement</th><th className="px-4 py-2 text-right">Amount</th></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-line align-top">
                <td className="px-4 py-2 font-semibold">#{o.number}</td>
                <td className="whitespace-nowrap px-2 py-2 text-muted">{when(o.at)}</td>
                <td className="px-2 py-2">{[o.room, o.guest].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-2 py-2 text-muted">{o.items}</td>
                <td className="px-2 py-2">{o.statementNumber ?? (p.billing === "credit" ? <span className="text-muted">unbilled</span> : "—")}</td>
                <td className="px-4 py-2 text-right font-semibold">{formatINR(Number(o.totalPaise))}</td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">No orders from this partner yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value, sub, tone = "" }: { label: string; value: string; sub?: string; tone?: "" | "alert" }) {
  return (
    <div className={`rounded-xl px-3 py-2 ${tone === "alert" ? "bg-error/10" : "bg-surface"}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="font-display text-[22px] leading-tight">{value}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  );
}
