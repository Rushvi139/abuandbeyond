import Link from "next/link";
import QRCode from "qrcode";
import { PropertyForm, PropertyToggle } from "@/components/admin/property-form";
import { requireRole } from "@/lib/auth";
import { listPartners } from "@/lib/partners/data";
import { formatINR } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partners — Abu & Beyond" };

/**
 * Hotels and businesses with their own QR link. A partner on credit has every
 * order from its link put on its account; you bill it with a statement every
 * 15–30 days. A partner on "guests pay" is only tracked.
 */
export default async function PartnersPage() {
  await requireRole(["owner", "manager"], "/admin/partners");
  const rows = await listPartners();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const qrs = Object.fromEntries(
    await Promise.all(rows.map(async (p) => [p.id, await QRCode.toDataURL(`${site}/?src=${p.slug}`, { width: 480, margin: 2, color: { dark: "#141414", light: "#FFFFFF" } })])),
  );
  const owed = rows.reduce((n, p) => n + Number(p.outstandingPaise) + Number(p.unbilledPaise), 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[32px] uppercase leading-none">Partners</h1>
          <p className="mt-1 text-sm text-muted">Hotels and businesses with their own QR. On credit, their orders go on account and you bill them in bulk.</p>
        </div>
        {owed > 0 && <p className="rounded-xl bg-acid/40 px-3 py-2 text-sm">Partners owe <b>{formatINR(owed)}</b> in all</p>}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Add a partner</h2>
          <PropertyForm />
          <p className="mt-2 text-[12px] text-muted">Then open it to switch on credit billing.</p>
        </div>
        <div className="flex flex-col gap-3 lg:col-span-2">
          {rows.length === 0 && <p className="rounded-2xl bg-surface p-6 text-center text-muted">No partners yet. Add the hotels you&apos;re placing QR codes in.</p>}
          {rows.map((p) => (
            <article key={p.id} className={`flex gap-4 rounded-2xl bg-surface p-4 ${p.active ? "" : "opacity-60"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <a href={qrs[p.id]} download={`qr-${p.slug}.png`} className="flex-none"><img src={qrs[p.id]} alt={`QR for ${p.name}`} width={88} height={88} className="rounded-lg bg-white" /></a>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/partners/${p.id}`} className="text-base font-bold underline-offset-2 hover:underline">{p.name}</Link>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${p.billing === "credit" ? "bg-ink text-reversed" : "bg-paper"}`}>
                    {p.billing === "credit" ? `Credit · ${p.creditDays} days` : "Guests pay"}
                  </span>
                  {p.overdue > 0 && <span className="rounded-full bg-error px-2 py-0.5 text-[11px] font-bold uppercase text-reversed">{p.overdue} overdue</span>}
                </div>
                <div className="text-sm text-muted">{[p.contactPerson, p.phone, p.address].filter(Boolean).join(" · ") || "No contact details yet"}</div>
                <div className="flex flex-wrap gap-x-4 text-sm">
                  <span><b>{p.orders}</b> orders</span>
                  {p.billing === "credit" && <span>Unbilled <b>{formatINR(Number(p.unbilledPaise))}</b></span>}
                  {Number(p.outstandingPaise) > 0 && <span>On statements, unpaid <b>{formatINR(Number(p.outstandingPaise))}</b></span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Link href={`/admin/partners/${p.id}`} className="h-8 rounded-lg bg-ink px-3 text-xs font-semibold leading-8 text-reversed">Open</Link>
                  <a href={qrs[p.id]} download={`qr-${p.slug}.png`} className="h-8 rounded-lg bg-paper px-3 text-xs font-semibold leading-8">Download QR</a>
                  <PropertyForm property={p} />
                  <PropertyToggle id={p.id} active={p.active} />
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
