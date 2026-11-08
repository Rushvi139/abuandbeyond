"use client";

import { useState } from "react";
import Link from "next/link";
import { Cell, DeleteCell } from "@/components/admin/editable-cell";
import { PayBill } from "@/components/admin/accounts-forms";
import { deleteBill, updateBillCell } from "@/lib/admin/register-actions";
import { formatINR } from "@/lib/pricing";

export type BillRow = {
  id: string;
  vendorId: string;
  vendor: string;
  billNumber: string | null;
  billDate: string;
  dueOn: string | null;
  amount: number;
  gst: number;
  paid: number;
  filePath: string | null;
  updatedBy: string | null;
};

const COLS = "md:grid-cols-[1fr_7rem_6.5rem_6.5rem_7rem_6rem_7rem_8rem]";
const day = (s: string | null) => (s ? new Date(`${s}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }) : "");

export function BillRegister({ rows, today, canEdit, canDelete }: { rows: BillRow[]; today: string; canEdit: boolean; canDelete: boolean }) {
  if (rows.length === 0) return <p className="rounded-2xl bg-surface p-8 text-center text-muted">No bills match these filters.</p>;

  const billed = rows.reduce((n, r) => n + r.amount, 0);
  const paid = rows.reduce((n, r) => n + r.paid, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className={`hidden text-[11px] font-bold uppercase tracking-wide text-muted md:grid ${COLS} gap-x-3 px-3`}>
        <span>Vendor</span>
        <span>Bill no.</span>
        <span>Date</span>
        <span>Due</span>
        <span className="text-right">Amount</span>
        <span className="text-right">of which GST</span>
        <span className="text-right">Still due</span>
        <span className="text-right">Invoice</span>
      </div>

      <div className="overflow-hidden rounded-2xl bg-surface">
        {rows.map((r) => (
          <Row key={r.id} row={r} today={today} canEdit={canEdit} canDelete={canDelete} />
        ))}
      </div>

      <div className="flex flex-wrap items-baseline justify-end gap-x-6 gap-y-1 rounded-2xl bg-ink px-4 py-3 text-reversed">
        <span className="mr-auto text-sm opacity-70">{rows.length} bill{rows.length === 1 ? "" : "s"}</span>
        <span className="text-sm opacity-70">billed <b className="font-display text-[18px] opacity-100">{formatINR(billed)}</b></span>
        <span className="text-sm opacity-70">paid <b className="font-display text-[18px] opacity-100">{formatINR(paid)}</b></span>
        <span className="text-sm opacity-70">still due <b className="font-display text-[22px] opacity-100">{formatINR(billed - paid)}</b></span>
      </div>
      {canEdit && <p className="px-1 text-[11px] text-muted"><span className="md:hidden">Tap a row to open it, then tap a value to change it.</span><span className="hidden md:inline">Tap any value to change it.</span> Enter saves, Esc cancels.</p>}
    </div>
  );
}

function Row({ row: r, today, canEdit, canDelete }: { row: BillRow; today: string; canEdit: boolean; canDelete: boolean }) {
  const [open, setOpen] = useState(false);
  const due = r.amount - r.paid;
  const late = due > 0 && (r.dueOn ?? r.billDate) < today;
  return (
    <div className={`border-b border-line last:border-0 ${late ? "bg-error/5" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-baseline gap-2 p-3 text-left text-sm md:hidden"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{r.vendor}</span>
          <span className="block truncate text-[11px] text-muted">
            {[r.billNumber && `#${r.billNumber}`, day(r.billDate), r.dueOn ? `due ${day(r.dueOn)}` : null].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className="flex-none text-right">
          <span className="block font-bold">{formatINR(r.amount)}</span>
          <span className={`block text-[11px] font-semibold ${due <= 0 ? "text-success" : late ? "text-error" : "text-muted"}`}>
            {due <= 0 ? "paid" : `${formatINR(due)} due`}
          </span>
        </span>
        <span className={`flex-none text-[11px] text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">▾</span>
      </button>

      <div className={`${open ? "grid" : "hidden"} grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-3 pb-3 text-sm md:grid md:items-center md:py-2 ${COLS}`}>
              <Field label="Vendor" className="col-span-2 md:col-span-1">
                <Link href={`/admin/accounts/vendors/${r.vendorId}`} className="font-semibold underline-offset-2 hover:underline">
                  {r.vendor}
                </Link>
              </Field>

              <Field label="Bill no.">
                <Cell value={r.billNumber ?? ""} placeholder="—" readOnly={!canEdit} save={(v) => updateBillCell(r.id, "bill_number", v)} />
              </Field>

              <Field label="Date">
                <Cell kind="date" value={r.billDate} display={day(r.billDate)} readOnly={!canEdit} save={(v) => updateBillCell(r.id, "bill_date", v)} />
              </Field>

              <Field label="Due">
                <Cell kind="date" value={r.dueOn ?? ""} display={day(r.dueOn) || "—"} readOnly={!canEdit} save={(v) => updateBillCell(r.id, "due_on", v)} />
              </Field>

              <Field label="Amount" align="right">
                <Cell
                  kind="money"
                  align="right"
                  value={(r.amount / 100).toFixed(2)}
                  display={formatINR(r.amount)}
                  readOnly={!canEdit}
                  save={(v) => updateBillCell(r.id, "amount_paise", v)}
                />
              </Field>

              <Field label="GST" align="right">
                <Cell
                  kind="money"
                  align="right"
                  value={(r.gst / 100).toFixed(2)}
                  display={r.gst ? formatINR(r.gst) : "—"}
                  readOnly={!canEdit}
                  save={(v) => updateBillCell(r.id, "gst_paise", v)}
                />
              </Field>

              <Field label="Still due" align="right">
                {due <= 0 ? (
                  <span className="font-semibold text-success">Paid</span>
                ) : (
                  <span className={`font-semibold ${late ? "text-error" : ""}`}>{formatINR(due)}</span>
                )}
              </Field>

              <div className="col-span-2 flex flex-wrap items-center justify-end gap-2 md:col-span-1">
                {r.filePath ? (
                  <a href={`/files/${r.filePath}`} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-hill underline-offset-2 hover:underline">
                    invoice
                  </a>
                ) : (
                  <span className="text-[11px] text-muted">no invoice</span>
                )}
                {due > 0 && canEdit && <PayBill billId={r.id} dueInr={due / 100} />}
                {canDelete && r.paid === 0 && <DeleteCell what={`bill from ${r.vendor}`} onDelete={() => deleteBill(r.id)} />}
              </div>

      {r.updatedBy && <p className="col-span-2 text-[11px] text-muted md:col-span-8 md:-mt-1">edited by {r.updatedBy}</p>}
      </div>
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
