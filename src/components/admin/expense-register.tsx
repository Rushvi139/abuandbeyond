"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Cell, DeleteCell } from "@/components/admin/editable-cell";
import { deleteExpense, updateExpenseCell } from "@/lib/admin/register-actions";
import { formatINR } from "@/lib/pricing";

export type ExpenseRow = {
  id: string;
  spentOn: string;
  description: string;
  categoryId: string;
  category: string;
  vendor: string | null;
  vendorId: string | null;
  amount: number;
  mode: string | null;
  reference: string | null;
  filePath: string | null;
  updatedBy: string | null;
};

const COLS = "md:grid-cols-[6rem_minmax(9rem,1fr)_7.5rem_7.5rem_5rem_6rem_6.5rem_4.5rem]";

const day = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/** Monday of the week a plain YYYY-MM-DD falls in. Parsed as UTC so the
 *  kitchen's date never shifts under a server in another zone. */
function weekStart(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  const shift = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - shift);
  return d.toISOString().slice(0, 10);
}

function weekLabel(start: string) {
  const end = new Date(`${start}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  return `${day(start)} – ${day(end.toISOString().slice(0, 10))}`;
}

export function ExpenseRegister({
  rows,
  categories,
  vendors,
  canDelete,
  canEdit,
}: {
  rows: ExpenseRow[];
  categories: { id: string; name: string }[];
  vendors: string[];
  canDelete: boolean;
  canEdit: boolean;
}) {
  const weeks = useMemo(() => {
    const by = new Map<string, ExpenseRow[]>();
    for (const r of rows) {
      const k = weekStart(r.spentOn);
      (by.get(k) ?? by.set(k, []).get(k)!).push(r);
    }
    return [...by.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  const total = rows.reduce((n, r) => n + r.amount, 0);
  const busiest = Math.max(1, ...weeks.map(([, rs]) => rs.reduce((n, r) => n + r.amount, 0)));

  if (rows.length === 0) {
    return <p className="rounded-2xl bg-surface p-8 text-center text-muted">No expenses match these filters.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <datalist id="vendor-names">
        {vendors.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>

      <div className={`hidden text-[11px] font-bold uppercase tracking-wide text-muted md:grid ${COLS} gap-x-3 px-3`}>
        <span>Date</span>
        <span>What for</span>
        <span>Category</span>
        <span>Vendor</span>
        <span>Mode</span>
        <span>Ref</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Slip</span>
      </div>

      {weeks.map(([start, rs]) => {
        const sum = rs.reduce((n, r) => n + r.amount, 0);
        return (
          <section key={start}>
            <header className="mb-1.5 flex items-baseline gap-3 px-1">
              <h3 className="font-display text-[15px] uppercase">{weekLabel(start)}</h3>
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface">
                <div className="h-full rounded-full bg-clay" style={{ width: `${(sum / busiest) * 100}%` }} />
              </div>
              <span className="text-sm font-bold">{formatINR(sum)}</span>
              <span className="hidden text-[11px] text-muted sm:inline">
                {rs.length} entr{rs.length === 1 ? "y" : "ies"}
              </span>
            </header>

            <div className="overflow-hidden rounded-2xl bg-surface">
              {rs.map((r) => (
                <Row key={r.id} row={r} categories={categories} canEdit={canEdit} canDelete={canDelete} />
              ))}
            </div>
          </section>
        );
      })}

      <p className="rounded-2xl bg-ink px-4 py-3 text-right text-reversed">
        <span className="mr-3 text-sm opacity-70">
          {rows.length} entries across {weeks.length} week{weeks.length === 1 ? "" : "s"}
        </span>
        <span className="font-display text-[22px]">{formatINR(total)}</span>
      </p>
      {canEdit && <p className="px-1 text-[11px] text-muted"><span className="md:hidden">Tap a row to open it, then tap a value to change it.</span><span className="hidden md:inline">Tap any value to change it.</span> Enter saves, Esc cancels.</p>}
    </div>
  );
}

function Row({ row: r, categories, canEdit, canDelete }: { row: ExpenseRow; categories: { id: string; name: string }[]; canEdit: boolean; canDelete: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line last:border-0">
      {/* Phone: one scannable line, tapped to open. Desktop shows the grid. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-baseline gap-2 p-3 text-left text-sm md:hidden"
      >
        <span className="w-12 flex-none text-[11px] text-muted">{day(r.spentOn)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{r.description}</span>
          <span className="block truncate text-[11px] text-muted">
            {[r.category, r.vendor, r.mode].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className="flex-none font-bold">{formatINR(r.amount)}</span>
        <span className={`flex-none text-[11px] text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">▾</span>
      </button>

      <div
        className={`${open ? "grid" : "hidden"} grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-3 pb-3 text-sm md:grid md:items-center md:px-3 md:py-2 ${COLS}`}
      >
                  <Field label="Date">
                    <Cell
                      kind="date"
                      value={r.spentOn}
                      display={day(r.spentOn)}
                      readOnly={!canEdit}
                      save={(v) => updateExpenseCell(r.id, "spent_on", v)}
                    />
                  </Field>

                  <Field label="What for" className="col-span-2 md:col-span-1">
                    <Cell value={r.description} readOnly={!canEdit} save={(v) => updateExpenseCell(r.id, "description", v)} />
                  </Field>

                  <Field label="Category">
                    <Cell
                      kind="select"
                      value={r.categoryId}
                      display={r.category}
                      options={categories.map((c) => ({ value: c.id, label: c.name }))}
                      readOnly={!canEdit}
                      save={(v) => updateExpenseCell(r.id, "category_id", v)}
                    />
                  </Field>

                  <Field label="Vendor">
                    {r.vendorId && !canEdit ? (
                      <Link href={`/admin/accounts/vendors/${r.vendorId}`} className="underline-offset-2 hover:underline">
                        {r.vendor}
                      </Link>
                    ) : (
                      <Cell
                        value={r.vendor ?? ""}
                       
                        readOnly={!canEdit}
                        save={(v) => updateExpenseCell(r.id, "vendor", v)}
                      />
                    )}
                  </Field>

                  <Field label="Mode">
                    <Cell value={r.mode ?? ""} readOnly={!canEdit} save={(v) => updateExpenseCell(r.id, "mode", v)} />
                  </Field>

                  <Field label="Ref">
                    <Cell value={r.reference ?? ""} readOnly={!canEdit} save={(v) => updateExpenseCell(r.id, "reference", v)} />
                  </Field>

                  <Field label="Amount" align="right">
                    <Cell
                      kind="money"
                      align="right"
                      value={(r.amount / 100).toFixed(2)}
                      display={formatINR(r.amount)}
                      readOnly={!canEdit}
                      save={(v) => updateExpenseCell(r.id, "amount_paise", v)}
                    />
                  </Field>

                  <div className="flex items-center justify-end gap-2 md:justify-end">
                    {r.filePath ? (
                      <a href={`/files/${r.filePath}`} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-hill underline-offset-2 hover:underline">
                        slip
                      </a>
                    ) : (
                      <span className="text-[11px] text-muted">—</span>
                    )}
                    {canDelete && <DeleteCell what={r.description} onDelete={() => deleteExpense(r.id)} />}
                  </div>

        {r.updatedBy && <p className="col-span-2 text-[11px] text-muted md:col-span-8 md:-mt-1">edited by {r.updatedBy}</p>}
      </div>
    </div>
  );
}

/** Shows its label only on a phone, where the row becomes a card. */
function Field({ label, children, align, className = "" }: { label: string; children: React.ReactNode; align?: "right"; className?: string }) {
  return (
    <div className={`min-w-0 ${align === "right" ? "text-right" : ""} ${className}`}>
      <span className="block text-[10px] uppercase tracking-wide text-muted md:hidden">{label}</span>
      {children}
    </div>
  );
}
