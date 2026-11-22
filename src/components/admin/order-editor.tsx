"use client";

import { useMemo, useState, useTransition } from "react";
import { editOrder, orderForEdit, type OrderForEdit } from "@/lib/orders/edit";
import type { MenuItem } from "@/lib/menu/types";
import { formatINR } from "@/lib/pricing";
import { VegMark } from "@/components/store/veg-mark";

type Line = {
  key: string;
  orderItemId: string | null;
  itemId: string;
  name: string;
  qty: number;
  optionIds: string[];
  addonIds: string[];
  note: string | null;
  /** The price it was sold at, while its choices are untouched. */
  soldUnitPaise: number | null;
  soldOptionIds: string[];
  soldAddonIds: string[];
};

const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

/**
 * "Edit order" for the owner or manager, for when a guest calls: change a
 * quantity, drop a dish, add one, or put an add-on on a dish. The server
 * re-prices and saves; the KOT prints again marked UPDATED.
 */
export function EditOrderButton({ orderId, dark = false }: { orderId: string; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<OrderForEdit | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const load = () =>
    start(async () => {
      setErr(null);
      const r = await orderForEdit(orderId);
      if (r.error || !r.order) return setErr(r.error ?? "Couldn't open the order.");
      setData(r.order);
      setOpen(true);
    });

  return (
    <>
      <button type="button" onClick={load} disabled={pending} className={`h-10 rounded-xl px-3 text-xs font-semibold ${dark ? "bg-paper/15" : "border border-ink"}`}>
        {pending ? "Opening…" : "Edit order"}
      </button>
      {err && !open && <span role="alert" className="text-xs font-semibold text-error">{err}</span>}
      {open && data && <Editor data={data} onClose={() => setOpen(false)} />}
    </>
  );
}

function Editor({ data, onClose }: { data: OrderForEdit; onClose: () => void }) {
  const items = useMemo(() => new Map(data.menu.flatMap((c) => c.items.map((i) => [i.id, i] as const))), [data.menu]);
  const [lines, setLines] = useState<Line[]>(() =>
    data.lines.map((l) => ({
      key: l.orderItemId, orderItemId: l.orderItemId, itemId: l.itemId, name: l.name, qty: l.qty, optionIds: l.optionIds, addonIds: l.addonIds,
      note: l.note, soldUnitPaise: l.unitPaise, soldOptionIds: l.optionIds, soldAddonIds: l.addonIds,
    })),
  );
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ summary: string; totalPaise: number; balancePaise: number } | null>(null);

  const unit = (l: Line) => {
    if (l.soldUnitPaise !== null && sameSet(l.optionIds, l.soldOptionIds) && sameSet(l.addonIds, l.soldAddonIds)) return l.soldUnitPaise;
    const m = items.get(l.itemId);
    if (!m) return l.soldUnitPaise ?? 0;
    const opt = m.optionGroups.flatMap((g) => g.choices).filter((c) => l.optionIds.includes(c.id)).reduce((n, c) => n + c.priceDeltaPaise, 0);
    const add = m.addons.filter((a) => l.addonIds.includes(a.id)).reduce((n, a) => n + a.pricePaise, 0);
    return m.pricePaise + opt + add;
  };
  const subtotal = lines.reduce((n, l) => n + unit(l) * l.qty, 0);
  const discount = data.complimentary ? subtotal : Math.min(data.discountPaise, subtotal);
  const estimate = subtotal - discount + (data.complimentary ? 0 : data.deliveryFeePaise);

  const set = (key: string, f: (l: Line) => Line) => setLines((ls) => ls.map((l) => (l.key === key ? f(l) : l)));
  const addDish = (m: MenuItem) => {
    const optionIds = m.optionGroups.filter((g) => g.required && g.choices.length).map((g) => g.choices[0].id);
    const key = "new-" + Math.random().toString(36).slice(2, 8);
    setLines((ls) => [...ls, { key, orderItemId: null, itemId: m.id, name: m.name, qty: 1, optionIds, addonIds: [], note: null, soldUnitPaise: null, soldOptionIds: [], soldAddonIds: [] }]);
    setOpenKey(m.optionGroups.length || m.addons.length ? key : null);
    setQ("");
  };
  const matches = q.trim().length < 2 ? [] : data.menu.flatMap((c) => c.items).filter((i) => i.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8);

  const save = () =>
    start(async () => {
      setErr(null);
      const r = await editOrder({ orderId: data.id, lines: lines.map((l) => ({ orderItemId: l.orderItemId, itemId: l.itemId, qty: l.qty, optionIds: l.optionIds, addonIds: l.addonIds, note: l.note })) });
      if (r.error) return setErr(r.error);
      setDone({ summary: r.summary ?? "", totalPaise: r.totalPaise ?? 0, balancePaise: r.balancePaise ?? 0 });
    });

  return (
    <div role="dialog" aria-modal="true" aria-label={`Edit order #${data.number}`} className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-0 text-ink sm:items-center sm:p-6">
      <div className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-surface sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-display text-[24px] uppercase leading-none">Edit order #{data.number}</h2>
          <button type="button" onClick={onClose} className="h-9 rounded-lg px-3 text-sm font-semibold text-muted">Close</button>
        </header>

        {done ? (
          <div className="flex flex-col gap-3 p-5">
            <p className="text-[15px] font-semibold">Saved. The kitchen gets an updated KOT.</p>
            <p className="rounded-xl bg-paper px-3 py-2 text-sm">{done.summary}</p>
            <p className="text-sm">New total <b>{formatINR(done.totalPaise)}</b></p>
            {done.balancePaise > 0 && <p className="rounded-xl bg-acid px-3 py-2 text-sm font-bold">Collect {formatINR(done.balancePaise)} extra at the door.</p>}
            {done.balancePaise < 0 && <p className="rounded-xl bg-error/15 px-3 py-2 text-sm font-bold text-error">Refund {formatINR(-done.balancePaise)} to the guest, then tap “Refund done” on the order.</p>}
            <button type="button" onClick={onClose} className="h-11 rounded-xl bg-ink text-sm font-bold text-reversed">Done</button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-3">
              <ul className="flex flex-col divide-y divide-line">
                {lines.map((l) => {
                  const m = items.get(l.itemId);
                  const optNames = m?.optionGroups.flatMap((g) => g.choices).filter((c) => l.optionIds.includes(c.id)).map((c) => c.name) ?? [];
                  const addNames = m?.addons.filter((a) => l.addonIds.includes(a.id)).map((a) => "+" + a.name) ?? [];
                  const canChange = !!m && (m.optionGroups.length > 0 || m.addons.length > 0);
                  return (
                    <li key={l.key} className="py-2.5">
                      <div className="flex items-center gap-2">
                        {m && <VegMark veg={m.isVeg} />}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{l.name} {!l.orderItemId && <span className="ml-1 rounded-full bg-acid px-1.5 py-0.5 text-[10px] font-bold uppercase">new</span>}</p>
                          {(optNames.length > 0 || addNames.length > 0) && <p className="text-xs text-clay">{[...optNames, ...addNames].join(" · ")}</p>}
                          <p className="text-xs text-muted">{formatINR(unit(l))} each</p>
                        </div>
                        <div className="flex h-9 items-center rounded-full border border-line">
                          <button type="button" aria-label={`One less ${l.name}`} onClick={() => (l.qty > 1 ? set(l.key, (x) => ({ ...x, qty: x.qty - 1 })) : setLines((ls) => ls.filter((x) => x.key !== l.key)))} className="h-9 w-9 text-lg">−</button>
                          <span className="w-6 text-center text-sm font-bold tabular-nums">{l.qty}</span>
                          <button type="button" aria-label={`One more ${l.name}`} onClick={() => set(l.key, (x) => ({ ...x, qty: Math.min(30, x.qty + 1) }))} className="h-9 w-9 text-lg">+</button>
                        </div>
                        <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="h-9 px-2 text-xs font-semibold text-error">Remove</button>
                      </div>
                      {canChange && (
                        <button type="button" onClick={() => setOpenKey(openKey === l.key ? null : l.key)} className="mt-1 text-xs font-semibold underline underline-offset-2">
                          {openKey === l.key ? "Done choosing" : "Choices & add-ons"}
                        </button>
                      )}
                      {openKey === l.key && m && (
                        <div className="mt-2 flex flex-col gap-2 rounded-xl bg-paper p-3">
                          {m.optionGroups.map((g) => (
                            <div key={g.id}>
                              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">{g.name}{g.required ? "" : " (optional)"}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {!g.required && (
                                  <Chip on={!g.choices.some((c) => l.optionIds.includes(c.id))} onClick={() => set(l.key, (x) => ({ ...x, optionIds: x.optionIds.filter((id) => !g.choices.some((c) => c.id === id)) }))}>None</Chip>
                                )}
                                {g.choices.map((c) => (
                                  <Chip key={c.id} on={l.optionIds.includes(c.id)} onClick={() => set(l.key, (x) => ({ ...x, optionIds: [...x.optionIds.filter((id) => !g.choices.some((cc) => cc.id === id)), c.id] }))}>
                                    {c.name}{c.priceDeltaPaise ? ` ${c.priceDeltaPaise > 0 ? "+" : "−"}₹${Math.abs(c.priceDeltaPaise) / 100}` : ""}
                                  </Chip>
                                ))}
                              </div>
                            </div>
                          ))}
                          {m.addons.length > 0 && (
                            <div>
                              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">Add-ons</p>
                              <div className="flex flex-wrap gap-1.5">
                                {m.addons.map((a) => (
                                  <Chip key={a.id} on={l.addonIds.includes(a.id)} onClick={() => set(l.key, (x) => ({ ...x, addonIds: x.addonIds.includes(a.id) ? x.addonIds.filter((id) => id !== a.id) : [...x.addonIds, a.id] }))}>
                                    {a.name} +₹{a.pricePaise / 100}
                                  </Chip>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>

              <div className="mt-3">
                <label htmlFor={`add-${data.id}`} className="text-[11px] font-bold uppercase tracking-wide text-muted">Add a dish</label>
                <input id={`add-${data.id}`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a dish name, e.g. roti" className="mt-1 h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm" />
                {matches.length > 0 && (
                  <ul className="mt-1 overflow-hidden rounded-xl border border-line">
                    {matches.map((m) => (
                      <li key={m.id}>
                        <button type="button" onClick={() => addDish(m)} className="flex w-full items-center gap-2 border-b border-line px-3 py-2 text-left text-sm last:border-0 hover:bg-paper">
                          <VegMark veg={m.isVeg} />
                          <span className="flex-1">{m.name}</span>
                          <span className="font-semibold">{formatINR(m.pricePaise)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <footer className="flex flex-col gap-2 border-t border-line px-5 py-3">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted">Was {formatINR(data.totalPaise)}</span>
                <span>New total about <b className="text-base">{formatINR(estimate)}</b></span>
              </div>
              {data.moneyTaken && estimate !== data.heldPaise && (
                <p className="text-xs text-muted">Already paid {formatINR(data.heldPaise)}: {estimate > data.heldPaise ? `collect about ${formatINR(estimate - data.heldPaise)} extra at the door` : `refund about ${formatINR(data.heldPaise - estimate)}`}.</p>
              )}
              {err && <p role="alert" className="text-sm font-semibold text-error">{err}</p>}
              <button type="button" disabled={pending || lines.length === 0} onClick={save} className="h-11 rounded-xl bg-clay text-sm font-bold text-ink disabled:opacity-50">
                {pending ? "Saving…" : lines.length === 0 ? "An order needs at least one dish" : "Save changes & reprint KOT"}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${on ? "border-ink bg-ink text-reversed" : "border-line bg-surface"}`}>
      {children}
    </button>
  );
}
