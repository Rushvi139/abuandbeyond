"use client";

import { useTransition, useState } from "react";
import { Cell } from "@/components/admin/editable-cell";
import { IngredientForm } from "@/components/admin/stock-forms";
import { updateIngredientCell } from "@/lib/admin/register-actions";
import { deleteIngredient } from "@/lib/admin/stock-actions";
import { formatINR } from "@/lib/pricing";

export type StockRow = {
  id: string;
  name: string;
  unit: string;
  group: string | null;
  rate: number;
  reorder: number;
  onHand: number;
  isLow: boolean;
  usedIn: number;
  lastPurchase: string | null;
};

/** The unit it is bought in: a kilo, a litre, or one of the thing. Rates are
 *  typed this way; quantities stay in base units, as the add form takes them. */
const buyUnit = (unit: string) => (unit === "pc" ? "pc" : unit === "ml" ? "L" : "kg");
const fmtQty = (q: number, unit: string) =>
  unit === "pc" ? `${Math.round(q)} pc` : q >= 1000 ? `${(q / 1000).toFixed(2)} ${buyUnit(unit)}` : `${Math.round(q)} ${unit}`;
const fmtRate = (paisePerUnit: number, unit: string) =>
  `${formatINR(Math.round(unit === "pc" ? paisePerUnit : paisePerUnit * 1000))}/${buyUnit(unit)}`;

const COLS = "md:grid-cols-[minmax(8rem,1fr)_6rem_5rem_5.5rem_6.5rem_3.5rem_3.5rem]";

function IngredientDelete({ id, name, usedIn }: { id: string; name: string; usedIn: number }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span>
      {err && <span className="block text-right text-[10px] text-error">{err}</span>}
      <button
        type="button"
        disabled={pending || usedIn > 0}
        title={usedIn > 0 ? `Used in ${usedIn} recipe${usedIn === 1 ? "" : "s"} — remove from recipes first` : `Delete ${name}`}
        onClick={() => {
          if (!confirm(`Delete "${name}"?`)) return;
          start(async () => {
            try { await deleteIngredient(id); setErr(null); }
            catch (e) { setErr(e instanceof Error ? e.message : "Could not delete"); }
          });
        }}
        className="h-7 rounded-lg px-2 text-xs font-semibold text-error/70 hover:bg-error/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {pending ? "…" : "Del"}
      </button>
    </span>
  );
}

export function StockTable({ rows, canEdit, canDelete }: { rows: StockRow[]; canEdit: boolean; canDelete?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
      <div className="md:min-w-[42rem]">
      <div className={`hidden text-[11px] font-bold uppercase tracking-wide text-muted md:grid ${COLS} gap-x-3 px-3`}>
        <span>Ingredient</span>
        <span>Group</span>
        <span className="text-right">On hand</span>
        <span className="text-right">Reorder at</span>
        <span className="text-right">Rate</span>
        <span className="text-right">Dishes</span>
        <span />
      </div>

      <div className="overflow-hidden rounded-2xl bg-surface">
        {rows.map((r) => (
          <div
            key={r.id}
            className={`grid grid-cols-2 gap-x-3 gap-y-1 border-b border-line p-3 text-sm last:border-0 md:items-center md:py-2 ${COLS} ${
              r.isLow ? "bg-error/5" : ""
            }`}
          >
            <Field label="Ingredient" className="col-span-2 md:col-span-1">
              <span className="flex items-center gap-1.5">
                {r.isLow && <span className="h-2 w-2 flex-none rounded-full bg-error" aria-label="below reorder level" />}
                <Cell value={r.name} readOnly={!canEdit} save={(v) => updateIngredientCell(r.id, "name", v)} />
              </span>
            </Field>

            <Field label="Group">
              <Cell value={r.group ?? ""} readOnly={!canEdit} save={(v) => updateIngredientCell(r.id, "procurement_group", v)} />
            </Field>

            <Field label="On hand" align="right">
              <span className={`block text-right font-semibold ${r.isLow ? "text-error" : ""}`}>{fmtQty(r.onHand, r.unit)}</span>
            </Field>

            <Field label={`Reorder at (${r.unit})`} align="right">
              <Cell
                kind="money"
                align="right"
                value={String(+r.reorder.toFixed(3))}
                display={fmtQty(r.reorder, r.unit)}
                readOnly={!canEdit}
                save={(v) => updateIngredientCell(r.id, "reorder_level", v)}
              />
            </Field>

            <Field label={`Rate per ${buyUnit(r.unit)}`} align="right">
              <Cell
                kind="money"
                align="right"
                value={((r.unit === "pc" ? r.rate : r.rate * 1000) / 100).toFixed(2)}
                display={fmtRate(r.rate, r.unit)}
                readOnly={!canEdit}
                save={(v) => updateIngredientCell(r.id, "rate", v)}
              />
            </Field>

            <Field label="Dishes" align="right">
              <span className="block text-right text-muted">{r.usedIn}</span>
            </Field>

            <div className="flex items-center justify-end gap-1">
              <IngredientForm ingredient={r} />
              {canDelete && <IngredientDelete id={r.id} name={r.name} usedIn={r.usedIn} />}
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="p-8 text-center text-muted">No ingredients yet.</p>}
      </div>
      </div>
      </div>

      {canEdit && (
        <p className="px-1 text-[11px] text-muted">
          Tap a name, group, reorder level or rate to change it. A new rate re-costs every dish that uses it.
        </p>
      )}
    </div>
  );
}

function Field({ label, children, align, className = "" }: { label: string; children: React.ReactNode; align?: "right"; className?: string }) {
  return (
    <div className={`min-w-0 ${align === "right" ? "text-right" : ""} ${className}`}>
      <span className="block text-[10px] uppercase tracking-wide text-muted md:hidden">{label}</span>
      {children}
    </div>
  );
}
