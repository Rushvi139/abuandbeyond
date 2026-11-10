"use client";

import { useState } from "react";
import { addRecipePhoto, removeRecipeLine, removeRecipePhoto, saveRecipe, setRecipeLine } from "@/lib/admin/recipe-actions";

const inp = "h-10 rounded-xl border border-line bg-paper px-3 text-sm";

type Line = { ingredientId: string; name: string; unit: string; group: string | null; quantity: number };

/** One ingredient line: the quantity is editable in place, in the unit it is bought in. */
export function RecipeLineRow({ menuItemId, line, cost, stock }: { menuItemId: string; line: Line; cost: string; stock: string }) {
  return (
    <tr className="border-t border-line">
      <td className="px-4 py-2 font-semibold">
        {line.name}
        {line.group && <span className="ml-2 text-xs font-normal text-muted">{line.group}</span>}
      </td>
      <td className="px-4 py-2 text-right">
        <form action={setRecipeLine} className="flex items-center justify-end gap-1.5">
          <input type="hidden" name="menuItemId" value={menuItemId} />
          <input type="hidden" name="ingredientId" value={line.ingredientId} />
          <input
            name="quantity"
            type="number"
            step="0.001"
            min="0"
            defaultValue={line.quantity}
            aria-label={`${line.name} per dish`}
            className="h-9 w-24 rounded-xl border border-line bg-paper px-2 text-right text-sm"
          />
          <span className="w-6 text-left text-xs text-muted">{line.unit}</span>
          <button className="h-9 rounded-xl bg-ink px-2.5 text-xs font-semibold text-reversed">Save</button>
        </form>
      </td>
      <td className="px-4 py-2 text-right">{cost}</td>
      <td className="px-4 py-2 text-right text-muted">{stock}</td>
      <td className="px-4 py-2 text-right">
        <form action={removeRecipeLine.bind(null, menuItemId, line.ingredientId)}>
          <button className="h-9 rounded-xl px-2 text-xs font-semibold text-error">Remove</button>
        </form>
      </td>
    </tr>
  );
}

export function AddIngredient({ menuItemId, pantry, used }: { menuItemId: string; pantry: { id: string; name: string; unit: string }[]; used: string[] }) {
  const [ingredientId, setIngredientId] = useState("");
  const left = pantry.filter((p) => !used.includes(p.id));
  const unit = pantry.find((p) => p.id === ingredientId)?.unit ?? "";

  return (
    <form action={setRecipeLine} className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface p-3">
      <input type="hidden" name="menuItemId" value={menuItemId} />
      <select name="ingredientId" value={ingredientId} onChange={(e) => setIngredientId(e.target.value)} required className={`${inp} min-w-48 flex-1`}>
        <option value="">Add an ingredient…</option>
        {left.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <input name="quantity" type="number" step="0.001" min="0.001" required placeholder="Per dish" className={`${inp} w-28`} />
      <span className="w-6 text-sm text-muted">{unit}</span>
      <button className="h-10 rounded-xl bg-ink px-4 text-sm font-semibold text-reversed">Add</button>
      {left.length === 0 && <span className="text-xs text-muted">Every ingredient is already on this recipe. Add new ones under Inventory.</span>}
    </form>
  );
}

export function RecipePhotos({ menuItemId, photos }: { menuItemId: string; photos: { id: string; filePath: string; caption: string | null }[] }) {
  return (
    <div className="rounded-2xl bg-surface p-3">
      {photos.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((p) => (
            <figure key={p.id} className="overflow-hidden rounded-xl bg-paper">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.filePath} alt={p.caption ?? ""} className="h-28 w-full object-cover" />
              <figcaption className="flex items-center justify-between gap-1 px-2 py-1.5">
                <span className="truncate text-xs text-muted">{p.caption ?? ""}</span>
                <form action={removeRecipePhoto.bind(null, p.id, menuItemId)}>
                  <button className="text-xs font-semibold text-error">Remove</button>
                </form>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <form action={addRecipePhoto} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="menuItemId" value={menuItemId} />
        <input name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" required className="text-xs" />
        <input name="caption" maxLength={120} placeholder="What this shows (optional)" className={`${inp} min-w-40 flex-1`} />
        <button className="h-10 rounded-xl bg-ink px-4 text-sm font-semibold text-reversed">Add photo</button>
      </form>
      {photos.length === 0 && <p className="mt-2 text-xs text-muted">Plating shots, the mise en place, what it should look like at each stage.</p>}
    </div>
  );
}

export function RecipeText({
  menuItemId, method, chefNotes, prepMinutes, yieldNote,
}: { menuItemId: string; method: string | null; chefNotes: string | null; prepMinutes: number | null; yieldNote: string | null }) {
  return (
    <form action={saveRecipe} className="flex flex-col gap-2 rounded-2xl bg-surface p-3">
      <input type="hidden" name="menuItemId" value={menuItemId} />
      <label className="text-xs font-bold uppercase tracking-wide text-muted">Method — one step per line</label>
      <textarea
        name="method"
        rows={8}
        defaultValue={method ?? ""}
        placeholder={"Warm the pan on high.\nSear the paneer two minutes a side.\nAdd the gravy, bring to a boil, finish with cream."}
        className="rounded-xl border border-line bg-paper p-3 text-sm leading-relaxed"
      />
      <label className="mt-1 text-xs font-bold uppercase tracking-wide text-muted">Notes — what goes wrong, what to watch</label>
      <textarea
        name="chefNotes"
        rows={3}
        defaultValue={chefNotes ?? ""}
        placeholder="Gravy splits if the cream goes in on high heat."
        className="rounded-xl border border-line bg-paper p-3 text-sm leading-relaxed"
      />
      <div className="flex flex-wrap gap-2">
        <input name="prepMinutes" type="number" min="0" max="600" defaultValue={prepMinutes ?? ""} placeholder="Minutes" className={`${inp} w-28`} aria-label="Minutes to make" />
        <input name="yieldNote" maxLength={120} defaultValue={yieldNote ?? ""} placeholder="Yield, e.g. one plate, about 280g" className={`${inp} min-w-44 flex-1`} />
        <button className="h-10 rounded-xl bg-ink px-4 text-sm font-semibold text-reversed">Save recipe</button>
      </div>
    </form>
  );
}
