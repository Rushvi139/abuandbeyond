import Link from "next/link";
import { IngredientForm, MovementForm } from "@/components/admin/stock-forms";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/pricing";

export const dynamic = "force-dynamic";

type Row = { id: string; name: string; unit: string; group: string | null; rate: number; reorder: number; onHand: number; isLow: boolean; usedIn: number; lastPurchase: string | null };

const fmtQty = (q: number, unit: string) => (unit === "pc" ? `${Math.round(q)} pc` : q >= 1000 ? `${(q / 1000).toFixed(2)} ${unit === "g" ? "kg" : "L"}` : `${Math.round(q)} ${unit}`);
const fmtRate = (paisePerUnit: number, unit: string) => (unit === "pc" ? `${formatINR(Math.round(paisePerUnit))}/pc` : `${formatINR(Math.round(paisePerUnit * 1000))}/${unit === "g" ? "kg" : "L"}`);

export default async function StockPage({ searchParams }: { searchParams: Promise<{ q?: string; low?: string }> }) {
  await requireRole(["owner", "manager"], "/admin/stock");
  const { q, low } = await searchParams;
  const like = q ? `%${q}%` : null;
  const rows = await db()<Row[]>`
    select i.id, i.name, i.unit, i.procurement_group as "group", i.rate_paise_per_unit::float as rate, i.reorder_level::float as reorder,
      coalesce(s.on_hand, 0)::float as "onHand", coalesce(s.is_low, false) as "isLow",
      (select count(*)::int from recipe_lines r where r.ingredient_id = i.id) as "usedIn",
      (select max(created_at) from stock_movements m where m.ingredient_id = i.id and m.kind = 'purchase') as "lastPurchase"
    from ingredients i left join stock_on_hand s on s.ingredient_id = i.id
    where i.active and (${like}::text is null or i.name ilike ${like} or i.procurement_group ilike ${like})
      and (${low ?? null}::text is null or coalesce(s.is_low, false))
    order by coalesce(s.is_low, false) desc, i.procurement_group nulls last, i.name`;
  const lowCount = rows.filter((r) => r.isLow).length;
  const movements = await db()<{ id: number; name: string; unit: string; kind: string; quantity: number; note: string | null; at: string; who: string | null }[]>`
    select m.id, i.name, i.unit, m.kind, m.quantity::float as quantity, m.note, m.created_at as at, u.full_name as who
    from stock_movements m join ingredients i on i.id = m.ingredient_id left join staff_users u on u.id = m.actor_id
    where m.kind <> 'consumption' order by m.created_at desc limit 20`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[32px] uppercase">Inventory</h1>
          <p className="text-sm text-muted">{rows.length} ingredients · <span className={lowCount ? "font-semibold text-error" : ""}>{lowCount} below reorder level</span>. Stock drops automatically when an order is delivered (from each dish&apos;s recipe).</p>
        </div>
        <form className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Ingredient or group" className="h-10 w-52 rounded-xl border border-line bg-surface px-3 text-sm" />
          <label className="flex h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm"><input type="checkbox" name="low" value="1" defaultChecked={Boolean(low)} className="accent-clay" /> Low only</label>
          <button className="h-10 rounded-xl bg-ink px-4 text-sm font-semibold text-reversed">Filter</button>
          <Link href="/admin/export/stock" className="h-10 rounded-xl border border-ink px-4 text-sm font-semibold leading-10">Export stock CSV</Link>
          <Link href="/admin/export/stock-ledger" className="h-10 rounded-xl border border-ink px-4 text-sm font-semibold leading-10">Export ledger CSV</Link>
        </form>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-1">
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Record stock in / out</h2>
            <MovementForm ingredients={rows.map((r) => ({ id: r.id, name: r.name, unit: r.unit }))} />
          </section>
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Add an ingredient</h2>
            <IngredientForm />
          </section>
        </div>
        <div className="overflow-x-auto rounded-2xl bg-surface lg:col-span-2">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr><th className="px-4 py-3">Ingredient</th><th className="px-4 py-3">Group</th><th className="px-4 py-3 text-right">On hand</th><th className="px-4 py-3 text-right">Reorder at</th><th className="px-4 py-3 text-right">Rate</th><th className="px-4 py-3 text-right">Dishes</th><th className="px-4 py-3"></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`border-t border-line ${r.isLow ? "bg-error/5" : ""}`}>
                  <td className="px-4 py-2.5 font-semibold">{r.isLow && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-error align-middle" />}{r.name}</td>
                  <td className="px-4 py-2.5 text-muted">{r.group ?? "—"}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${r.isLow ? "text-error" : ""}`}>{fmtQty(r.onHand, r.unit)}</td>
                  <td className="px-4 py-2.5 text-right text-muted">{fmtQty(r.reorder, r.unit)}</td>
                  <td className="px-4 py-2.5 text-right text-muted">{fmtRate(r.rate, r.unit)}</td>
                  <td className="px-4 py-2.5 text-right text-muted">{r.usedIn}</td>
                  <td className="px-4 py-2.5 text-right"><IngredientForm ingredient={r} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <section>
        <h2 className="mb-2 font-display text-[18px] uppercase">Recent stock entries</h2>
        <div className="overflow-x-auto rounded-2xl bg-surface">
          <table className="w-full min-w-[560px] text-sm">
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-t border-line first:border-0">
                  <td className="px-4 py-2 text-muted">{new Date(m.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}</td>
                  <td className="px-4 py-2 font-semibold">{m.name}</td>
                  <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${m.kind === "purchase" || m.kind === "opening" ? "bg-success/15 text-success" : m.kind === "wastage" ? "bg-error/15 text-error" : "bg-paper"}`}>{m.kind}</span></td>
                  <td className={`px-4 py-2 text-right font-semibold ${m.quantity < 0 ? "text-error" : ""}`}>{m.quantity > 0 ? "+" : ""}{fmtQty(Math.abs(m.quantity), m.unit).replace(/^/, m.quantity < 0 ? "−" : "")}</td>
                  <td className="px-4 py-2 text-muted">{m.note} {m.who && <span className="text-xs">· {m.who}</span>}</td>
                </tr>
              ))}
              {movements.length === 0 && <tr><td className="px-4 py-6 text-center text-muted">No entries yet. Record your opening stock to start.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
