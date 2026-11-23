"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { addSpend } from "@/lib/admin/spend-actions";
import { formatINR } from "@/lib/pricing";

export type SpendCategory = { id: string; name: string; hasItems: boolean };
export type SpendIngredient = { id: string; name: string; unit: string; ratePaisePerUnit: number };
export type RecentList = { paidTo: string; on: string; lines: { ingredientId: string | null; name: string; qty: number; amountInr: number }[] };

type Line = { key: number; ingredientId: string; name: string; qty: string; amount: string; newUnit: "g" | "ml" | "pc" | "" };
type Pay = "cash" | "saraspur" | "hdfc" | "credit";
const PAY_LABEL: Record<Exclude<Pay, "credit">, string> = { cash: "cash from orders", saraspur: "Saraspur", hdfc: "HDFC" };

/** What a person types the quantity in: kg for gram items, L for ml items. */
const SHOW_UNIT: Record<string, string> = { g: "kg", ml: "L", pc: "pc" };
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
let seq = 1;
const blank = (): Line => ({ key: seq++, ingredientId: "", name: "", qty: "", amount: "", newUnit: "g" });

/**
 * One form for every rupee that goes out. Category first, then what was
 * bought (item lines for Kitchen and Disposables, a line of text for the
 * rest), then how it was paid. The last line before Save says exactly where
 * it will be recorded, so nobody has to know the difference between an
 * expense and a vendor bill.
 */
export function SpendForm({
  categories,
  vendors,
  ingredients,
  staffNames,
  recent = [],
  defaultPay = "cash",
}: {
  categories: SpendCategory[];
  vendors: string[];
  ingredients: SpendIngredient[];
  staffNames: string[];
  recent?: RecentList[];
  defaultPay?: Pay;
}) {
  const [spentOn, setSpentOn] = useState(today());
  const [category, setCategory] = useState(categories[0]?.id ?? "");
  const [staffName, setStaffName] = useState("");
  const [paidTo, setPaidTo] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [pay, setPay] = useState<Pay>(defaultPay);
  const [billNumber, setBillNumber] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const cat = categories.find((c) => c.id === category);
  const itemised = Boolean(cat?.hasItems);
  const isStaff = category === "salaries";
  const byName = useMemo(() => new Map(ingredients.map((i) => [i.name.toLowerCase(), i])), [ingredients]);
  const filled = lines.filter((l) => l.name.trim() && Number(l.amount) > 0);
  const total = itemised && filled.length ? filled.reduce((n, l) => n + Math.round(Number(l.amount) * 100), 0) : Math.round(Number(amount || 0) * 100);
  const last = recent.find((r) => r.paidTo.toLowerCase() === paidTo.trim().toLowerCase()) ?? (paidTo ? null : recent[0]);

  function setLine(key: number, patch: Partial<Line>) {
    setLines((ls) => {
      const next = ls.map((l) => {
        if (l.key !== key) return l;
        const m = { ...l, ...patch };
        if (patch.name !== undefined) {
          const ing = byName.get(patch.name.trim().toLowerCase());
          m.ingredientId = ing?.id ?? "";
        }
        return m;
      });
      // Always one empty row at the bottom, so adding an item is just typing.
      const end = next[next.length - 1];
      return end && (end.name || end.qty || end.amount) ? [...next, blank()] : next;
    });
  }

  function repeat(r: RecentList) {
    setPaidTo(r.paidTo);
    setLines([
      ...r.lines.map((l) => ({ key: seq++, ingredientId: l.ingredientId ?? "", name: l.name, qty: String(l.qty), amount: String(l.amountInr), newUnit: "" as const })),
      blank(),
    ]);
  }

  function reset() {
    setStaffName(""); setPaidTo(""); setDescription(""); setAmount(""); setLines([blank()]);
    setBillNumber(""); setDueOn(""); setNote(""); setPay(defaultPay);
    if (fileRef.current) fileRef.current.value = "";
  }

  function save() {
    setErr(null);
    setDone(null);
    const payload = {
      spentOn, category, staffName: isStaff ? staffName : "", paidTo, description,
      amountInr: itemised && filled.length ? undefined : Number(amount || 0),
      lines: itemised ? filled.map((l) => ({ ingredientId: l.ingredientId, name: l.name.trim(), qty: Number(l.qty) || 1, amountInr: Number(l.amount), ...(!l.ingredientId && l.newUnit ? { newUnit: l.newUnit } : {}) })) : [],
      pay, billNumber, dueOn, note,
    };
    const fd = new FormData();
    fd.set("payload", JSON.stringify(payload));
    for (const f of Array.from(fileRef.current?.files ?? [])) fd.append("attachment", f);
    start(async () => {
      const r = await addSpend(fd).catch(() => ({ error: "Didn't save. Check your connection and try again." }));
      if ("error" in r && r.error) return setErr(r.error);
      setDone(
        pay === "credit"
          ? `Saved: ${formatINR(total)} owed to ${paidTo}. It's under Vendor bills until it's paid.`
          : `Saved: ${formatINR(total)} paid from ${PAY_LABEL[pay]}, under Expenses.`,
      );
      reset();
    });
  }

  const input = "h-11 w-full rounded-xl border-[1.5px] border-line bg-paper px-3 text-[15px] outline-none focus:border-ink";
  const chip = (on: boolean) => `h-10 rounded-xl px-3 text-sm font-semibold ${on ? "bg-ink text-reversed" : "border-[1.5px] border-line bg-paper"}`;

  return (
    <div className="flex flex-col gap-3">
      <datalist id="spend-vendors">{vendors.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="spend-items">{ingredients.map((i) => <option key={i.id} value={i.name} />)}</datalist>
      <datalist id="spend-staff">{staffNames.map((n) => <option key={n} value={n} />)}</datalist>

      {/* 1. What for */}
      <section className="rounded-2xl bg-surface p-3">
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">1 · What for</p>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button key={c.id} type="button" onClick={() => setCategory(c.id)} className={chip(category === c.id)}>{c.name}</button>
          ))}
        </div>
        {isStaff && (
          <input value={staffName} onChange={(e) => setStaffName(e.target.value)} list="spend-staff" placeholder="Which staff member? (salary, advance…)" className={`${input} mt-2`} />
        )}
      </section>

      {/* 2. What was bought */}
      <section className="rounded-2xl bg-surface p-3">
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">2 · {itemised ? "Items bought" : "Details"}</p>
          <input type="date" value={spentOn} max={today()} onChange={(e) => setSpentOn(e.target.value)} className="h-9 rounded-lg border border-line bg-paper px-2 text-[13px]" aria-label="Date" />
        </div>
        <input value={paidTo} onChange={(e) => setPaidTo(e.target.value)} list="spend-vendors" placeholder={pay === "credit" ? "Vendor (needed — who we owe)" : "Paid to — shop or vendor (optional)"} className={input} />

        {itemised ? (
          <>
            {last && last.lines.length > 0 && (
              <button type="button" onClick={() => repeat(last)} className="mt-2 text-[13px] font-semibold underline underline-offset-2">
                Repeat last list{last.paidTo ? ` from ${last.paidTo}` : ""} ({new Date(`${last.on}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })})
              </button>
            )}
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_5.5rem_6.5rem] gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
              <span>Item</span><span>Qty</span><span>Amount ₹</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {lines.map((l) => {
                const ing = l.ingredientId ? ingredients.find((i) => i.id === l.ingredientId) : null;
                const unit = ing ? SHOW_UNIT[ing.unit] : l.newUnit ? SHOW_UNIT[l.newUnit] : "";
                const rate = ing && Number(l.qty) > 0 && Number(l.amount) > 0 ? Number(l.amount) / Number(l.qty) : null;
                return (
                  <div key={l.key}>
                    <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_6.5rem] gap-1.5">
                      <input value={l.name} onChange={(e) => setLine(l.key, { name: e.target.value })} list="spend-items" placeholder="Tomato, milk…" className={input} />
                      <div className="relative">
                        <input value={l.qty} onChange={(e) => setLine(l.key, { qty: e.target.value })} inputMode="decimal" placeholder="Qty" className={`${input} pr-7`} />
                        {unit && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted">{unit}</span>}
                      </div>
                      <input value={l.amount} onChange={(e) => setLine(l.key, { amount: e.target.value })} inputMode="decimal" placeholder="₹" className={input} />
                    </div>
                    {l.name && (
                      <p className="mt-0.5 text-[11px] text-muted">
                        {ing ? `Stock +${l.qty || "?"} ${unit}${rate ? ` · ₹${rate.toFixed(rate < 10 ? 2 : 0)}/${unit}` : ""}` : null}
                      </p>
                    )}
                    {l.name && !ing && (
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                        New item.
                        {(["g", "ml", "pc"] as const).map((u) => (
                          <button key={u} type="button" onClick={() => setLine(l.key, { newUnit: u })} className={`rounded-md px-1.5 py-0.5 font-semibold ${l.newUnit === u ? "bg-ink text-reversed" : "bg-paper"}`}>
                            add to inventory in {SHOW_UNIT[u]}
                          </button>
                        ))}
                        <button type="button" onClick={() => setLine(l.key, { newUnit: "" })} className={`rounded-md px-1.5 py-0.5 font-semibold ${!l.newUnit ? "bg-ink text-reversed" : "bg-paper"}`}>
                          don&apos;t track stock
                        </button>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_8rem] gap-1.5">
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={isStaff ? "Salary for Nov, advance…" : "What was it for"} className={input} />
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="Amount ₹" className={input} />
          </div>
        )}
      </section>

      {/* 3. How it was paid */}
      <section className="rounded-2xl bg-surface p-3">
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">3 · Paid from</p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <button type="button" onClick={() => setPay("cash")} className={chip(pay === "cash")}>Cash from orders</button>
          <button type="button" onClick={() => setPay("saraspur")} className={chip(pay === "saraspur")}>Saraspur (UPI)</button>
          <button type="button" onClick={() => setPay("hdfc")} className={chip(pay === "hdfc")}>HDFC</button>
          <button type="button" onClick={() => setPay("credit")} className={chip(pay === "credit")}>On credit</button>
        </div>
        {pay === "credit" && (
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <input value={billNumber} onChange={(e) => setBillNumber(e.target.value)} placeholder="Bill no. (optional)" className={input} />
            <label className="flex items-center gap-1.5 text-[13px] text-muted">Due<input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} className={input} /></label>
          </div>
        )}
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className={`${input} mt-2`} />
        <label className="mt-2 flex items-center gap-2 text-[13px] text-muted">
          {pay === "credit" ? "Photos of the bill" : "Photos of the slip"}
          <input ref={fileRef} type="file" multiple accept="image/*,application/pdf" className="min-w-0 flex-1 text-xs" />
        </label>
      </section>

      <p className="rounded-xl bg-paper px-3 py-2 text-[13px]">
        {total > 0 ? (
          pay === "credit"
            ? <>Saves as <b>{formatINR(total)} owed to {paidTo || "the vendor"}</b> — under Vendor bills until you pay it.</>
            : <>Saves as <b>{formatINR(total)} paid from {PAY_LABEL[pay]}</b> — under Expenses ({cat?.name}).</>
        ) : "Fill in the amount to save."}
        {itemised && filled.some((l) => l.ingredientId || l.newUnit) && " Stock goes up for the inventory items; new ones are added to Inventory."}
      </p>
      {err && <p role="alert" className="rounded-xl bg-error/10 px-3 py-2 text-sm font-semibold text-error">{err}</p>}
      {done && <p className="rounded-xl bg-success/15 px-3 py-2 text-sm font-semibold text-success">{done}</p>}
      <button type="button" onClick={save} disabled={pending || total <= 0} className="h-12 rounded-xl bg-ink text-[15px] font-bold text-reversed disabled:opacity-40">
        {pending ? "Saving…" : `Save · ${formatINR(total)}`}
      </button>
    </div>
  );
}
