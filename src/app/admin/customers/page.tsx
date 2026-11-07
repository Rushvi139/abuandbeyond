import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/pricing";

export const dynamic = "force-dynamic";

type Row = { id: string; phone: string; name: string | null; tags: string[]; delivered: number; lifetime: number; first: string | null; last: string | null };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string }> }) {
  await requireRole(["owner", "manager"], "/admin/customers");
  const { q, sort } = await searchParams;
  const like = q ? `%${q}%` : null;
  const sql = db();
  const rows = await sql<Row[]>`
    select customer_id as id, phone, name, tags, delivered_orders::int as delivered, lifetime_paise::bigint as lifetime, first_paid_at as first, last_paid_at as last
    from customer_stats
    where ${like}::text is null or phone like ${like} or name ilike ${like}
    order by ${sort === "spend" ? sql`lifetime_paise desc` : sort === "orders" ? sql`delivered_orders desc` : sql`last_paid_at desc nulls last`}
    limit 200`;
  const [tot] = await sql<{ n: number; repeat: number }[]>`select count(*)::int as n, count(*) filter (where delivered_orders > 1)::int as repeat from customer_stats`;
  const d = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : "—");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[32px] uppercase">Customers</h1>
          <p className="text-sm text-muted">{tot.n} customers · {tot.repeat} ordered more than once</p>
        </div>
        <form className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Phone or name" className="h-10 w-56 rounded-xl border border-line bg-surface px-3 text-sm" />
          <select name="sort" defaultValue={sort ?? "recent"} className="h-10 rounded-xl border border-line bg-surface px-2 text-sm">
            <option value="recent">Most recent</option>
            <option value="spend">Top spend</option>
            <option value="orders">Most orders</option>
          </select>
          <button className="h-10 rounded-xl bg-ink px-4 text-sm font-semibold text-reversed">Go</button>
        </form>
      </div>
      <div className="overflow-x-auto rounded-2xl bg-surface">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted">
            <tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Tags</th><th className="px-4 py-3 text-right">Orders</th><th className="px-4 py-3 text-right">Spent</th><th className="px-4 py-3">First</th><th className="px-4 py-3">Last</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-4 py-2.5"><Link href={`/admin/customers/${r.id}`} className="font-semibold underline-offset-2 hover:underline">{r.name ?? "Guest"}</Link></td>
                <td className="px-4 py-2.5 text-muted">{r.phone}</td>
                <td className="px-4 py-2.5">{r.tags.map((t) => <span key={t} className="mr-1 rounded-full bg-paper px-2 py-0.5 text-xs font-semibold">{t}</span>)}</td>
                <td className="px-4 py-2.5 text-right">{r.delivered}</td>
                <td className="px-4 py-2.5 text-right font-semibold">{formatINR(Number(r.lifetime))}</td>
                <td className="px-4 py-2.5 text-muted">{d(r.first)}</td>
                <td className="px-4 py-2.5 text-muted">{d(r.last)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted">No customers yet. They appear with their first order.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
