import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerEditor } from "@/components/admin/customer-editor";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["owner", "manager"], "/admin/customers");
  const { id } = await params;
  const sql = db();
  const [c] = await sql<{ id: string; phone: string; name: string | null; tags: string[]; notes: string | null; optIn: boolean; createdAt: string }[]>`
    select id, phone, name, tags, notes, whatsapp_opt_in as "optIn", created_at as "createdAt" from customers where id = ${id}`;
  if (!c) notFound();
  const [stats] = await sql<{ delivered: number; lifetime: number; first: string | null; last: string | null }[]>`
    select delivered_orders::int as delivered, lifetime_paise::bigint as lifetime, first_paid_at as first, last_paid_at as last from customer_stats where customer_id = ${id}`;
  const orders = await sql<{ id: string; number: number; code: string; status: string; total: number; createdAt: string; where: string | null; items: string }[]>`
    select o.id, o.order_number as number, o.order_code as code, o.status, o.total_paise as total, o.created_at as "createdAt",
      coalesce(o.property_name, '') || case when o.room_or_landmark is not null then ', ' || o.room_or_landmark else '' end as "where",
      (select string_agg(oi.quantity || '× ' || oi.name_snapshot, ', ') from order_items oi where oi.order_id = o.id) as items
    from orders o where o.customer_id = ${id} order by o.created_at desc limit 50`;
  const faves = await sql<{ name: string; n: number }[]>`
    select oi.name_snapshot as name, sum(oi.quantity)::int as n from order_items oi join orders o on o.id = oi.order_id
    where o.customer_id = ${id} and o.status = 'delivered' group by 1 order by 2 desc limit 5`;
  const avg = stats.delivered ? Math.round(Number(stats.lifetime) / stats.delivered) : 0;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin/customers" className="text-sm font-semibold text-muted">← Customers</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[32px] uppercase">{c.name ?? "Guest"}</h1>
          <p className="text-sm text-muted">{c.phone} · <a href={`https://wa.me/${c.phone.replace("+", "")}`} target="_blank" rel="noreferrer" className="font-semibold text-hill underline-offset-2 hover:underline">WhatsApp</a> · <a href={`tel:${c.phone}`} className="font-semibold text-hill">Call</a></p>
        </div>
        <div className="flex gap-3 text-sm">
          <Stat label="Delivered" value={String(stats.delivered)} />
          <Stat label="Spent" value={formatINR(Number(stats.lifetime))} />
          <Stat label="Avg order" value={formatINR(avg)} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <CustomerEditor id={c.id} name={c.name ?? ""} tags={c.tags} notes={c.notes ?? ""} optIn={c.optIn} />
          {faves.length > 0 && (
            <div className="mt-4 rounded-2xl bg-surface p-4">
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted">Favourites</h2>
              <ul className="mt-2 text-sm">{faves.map((f) => <li key={f.name} className="flex justify-between py-1"><span>{f.name}</span><span className="text-muted">×{f.n}</span></li>)}</ul>
            </div>
          )}
        </div>
        <div className="overflow-x-auto rounded-2xl bg-surface lg:col-span-2">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-3">#</th><th className="px-4 py-3">When</th><th className="px-4 py-3">Items</th><th className="px-4 py-3">Where</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Total</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-line align-top">
                  <td className="px-4 py-2.5 font-semibold"><a href={`/o/${o.code}`} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">{o.number}</a></td>
                  <td className="px-4 py-2.5 text-muted">{new Date(o.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}</td>
                  <td className="px-4 py-2.5">{o.items}</td>
                  <td className="px-4 py-2.5 text-muted">{o.where}</td>
                  <td className="px-4 py-2.5">{o.status.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{formatINR(o.total)}</td>
                </tr>
              ))}
              {orders.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">No orders yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-surface px-3 py-2"><div className="text-[11px] uppercase tracking-wide text-muted">{label}</div><div className="font-display text-[20px]">{value}</div></div>;
}
