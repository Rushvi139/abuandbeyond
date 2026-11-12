"use client";

import { useState, useTransition } from "react";
import { addExpense, addVendorBill, addVendorPayment } from "@/lib/admin/accounts-actions";

const inp = "h-10 rounded-xl border border-line bg-paper px-3 text-sm";
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const MODES = ["UPI", "Cash", "Bank", "Card"];

export type IngredientOption = { id: string; name: string; unit: string };

/**
 * Handles a complaint returned as data as well as one thrown. Production Next
 * swallows a thrown message, so anything the person needs to read — which
 * file type to use, how big it may be — comes back in `error` instead.
 */
function useSubmit(action: (fd: FormData) => Promise<{ error?: string } | void>, formId: string) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const act = (fd: FormData) =>
    start(async () => {
      setErr(null);
      try {
        const r = await action(fd);
        if (r && r.error) { setErr(r.error); return; }
        setOk(true);
        (document.getElementById(formId) as HTMLFormElement | null)?.reset();
        setTimeout(() => setOk(false), 1500);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  return { pending, err, ok, act };
}

export function ExpenseForm({
  categories,
  vendors,
  ingredients = [],
}: {
  categories: { id: string; name: string }[];
  vendors: string[];
  ingredients?: IngredientOption[];
}) {
  const { pending, err, ok, act } = useSubmit(addExpense, "eform");
  const [ingredientId, setIngredientId] = useState("");
  const selectedIngredient = ingredients.find((i) => i.id === ingredientId);
  return (
    <form id="eform" action={act} className="grid gap-2 rounded-2xl bg-surface p-4 sm:grid-cols-2">
      <input name="spentOn" type="date" required defaultValue={today()} className={inp} />
      <select name="category" required className={inp}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <input name="description" required placeholder="What was it for" className={`${inp} sm:col-span-2`} />
      <input name="amountInr" type="number" step="0.01" min="0.01" required placeholder="Amount ₹" className={inp} />
      <select name="mode" className={inp}><option value="">Paid by…</option>{MODES.map((m) => <option key={m}>{m}</option>)}</select>
      <input name="vendor" list="vendors" placeholder="Paid to (optional)" className={inp} />
      <datalist id="vendors">{vendors.map((v) => <option key={v} value={v} />)}</datalist>
      <input name="reference" placeholder="UTR / ref (optional)" className={inp} />

      {/* Stock link — optional. If this expense brought in an ingredient, pick it here
          and the system auto-creates a stock_movement so the balance stays accurate. */}
      {ingredients.length > 0 && (
        <div className="sm:col-span-2 rounded-xl border border-line bg-paper p-3 flex flex-col gap-2">
          <p className="text-[11px] uppercase tracking-wide text-muted font-semibold">Stock update (optional)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <input type="hidden" name="ingredientId" value={ingredientId} />
              <select
                className={inp + " w-full"}
                value={ingredientId}
                onChange={(e) => setIngredientId(e.target.value)}
              >
                <option value="">Not a stock item</option>
                {ingredients.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <input
                name="quantity"
                type="number"
                step="0.001"
                min="0.001"
                placeholder={selectedIngredient ? `Qty in ${selectedIngredient.unit}` : "Quantity"}
                disabled={!ingredientId}
                className={inp + " w-full pr-14 disabled:opacity-40"}
              />
              {selectedIngredient && (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
                  {selectedIngredient.unit}
                </span>
              )}
            </div>
          </div>
          {ingredientId && (
            <p className="text-[11px] text-muted">
              Stock will be credited automatically when you save.
            </p>
          )}
        </div>
      )}

      <label className="flex items-center gap-2 text-xs text-muted sm:col-span-2">
        Slip or receipt
        <input name="attachment" type="file" accept="image/*,application/pdf" className="min-w-0 flex-1 text-xs" />
      </label>
      {err && <p className="text-xs font-semibold text-error sm:col-span-2">{err}</p>}
      <button type="submit" disabled={pending} className="h-10 rounded-xl bg-ink text-sm font-semibold text-reversed disabled:opacity-50 sm:col-span-2">{ok ? "Added" : pending ? "Saving…" : "Add expense"}</button>
    </form>
  );
}

export function BillForm({ vendors }: { vendors: string[] }) {
  const { pending, err, ok, act } = useSubmit(addVendorBill, "bform");
  const [paidNow, setPaidNow] = useState(false);
  return (
    <form id="bform" action={act} className="grid gap-2 rounded-2xl bg-surface p-4 sm:grid-cols-2">
      <input name="vendor" list="vendors2" required placeholder="Vendor (e.g. Khandelwal Distributors)" className={`${inp} sm:col-span-2`} />
      <datalist id="vendors2">{vendors.map((v) => <option key={v} value={v} />)}</datalist>
      <input name="billNumber" placeholder="Bill / invoice no." className={inp} />
      <input name="billDate" type="date" required defaultValue={today()} className={inp} />
      <input name="amountInr" type="number" step="0.01" min="0.01" required placeholder="Total ₹ (incl. GST)" className={inp} />
      <input name="gstInr" type="number" step="0.01" min="0" placeholder="of which GST ₹" className={inp} />
      <input name="dueOn" type="date" className={inp} />
      <label className="flex items-center gap-2 text-xs text-muted">
        Invoice
        <input name="attachment" type="file" accept="image/*,application/pdf" className="min-w-0 flex-1 text-xs" />
      </label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="paidNow" value="1" checked={paidNow} onChange={(e) => setPaidNow(e.target.checked)} className="accent-clay" /> Paid in full now</label>
      {paidNow && (
        <>
          <select name="mode" className={inp}><option value="">Paid by…</option>{MODES.map((m) => <option key={m}>{m}</option>)}</select>
          <input name="reference" placeholder="UTR / ref" className={inp} />
        </>
      )}
      {err && <p className="text-xs font-semibold text-error sm:col-span-2">{err}</p>}
      <button type="submit" disabled={pending} className="h-10 rounded-xl bg-ink text-sm font-semibold text-reversed disabled:opacity-50 sm:col-span-2">{ok ? "Saved" : pending ? "Saving…" : "Add bill"}</button>
    </form>
  );
}

export function PayBill({ billId, dueInr }: { billId: string; dueInr: number }) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="h-7 rounded-lg bg-ink px-2.5 text-xs font-semibold text-reversed">Record payment</button>;
  return (
    <form
      action={(fd) =>
        start(async () => {
          setErr(null);
          try {
            const r = await addVendorPayment(fd);
            if (r?.error) setErr(r.error);
            else setOpen(false);
          } catch {
            setErr("Couldn't save that payment.");
          }
        })
      }
      className="flex w-full flex-wrap gap-1.5 pt-1"
    >
      <input type="hidden" name="billId" value={billId} />
      <input name="paidOn" type="date" required defaultValue={today()} className="h-8 rounded-lg border border-line bg-paper px-2 text-xs" />
      <input name="amountInr" type="number" step="0.01" min="0.01" required defaultValue={dueInr} className="h-8 w-24 rounded-lg border border-line bg-paper px-2 text-xs" />
      <select name="mode" className="h-8 rounded-lg border border-line bg-paper px-1 text-xs"><option value="">Mode</option>{MODES.map((m) => <option key={m}>{m}</option>)}</select>
      <input name="reference" placeholder="UTR" className="h-8 w-24 rounded-lg border border-line bg-paper px-2 text-xs" />
      <button type="submit" disabled={pending} className="h-8 rounded-lg bg-success px-2.5 text-xs font-semibold text-reversed disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
      <button type="button" onClick={() => { setOpen(false); setErr(null); }} className="h-8 px-2 text-xs text-muted">Cancel</button>
      {err && <p role="alert" className="w-full text-xs font-semibold text-error">{err}</p>}
    </form>
  );
}
