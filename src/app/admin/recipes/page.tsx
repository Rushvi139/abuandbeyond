import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { indentFromSales, kitchenLoading, recipeCards } from "@/lib/admin/recipe-queries";
import { formatINR } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const fmtQty = (q: number, unit: string) =>
  unit === "pc" ? `${Math.round(q)} pc` : q >= 1000 ? `${(q / 1000).toFixed(2)} ${unit === "g" ? "kg" : "L"}` : `${Math.round(q)} ${unit}`;

export default async function RecipeBook() {
  await requireRole(["owner", "manager"], "/admin/recipes");
  const [cards, loading, indent] = await Promise.all([recipeCards(), kitchenLoading(), indentFromSales()]);

  const costed = cards.map((c) => {
    const food = c.ingredientPaise === null ? null : Math.round(c.ingredientPaise * loading) + c.packagingPaise;
    const margin = food === null || c.pricePaise === 0 ? null : Math.round(((c.pricePaise - food) / c.pricePaise) * 100);
    return { ...c, food, margin };
  });
  const missing = costed.filter((c) => c.lines === 0).length;
  const groups = [...new Set(costed.map((c) => c.category))];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-[32px] uppercase">Recipe book</h1>
        <p className="text-sm text-muted">
          How every dish is made, what it costs and what it ate last month.
          {missing > 0 && <> <span className="font-semibold text-error">{missing} without a recipe</span> — those cost nothing and take nothing off the shelf.</>}
        </p>
      </div>

      {groups.map((g) => (
        <section key={g}>
          <h2 className="mb-2 font-display text-[18px] uppercase">{g}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {costed.filter((c) => c.category === g).map((c) => (
              <Link key={c.id} href={`/admin/recipes/${c.id}`} className="flex gap-3 overflow-hidden rounded-2xl bg-surface p-3 transition-shadow hover:shadow-md">
                {c.photo || c.imagePath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={(c.photo ?? c.imagePath) as string} alt="" className="h-20 w-20 flex-none rounded-xl object-cover" />
                ) : (
                  <div className="flex h-20 w-20 flex-none items-center justify-center rounded-xl bg-paper text-[11px] text-muted">No photo</div>
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-1.5">
                    <span className={`h-2.5 w-2.5 flex-none rounded-full ${c.isVeg ? "bg-veg" : "bg-error"}`} aria-hidden="true" />
                    <span className="truncate font-semibold">{c.name}</span>
                  </span>
                  <span className="text-xs text-muted">
                    {c.lines > 0 ? `${c.lines} ingredient${c.lines === 1 ? "" : "s"}` : <span className="font-semibold text-error">no recipe yet</span>}
                    {c.hasMethod ? " · method written" : c.lines > 0 ? " · no method" : ""}
                  </span>
                  <span className="text-sm">
                    {c.food === null ? (
                      <span className="text-muted">cost unknown</span>
                    ) : (
                      <>
                        <b>{formatINR(c.food)}</b> <span className="text-muted">cost</span>
                        {c.margin !== null && (
                          <span className={`ml-2 font-semibold ${c.margin < 60 ? "text-error" : "text-success"}`}>{c.margin}%</span>
                        )}
                      </>
                    )}
                  </span>
                  <span className="text-xs text-muted">{c.sold30} sold in 30 days</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <section>
        <h2 className="mb-1 font-display text-[18px] uppercase">What the month actually ate</h2>
        <p className="mb-2 text-sm text-muted">
          Thirty days of real orders run back through these recipes — the honest basis for the next indent, by value.
        </p>
        <div className="overflow-x-auto rounded-2xl bg-surface">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Ingredient</th>
                <th className="px-4 py-3">Group</th>
                <th className="px-4 py-3 text-right">Used in 30 days</th>
                <th className="px-4 py-3 text-right">On hand</th>
                <th className="px-4 py-3 text-right">Short by</th>
                <th className="px-4 py-3 text-right">Month&apos;s cost</th>
              </tr>
            </thead>
            <tbody>
              {indent.map((r) => {
                const short = Math.max(0, r.usedPerMonth - r.onHand);
                return (
                  <tr key={r.ingredientId} className="border-t border-line">
                    <td className="px-4 py-2.5 font-semibold">{r.name}</td>
                    <td className="px-4 py-2.5 text-muted">{r.group ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right">{fmtQty(r.usedPerMonth, r.unit)}</td>
                    <td className="px-4 py-2.5 text-right text-muted">{fmtQty(r.onHand, r.unit)}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${short > 0 ? "text-error" : "text-muted"}`}>
                      {short > 0 ? fmtQty(short, r.unit) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">{formatINR(Math.round(r.usedPerMonth * r.ratePaisePerUnit))}</td>
                  </tr>
                );
              })}
              {indent.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">No delivered orders in the last 30 days yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
