import { PropertyForm, PropertyToggle } from "@/components/admin/property-form";
import QRCode from "qrcode";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/pricing";

export const dynamic = "force-dynamic";

type Row = { id: string; slug: string; name: string; kind: string; contactPerson: string | null; phone: string | null; address: string | null; notes: string | null; active: boolean; orders: number; net: number };

export default async function PropertiesPage() {
  await requireRole(["owner", "manager"], "/admin/properties");
  const rows = await db()<Row[]>`
    select p.id, p.slug, p.name, p.kind, p.contact_person as "contactPerson", p.phone, p.address, p.notes, p.active,
      coalesce(s.delivered_orders, 0)::int as orders, coalesce(s.net_sales_paise, 0)::bigint as net
    from properties p left join property_stats s on s.property_id = p.id
    order by p.active desc, s.net_sales_paise desc nulls last, p.name`;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const qrs = Object.fromEntries(await Promise.all(rows.map(async (p) => [p.id, await QRCode.toDataURL(`${site}/?src=${p.slug}`, { width: 480, margin: 2, color: { dark: "#141414", light: "#FFFFFF" } })])));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-[32px] uppercase">Properties</h1>
        <p className="text-sm text-muted">Hotels, villas and homestays that send you guests. Each gets its own QR link, so you can see which ones bring orders.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Add a property</h2>
          <PropertyForm />
        </div>
        <div className="flex flex-col gap-3 lg:col-span-2">
          {rows.length === 0 && <p className="rounded-2xl bg-surface p-6 text-center text-muted">No properties yet. Add the hotels you&apos;re placing QR codes in.</p>}
          {rows.map((p) => {
            const link = `${site}/?src=${p.slug}`;
            const qr = qrs[p.id];
            return (
              <article key={p.id} className={`flex gap-4 rounded-2xl bg-surface p-4 ${p.active ? "" : "opacity-60"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <a href={qr} download={`qr-${p.slug}.png`} className="flex-none"><img src={qr} alt={`QR for ${p.name}`} width={96} height={96} className="rounded-lg bg-white" /></a>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold">{p.name}</span>
                    <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold uppercase">{p.kind}</span>
                    <span className="ml-auto text-sm"><b>{p.orders}</b> orders · <b>{formatINR(Number(p.net))}</b></span>
                  </div>
                  <div className="text-sm text-muted">{[p.contactPerson, p.phone, p.address].filter(Boolean).join(" · ") || "No contact details yet"}</div>
                  <code className="truncate text-xs text-hill">{link}</code>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <a href={qr} download={`qr-${p.slug}.png`} className="h-8 rounded-lg bg-paper px-3 text-xs font-semibold leading-8">Download QR</a>
                    <PropertyForm property={p} />
                    <PropertyToggle id={p.id} active={p.active} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
