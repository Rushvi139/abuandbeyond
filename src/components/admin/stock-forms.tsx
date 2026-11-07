"use client";

import { useState, useTransition } from "react";
import { recordMovement, saveIngredient } from "@/lib/admin/stock-actions";

const inp = "h-10 rounded-xl border border-line bg-paper px-3 text-sm";
const unitLabel = (u: string) => (u === "pc" ? "pieces" : u === "g" ? "grams" : "ml");
const rateLabel = (u: string) => (u === "pc" ? "₹ per piece" : u === "g" ? "₹ per kg" : "₹ per litre");

export function MovementForm({ ingredients }: { ingredients: { id: string; name: string; unit: string }[] }) {
  const [pending, start] = useTransition();
  const [kind, setKind] = useState("purchase");
  const [ing, setIng] = useState(ingredients[0]?.id ?? "");
  const unit = ingredients.find((i) => i.id === ing)?.unit ?? "g";
  const [done, setDone] = useState(false);
  return (
    <form action={(fd) => start(async () => { await recordMovement(fd); setDone(true); setTimeout(() => setDone(false), 1500); })} className="flex flex-col gap-2 rounded-2xl bg-surface p-4">
      <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={inp}>
        <option value="purchase">Purchase (stock in)</option>
        <option value="wastage">Wastage (stock out)</option>
        <option value="adjustment">Count (set what&apos;s on the shelf)</option>
        <option value="opening">Opening stock</option>
      </select>
      <select name="ingredientId" value={ing} onChange={(e) => setIng(e.target.value)} className={inp}>
        {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
      </select>
      <label className="flex items-center gap-2 text-sm">
        <input name="quantity" type="number" step="any" min="0" required placeholder={kind === "adjustment" ? "Counted amount" : "Quantity"} className={`${inp} flex-1`} />
        <span className="w-14 text-muted">{unitLabel(unit)}</span>
      </label>
      {kind === "purchase" && <input name="unitCostInr" type="number" step="any" min="0" placeholder={`${rateLabel(unit)} (updates the rate card)`} className={inp} />}
      <input name="note" placeholder="Note (vendor, reason…)" className={inp} />
      <button type="submit" disabled={pending} className="h-10 rounded-xl bg-ink text-sm font-semibold text-reversed disabled:opacity-50">{done ? "Recorded" : pending ? "Saving…" : "Record"}</button>
    </form>
  );
}

type Ing = { id: string; name: string; unit: string; group: string | null; rate: number; reorder: number };

export function IngredientForm({ ingredient }: { ingredient?: Ing }) {
  const [open, setOpen] = useState(!ingredient);
  const [pending, start] = useTransition();
  const [unit, setUnit] = useState(ingredient?.unit ?? "g");
  if (ingredient && !open) return <button type="button" onClick={() => setOpen(true)} className="h-8 rounded-lg bg-paper px-3 text-xs font-semibold">Edit</button>;
  const rateInr = ingredient ? (ingredient.unit === "pc" ? ingredient.rate / 100 : (ingredient.rate * 1000) / 100) : "";
  return (
    <form action={(fd) => start(async () => { await saveIngredient(fd); if (ingredient) setOpen(false); else (document.getElementById("iform") as HTMLFormElement | null)?.reset(); })} id={ingredient ? undefined : "iform"} className={`flex flex-col gap-2 rounded-2xl bg-surface p-4 text-left ${ingredient ? "mt-1 w-64 border border-line" : ""}`}>
      {ingredient && <input type="hidden" name="id" value={ingredient.id} />}
      <input name="name" required defaultValue={ingredient?.name} placeholder="Ingredient name" className={inp} />
      <div className="flex gap-2">
        <select name="unit" value={unit} onChange={(e) => setUnit(e.target.value)} className={`${inp} flex-1`}><option value="g">grams (g)</option><option value="ml">millilitres (ml)</option><option value="pc">pieces</option></select>
        <input name="group" defaultValue={ingredient?.group ?? ""} placeholder="Group" className={`${inp} flex-1`} />
      </div>
      <input name="rateInr" type="number" step="any" min="0" defaultValue={rateInr} placeholder={rateLabel(unit)} className={inp} />
      <input name="reorder" type="number" step="any" min="0" defaultValue={ingredient?.reorder ?? ""} placeholder={`Reorder when below (${unitLabel(unit)})`} className={inp} />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="h-10 flex-1 rounded-xl bg-ink text-sm font-semibold text-reversed disabled:opacity-50">{pending ? "Saving…" : ingredient ? "Save" : "Add ingredient"}</button>
        {ingredient && <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-xl px-3 text-sm font-semibold text-muted">Cancel</button>}
      </div>
    </form>
  );
}
