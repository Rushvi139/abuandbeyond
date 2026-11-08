import Link from "next/link";
import { notFound } from "next/navigation";
import { AddIngredient, RecipeLineRow, RecipePhotos, RecipeText } from "@/components/admin/recipe-forms";
import { requireRole } from "@/lib/auth";
import { kitchenLoading, recipeDetail } from "@/lib/admin/recipe-queries";
import { formatINR } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const fmtQty = (q: number, unit: string) =>
  unit === "pc" ? `${Math.round(q)} pc` : q >= 1000 ? `${(q / 1000).toFixed(2)} ${unit === "g" ? "kg" : "L"}` : `${Math.round(q)} ${unit}`;

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["owner", "manager"], "/admin/recipes");
  const { id } = await params;
  const data = await recipeDetail(id);
  if (!data) notFound();
  const { dish, lines, photos, pantry } = data;
  const loading = await kitchenLoading();

  const ingredientPaise = lines.reduce((n, l) => n + l.quantity * l.ratePaisePerUnit, 0);
  const food = Math.round(ingredientPaise * loading) + dish.packagingPaise;
  const margin = dish.pricePaise ? Math.round(((dish.pricePaise - food) / dish.pricePaise) * 100) : null;
  const steps = (dish.method ?? "").split("\n").map((s) => s.trim()).filter(Boolean);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/admin/recipes" className="text-sm font-semibold text-muted underline-offset-2 hover:underline">← Recipe book</Link>
        <h1 className="mt-2 flex items-center gap-2 font-display text-[32px] uppercase">
          <span className={`h-3 w-3 rounded-full ${dish.isVeg ? "bg-veg" : "bg-error"}`} aria-hidden="true" />
          {dish.name}
        </h1>
        <p className="text-sm text-muted">
          {dish.category} · sells for {formatINR(dish.pricePaise)} before GST · {dish.sold30} sold in 30 days
          {dish.updatedAt && <> · recipe updated {new Date(dish.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}{dish.updatedBy ? ` by ${dish.updatedBy}` : ""}</>}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Ingredients" value={formatINR(Math.round(ingredientPaise))} />
        <Stat label={`+ kitchen ${Math.round((loading - 1) * 100)}%`} value={formatINR(Math.round(ingredientPaise * loading) - Math.round(ingredientPaise))} sub="gas, oil, trim" />
        <Stat label="+ packaging" value={formatINR(dish.packagingPaise)} />
        <Stat
          label="Costs us"
          value={formatINR(food)}
          sub={margin === null ? undefined : `${margin}% margin`}
          tone={margin !== null && margin < 60 ? "bad" : "good"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 font-display text-[18px] uppercase">Ingredients</h2>
          <div className="overflow-x-auto rounded-2xl bg-surface">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Ingredient</th>
                  <th className="px-4 py-3 text-right">Per dish</th>
                  <th className="px-4 py-3 text-right">Cost</th>
                  <th className="px-4 py-3 text-right">In stock</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <RecipeLineRow key={l.ingredientId} menuItemId={dish.id} line={l} cost={formatINR(Math.round(l.quantity * l.ratePaisePerUnit))} stock={fmtQty(l.onHand, l.unit)} />
                ))}
                {lines.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">Nothing listed yet. Until it is, this dish costs nothing and takes nothing off the shelf when it sells.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3">
            <AddIngredient menuItemId={dish.id} pantry={pantry} used={lines.map((l) => l.ingredientId)} />
          </div>
        </section>

        <div className="flex flex-col gap-5">
          <section>
            <h2 className="mb-2 font-display text-[18px] uppercase">Photos</h2>
            <RecipePhotos menuItemId={dish.id} photos={photos} />
          </section>

          <section>
            <h2 className="mb-2 font-display text-[18px] uppercase">Method &amp; notes</h2>
            <RecipeText
              menuItemId={dish.id}
              method={dish.method}
              chefNotes={dish.chefNotes}
              prepMinutes={dish.prepMinutes}
              yieldNote={dish.yieldNote}
            />
          </section>

          {steps.length > 0 && (
            <section>
              <h2 className="mb-2 font-display text-[18px] uppercase">As the kitchen reads it</h2>
              <ol className="flex list-decimal flex-col gap-2 rounded-2xl bg-surface p-5 pl-9 text-[15px] leading-relaxed">
                {steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone = "" }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className={`rounded-xl bg-surface px-3 py-2 ${tone === "bad" ? "ring-1 ring-error" : ""}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`font-display text-[20px] ${tone === "bad" ? "text-error" : tone === "good" ? "text-success" : ""}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  );
}
