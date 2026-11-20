"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import type { Category, MenuItem } from "@/lib/menu/types";
import { createManualOrder } from "@/lib/orders/manual";
import { formatINR, gstOn } from "@/lib/pricing";
import { VegMark } from "@/components/store/veg-mark";
import { PropertyField } from "@/components/store/property-field";

/**
 * Billing counter for orders that don't come through the website: a phone
 * call, a walk-in, a WhatsApp message. Laid out like a POS — find the dish,
 * tap it, it lands on the bill; the bill side asks only what this order
 * needs. Prices shown here are a preview: the server prices the order again
 * from the database, exactly as it does for the website.
 */

type Line = {
  key: string;
  item: MenuItem;
  qty: number;
  optionIds: string[];
  addonIds: string[];
  note: string;
};

type Kind = "delivery" | "pickup";
type Pay = "cash" | "upi" | "collect" | "complimentary";
type Stay = "hotel" | "villa" | "homestay" | "home";

const unitPrice = (l: Pick<Line, "item" | "optionIds" | "addonIds">) => {
  const opt = l.item.optionGroups.flatMap((g) => g.choices).filter((c) => l.optionIds.includes(c.id)).reduce((n, c) => n + c.priceDeltaPaise, 0);
  const add = l.item.addons.filter((a) => l.addonIds.includes(a.id)).reduce((n, a) => n + a.pricePaise, 0);
  return l.item.pricePaise + opt + add;
};

const extras = (l: Line) =>
  [
    ...l.item.optionGroups.flatMap((g) => g.choices).filter((c) => l.optionIds.includes(c.id)).map((c) => c.name),
    ...l.item.addons.filter((a) => l.addonIds.includes(a.id)).map((a) => "+ " + a.name),
  ].join(" · ");

export function Pos({ menu, deliveryFeePaise }: { menu: Category[]; deliveryFeePaise: number }) {
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  // A dish being added that needs a required choice, or a bill line whose add-ons are being edited.
  const [picking, setPicking] = useState<{ item: MenuItem; line?: Line } | null>(null);

  const [kind, setKind] = useState<Kind>("delivery");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [stay, setStay] = useState<Stay>("hotel");
  const [propertyName, setPropertyName] = useState("");
  const [stayId, setStayId] = useState("");
  const [room, setRoom] = useState("");
  const [kitchenNote, setKitchenNote] = useState("");
  const [pay, setPay] = useState<Pay>("cash");
  const [compReason, setCompReason] = useState("");

  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [placed, setPlaced] = useState<{ id: string; number: number } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const all = useMemo(() => menu.flatMap((c) => c.items.map((i) => ({ ...i, category: c.name, catId: c.id }))), [menu]);
  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return all.filter((i) => (cat === "all" || i.catId === cat) && words.every((w) => `${i.name} ${i.category}`.toLowerCase().includes(w)));
  }, [all, cat, q]);

  const subtotal = lines.reduce((n, l) => n + unitPrice(l) * l.qty, 0);
  const gst = gstOn(subtotal);
  const fee = kind === "delivery" ? deliveryFeePaise : 0;
  const total = subtotal + gst + fee;
  const count = lines.reduce((n, l) => n + l.qty, 0);

  function add(item: MenuItem, optionIds: string[] = [], addonIds: string[] = []) {
    if (!item.available) return;
    const key = `${item.id}|${[...optionIds].sort().join(",")}|${[...addonIds].sort().join(",")}`;
    setLines((ls) => {
      const hit = ls.find((l) => l.key === key && !l.note);
      if (hit) return ls.map((l) => (l === hit ? { ...l, qty: l.qty + 1 } : l));
      return [...ls, { key, item, qty: 1, optionIds, addonIds, note: "" }];
    });
    setPlaced(null);
  }

  // Like a POS: a tap adds the dish at once. Only a required choice (bowl
  // base, fries flavour) stops to ask; add-ons go on from the bill line.
  function tap(item: MenuItem) {
    if (!item.available) return;
    if (item.optionGroups.some((g) => g.required)) setPicking({ item });
    else add(item);
  }

  function editLine(l: Line, optionIds: string[], addonIds: string[]) {
    const key = `${l.item.id}|${[...optionIds].sort().join(",")}|${[...addonIds].sort().join(",")}`;
    setLines((ls) => ls.map((x) => (x === l ? { ...x, key, optionIds, addonIds } : x)));
  }

  function setQty(l: Line, qty: number) {
    setLines((ls) => (qty <= 0 ? ls.filter((x) => x !== l) : ls.map((x) => (x === l ? { ...x, qty } : x))));
  }

  function reset() {
    setLines([]);
    setName("");
    setPhone("");
    setPropertyName("");
    setStayId("");
    setRoom("");
    setKitchenNote("");
    setPay("cash");
    setCompReason("");
    setErr(null);
    setQ("");
    searchRef.current?.focus();
  }

  function place() {
    setErr(null);
    start(async () => {
      const r = await createManualOrder({
        lines: lines.map((l) => ({ itemId: l.item.id, qty: l.qty, optionIds: l.optionIds, addonIds: l.addonIds, note: l.note })),
        name,
        phone,
        kind,
        stayType: stay,
        propertyName,
        stayId,
        roomOrLandmark: room,
        payment: kind === "pickup" && pay === "collect" ? "cash" : pay,
        compReason,
        kitchenNote,
      });
      if (r.error || !r.id) {
        setErr(r.error ?? "Couldn't place the order.");
        return;
      }
      setPlaced({ id: r.id, number: r.number! });
      setLines([]);
      setName("");
      setPhone("");
      setPropertyName("");
      setStayId("");
      setRoom("");
      setKitchenNote("");
      setPay("cash");
    setCompReason("");
    });
  }

  const input = "h-11 w-full rounded-xl border-[1.5px] border-line bg-paper px-3 text-[15px] outline-none focus:border-ink";
  const chip = (on: boolean) => `h-10 rounded-xl px-3 text-sm font-semibold ${on ? "bg-ink text-reversed" : "border-[1.5px] border-line bg-paper"}`;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* ---------------- Menu side ---------------- */}
      <section className="flex min-w-0 flex-col gap-3">
        <input
          ref={searchRef}
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && shown[0]) {
              tap(shown[0]);
              setQ("");
            }
          }}
          placeholder="Search a dish — Enter adds the first match"
          className={input}
        />
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          <button type="button" onClick={() => setCat("all")} className={`${chip(cat === "all")} flex-none`}>All</button>
          {menu.map((c) => (
            <button key={c.id} type="button" onClick={() => setCat(c.id)} className={`${chip(cat === c.id)} flex-none`}>{c.name}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {shown.map((i) => {
            const inBill = lines.filter((l) => l.item.id === i.id).reduce((n, l) => n + l.qty, 0);
            return (
              <button
                key={i.id}
                type="button"
                onClick={() => tap(i)}
                disabled={!i.available}
                className={`relative flex min-h-[84px] flex-col justify-between rounded-xl border-[1.5px] p-2.5 text-left transition-colors disabled:opacity-40 ${inBill ? "border-ink bg-acid/20" : "border-line bg-surface hover:border-ink"}`}
              >
                <span className="flex items-start gap-1.5 text-[14px] font-semibold leading-tight">
                  <VegMark veg={i.isVeg} />
                  <span>{i.name}</span>
                </span>
                <span className="mt-1 flex items-baseline justify-between text-[12px] text-muted">
                  <span className="truncate">{cat === "all" ? i.category : ""}</span>
                  <span className="font-bold text-ink">{i.available ? formatINR(i.pricePaise) : "Sold out"}</span>
                </span>
                {inBill > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-ink px-1.5 text-[12px] font-bold text-reversed">{inBill}</span>
                )}
              </button>
            );
          })}
          {shown.length === 0 && <p className="col-span-full rounded-xl bg-surface p-6 text-center text-muted">No dish matches “{q}”.</p>}
        </div>
      </section>

      {/* ---------------- Bill side ---------------- */}
      <aside className="flex flex-col gap-3 lg:sticky lg:top-4 lg:self-start">
        {placed && (
          <div className="rounded-2xl bg-success p-4 text-reversed">
            <p className="font-display text-[24px] uppercase leading-none">Order #{placed.number} placed</p>
            <p className="mt-1 text-sm opacity-90">It&apos;s on the kitchen screen now.</p>
            <div className="mt-3 flex gap-2">
              <a href={`/kitchen/kot/${placed.id}?auto=1`} target="_blank" rel="noreferrer" className="h-10 rounded-xl bg-paper px-3 text-sm font-bold leading-10 text-ink">Print KOT</a>
              <button type="button" onClick={() => { setPlaced(null); reset(); }} className="h-10 rounded-xl border-[1.5px] border-paper px-3 text-sm font-bold">Next order</button>
            </div>
          </div>
        )}

        <div className="rounded-2xl bg-surface p-3">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-display text-[20px] uppercase">Bill</h2>
            {lines.length > 0 && <button type="button" onClick={() => setLines([])} className="text-[13px] font-semibold text-muted underline-offset-2 hover:underline">Clear</button>}
          </div>
          {lines.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Tap a dish to add it.</p>
          ) : (
            <ul className="flex flex-col">
              {lines.map((l) => (
                <li key={l.key + l.note} className="border-b border-line py-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-[14px] font-semibold leading-tight"><VegMark veg={l.item.isVeg} /><span className="truncate">{l.item.name}</span></p>
                      {extras(l) && <p className="text-[12px] text-clay">{extras(l)}</p>}
                      {(l.item.addons.length > 0 || l.item.optionGroups.length > 0) && (
                        <button type="button" onClick={() => setPicking({ item: l.item, line: l })} className="text-[12px] font-semibold text-muted underline-offset-2 hover:underline">
                          {l.item.addons.length > 0 ? "+ add-ons" : "change choice"}
                        </button>
                      )}
                    </div>
                    <div className="flex flex-none items-center rounded-lg border border-line">
                      <button type="button" onClick={() => setQty(l, l.qty - 1)} className="h-8 w-8 text-lg leading-none" aria-label="One less">−</button>
                      <span className="w-6 text-center text-sm font-bold">{l.qty}</span>
                      <button type="button" onClick={() => setQty(l, l.qty + 1)} className="h-8 w-8 text-lg leading-none" aria-label="One more">+</button>
                    </div>
                    <span className="w-16 flex-none text-right text-sm font-semibold">{formatINR(unitPrice(l) * l.qty)}</span>
                  </div>
                  <input
                    value={l.note}
                    onChange={(e) => setLines((ls) => ls.map((x) => (x === l ? { ...x, note: e.target.value } : x)))}
                    placeholder="note for the kitchen (less spicy…)"
                    className="mt-1 h-8 w-full rounded-lg bg-paper px-2 text-[12px] outline-none placeholder:text-muted/70"
                  />
                </li>
              ))}
            </ul>
          )}
          {lines.length > 0 && (
            <dl className="mt-2 flex flex-col gap-0.5 text-sm">
              <Row k={`Items (${count})`} v={formatINR(subtotal)} />
              {gst > 0 && <Row k="GST 5%" v={formatINR(gst)} />}
              {fee > 0 && <Row k="Delivery" v={formatINR(fee)} />}
              <Row k="Total" v={pay === "complimentary" ? "₹0 · complimentary" : formatINR(total, { decimals: true })} strong />
            </dl>
          )}
        </div>

        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-3">
          <div className="grid grid-cols-2 gap-1.5">
            <button type="button" onClick={() => setKind("delivery")} className={chip(kind === "delivery")}>Delivery</button>
            <button type="button" onClick={() => { setKind("pickup"); if (pay === "collect") setPay("cash"); }} className={chip(kind === "pickup")}>Pickup / walk-in</button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest name" className={input} />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(-10))}
              inputMode="numeric"
              placeholder={kind === "delivery" ? "Mobile (needed)" : "Mobile (optional)"}
              className={input}
            />
          </div>
          {kind === "delivery" && (
            <>
              <div className="grid grid-cols-4 gap-1">
                {(["hotel", "villa", "homestay", "home"] as Stay[]).map((s) => (
                  <button key={s} type="button" onClick={() => { setStay(s); if (s === "home") setStayId(""); }} className={`h-9 rounded-lg text-[12px] font-semibold capitalize ${stay === s ? "bg-ink text-reversed" : "border border-line bg-paper"}`}>{s}</button>
                ))}
              </div>
              <PropertyField
                id="pos-prop"
                value={propertyName}
                stayId={stayId}
                onChange={(n, sid) => { setPropertyName(n); setStayId(sid); }}
                suggest={stay !== "home"}
                placeholder={stay === "home" ? "Area / landmark" : "Hotel — start typing"}
                className={input}
              />
              <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Room no. or landmark" className={input} />
            </>
          )}
          <input value={kitchenNote} onChange={(e) => setKitchenNote(e.target.value)} placeholder="Note for the whole order (optional)" className={input} />
        </div>

        <div className="rounded-2xl bg-surface p-3">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">Payment</p>
          <div className="grid grid-cols-2 gap-1.5">
            <button type="button" onClick={() => setPay("cash")} className={chip(pay === "cash")}>Cash paid</button>
            <button type="button" onClick={() => setPay("upi")} className={chip(pay === "upi")}>UPI paid</button>
            {kind === "delivery" && <button type="button" onClick={() => setPay("collect")} className={chip(pay === "collect")}>Collect at door</button>}
            <button type="button" onClick={() => setPay("complimentary")} className={chip(pay === "complimentary")}>Complimentary</button>
          </div>
          {pay === "complimentary" && (
            <input value={compReason} onChange={(e) => setCompReason(e.target.value)} placeholder="Who is it for, and why? (needed)" className={`${input} mt-1.5`} />
          )}
          <p className="mt-1.5 text-[12px] text-muted">
            {pay === "collect"
              ? "The rider collects it; it shows as To collect until they mark it."
              : pay === "complimentary"
                ? "Free for the guest. The food still comes off stock; Day Close shows what was given away."
                : "Money already in hand — it goes straight into the cash book."}
          </p>
        </div>

        {err && <p role="alert" className="rounded-xl bg-error/10 px-3 py-2 text-sm font-semibold text-error">{err}</p>}
        <button
          type="button"
          onClick={place}
          disabled={pending || lines.length === 0}
          className="h-14 rounded-2xl bg-clay text-[17px] font-bold text-ink disabled:opacity-40"
        >
          {pending ? "Placing…" : lines.length ? `Place order · ${formatINR(total, { decimals: true })}` : "Place order"}
        </button>
      </aside>

      {picking && (
        <Picker
          item={picking.item}
          initialOptions={picking.line?.optionIds}
          initialAddons={picking.line?.addonIds}
          cta={picking.line ? "Update" : "Add to bill"}
          onClose={() => setPicking(null)}
          onAdd={(o, a) => {
            if (picking.line) editLine(picking.line, o, a);
            else add(picking.item, o, a);
            setPicking(null);
            searchRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}

function Row({ k, v, strong = false }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "mt-1 border-t border-line pt-1.5 text-[16px] font-bold" : "text-muted"}`}>
      <dt>{k}</dt>
      <dd className={strong ? "" : "text-ink"}>{v}</dd>
    </div>
  );
}

/** Choices and add-ons for one dish. Required groups start on their first choice. */
function Picker({
  item,
  onClose,
  onAdd,
  initialOptions,
  initialAddons,
  cta,
}: {
  item: MenuItem;
  onClose: () => void;
  onAdd: (optionIds: string[], addonIds: string[]) => void;
  initialOptions?: string[];
  initialAddons?: string[];
  cta: string;
}) {
  const [sel, setSel] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      item.optionGroups
        .map((g) => [g.id, g.choices.find((c) => initialOptions?.includes(c.id))?.id ?? (g.required ? g.choices[0]?.id : undefined)] as const)
        .filter((x): x is readonly [string, string] => Boolean(x[1])),
    ),
  );
  const [adds, setAdds] = useState<string[]>(initialAddons ?? []);
  const missing = item.optionGroups.some((g) => g.required && !sel[g.id]);
  const price = item.pricePaise
    + item.optionGroups.flatMap((g) => g.choices).filter((c) => Object.values(sel).includes(c.id)).reduce((n, c) => n + c.priceDeltaPaise, 0)
    + item.addons.filter((a) => adds.includes(a.id)).reduce((n, a) => n + a.pricePaise, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-3 sm:items-center"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); if (e.key === "Enter" && !missing) onAdd(Object.values(sel), adds); }}
      tabIndex={-1}
      ref={(el) => el?.focus()}
    >
      <div className="w-full max-w-md rounded-2xl bg-paper p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-center gap-1.5 text-[18px] font-bold"><VegMark veg={item.isVeg} />{item.name}</p>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-muted">Close</button>
        </div>
        {item.optionGroups.map((g) => (
          <div key={g.id} className="mt-3">
            <p className="mb-1 text-[12px] font-bold uppercase tracking-wide text-muted">{g.name}{g.required ? "" : " (optional)"}</p>
            <div className="flex flex-wrap gap-1.5">
              {g.choices.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSel((s) => (s[g.id] === c.id && !g.required ? Object.fromEntries(Object.entries(s).filter(([k]) => k !== g.id)) : { ...s, [g.id]: c.id }))}
                  className={`h-10 rounded-xl px-3 text-sm font-semibold ${sel[g.id] === c.id ? "bg-ink text-reversed" : "border-[1.5px] border-line bg-surface"}`}
                >
                  {c.name}{c.priceDeltaPaise ? ` +${formatINR(c.priceDeltaPaise)}` : ""}
                </button>
              ))}
            </div>
          </div>
        ))}
        {item.addons.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 text-[12px] font-bold uppercase tracking-wide text-muted">Add-ons</p>
            <div className="flex flex-wrap gap-1.5">
              {item.addons.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAdds((x) => (x.includes(a.id) ? x.filter((y) => y !== a.id) : [...x, a.id]))}
                  className={`h-10 rounded-xl px-3 text-sm font-semibold ${adds.includes(a.id) ? "bg-ink text-reversed" : "border-[1.5px] border-line bg-surface"}`}
                >
                  + {a.name} {formatINR(a.pricePaise)}
                </button>
              ))}
            </div>
          </div>
        )}
        <button
          type="button"
          disabled={missing}
          onClick={() => onAdd(Object.values(sel), adds)}
          className="mt-4 h-12 w-full rounded-xl bg-clay font-bold text-ink disabled:opacity-40"
        >
          {cta} · {formatINR(price)}
        </button>
      </div>
    </div>
  );
}
