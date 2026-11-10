"use client";

import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/hooks/use-cart";
import { formatINR, gstOn } from "@/lib/pricing";
import { CouponField, type Applied } from "@/components/store/coupon-field";
import { ClosedNotice, useServiceOpen } from "@/components/store/service-gate";
import { LocationPin, type Pin } from "./location-pin";
import { VegMark } from "./veg-mark";

type Stay = "hotel" | "villa" | "homestay" | "home";
const STAYS: { id: Stay; label: string }[] = [
  { id: "hotel", label: "Hotel" },
  { id: "villa", label: "Villa" },
  { id: "homestay", label: "Homestay" },
  { id: "home", label: "Home" },
];

type CashfreeCheckoutResult = { error?: { message?: string }; redirect?: boolean; paymentDetails?: { paymentMessage?: string } };
type CashfreeInstance = { checkout: (opts: Record<string, unknown>) => Promise<CashfreeCheckoutResult> };

declare global {
  interface Window {
    Cashfree?: (opts: { mode: "sandbox" | "production" }) => CashfreeInstance;
  }
}

export function CheckoutScreen({ deliveryFeePaise, sourceRef, staffName }: { deliveryFeePaise: number; sourceRef?: string; staffName?: string | null }) {
  const cart = useCart();
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const open = useServiceOpen();
  const [stay, setStay] = useState<Stay>("hotel");
  const [propertyName, setPropertyName] = useState("");
  const [room, setRoom] = useState("");
  const [pin, setPin] = useState<Pin>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coupon, setCoupon] = useState<Applied>(null);

  // GST is charged on what is actually paid for the food, so the discount comes
  // off first. The server works this out again before taking any money.
  const discount = coupon?.discountPaise ?? 0;
  const gst = gstOn(cart.subtotalPaise - discount);
  const total = cart.subtotalPaise - discount + gst + deliveryFeePaise;
  const shut = open === false;
  const valid = name.trim().length >= 2 && /^[6-9]\d{9}$/.test(phone) && cart.lines.length > 0 && !shut;

  async function pay(demo = false) {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, phone, altPhone, stayType: stay, propertyName, roomOrLandmark: room, notes, sourceRef,
          couponCode: coupon?.code ?? "",
          ...(demo ? { demo: true } : {}),
          ...(pin ? { lat: pin.lat, lng: pin.lng } : {}),
          lat: pin?.lat, lng: pin?.lng,
          lines: cart.lines.map((l) => ({ itemId: l.itemId, qty: l.qty, optionIds: l.options.map((o) => o.optionId), addonIds: l.addons.map((a) => a.addonId), note: l.note ?? "" })),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? "Couldn't place the order");
      const d = json.data as { code: string; number: number; amountPaise: number; paymentSessionId: string; mode: "sandbox" | "production"; demo?: boolean };

      // A demo order is already paid on the server; there is no gateway step.
      if (d.demo) {
        cart.clear();
        router.push(`/o/${d.code}`);
        return;
      }
      if (!window.Cashfree) throw new Error("Payment page didn't load. Check your connection and try again.");
      const cashfree = window.Cashfree({ mode: d.mode });
      const result = await cashfree.checkout({ paymentSessionId: d.paymentSessionId, redirectTarget: "_modal" });

      // Three outcomes: an error or a dismissed modal, a failed payment, or done.
      // Whatever it says, the money is only real once our server has checked.
      if (result?.error) {
        setError("Payment wasn't completed. You can try again.");
        setBusy(false);
        return;
      }
      const v = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: d.code }),
      });
      const vj = await v.json();
      if (vj.ok && vj.data?.status === "paid") {
        cart.clear();
        router.push(`/o/${d.code}`);
      } else {
        cart.clear();
        router.push(`/o/${d.code}`); // the order page polls and the webhook will land
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  const input = "h-[50px] rounded-xl border-[1.5px] border-line bg-surface px-3.5 text-base";
  const label = "text-[13px] font-semibold";

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-paper px-5 pb-36 pt-4">
      <Script src="https://sdk.cashfree.com/js/v3/cashfree.js" strategy="afterInteractive" />
      <div className="flex items-center gap-3">
        <Link href="/" aria-label="Back to menu" className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-surface">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
        </Link>
        <h1 className="font-display text-[30px] uppercase tracking-wide">Your order</h1>
      </div>

      <section className="mt-4 rounded-[18px] bg-surface px-4 py-1.5">
        {cart.ready && cart.lines.length === 0 && <p className="py-6 text-center text-muted">Your bag is empty.</p>}
        {cart.lines.map((l) => (
          <div key={l.key} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
            <VegMark veg={l.isVeg} />
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-semibold">{l.name}</span>
              {(l.options.length > 0 || l.addons.length > 0 || l.note) && (
                <span className="text-xs text-muted">{[...l.options.map((o) => o.name), ...l.addons.map((a) => a.name), l.note].filter(Boolean).join(" · ")}</span>
              )}
            </div>
            <div className="flex h-9 items-center rounded-full border-[1.5px] border-ink">
              <button type="button" onClick={() => cart.setQty(l.key, l.qty - 1)} aria-label="One less" className="h-9 w-8 text-lg">−</button>
              <span className="text-sm font-bold">{l.qty}</span>
              <button type="button" onClick={() => cart.setQty(l.key, l.qty + 1)} aria-label="One more" className="h-9 w-8 text-lg">+</button>
            </div>
            <span className="min-w-11 text-right text-[15px] font-bold">{formatINR(l.unitPaise * l.qty)}</span>
          </div>
        ))}
        <Link href="/" className="flex h-12 items-center text-sm font-semibold">+ Add more items</Link>
      </section>

      <section className="mt-5 flex flex-col gap-3.5">
        <h2 className="font-display text-[20px] uppercase tracking-wide">Where do we bring it?</h2>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className={label}>Your name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={input} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="wa" className={label}>WhatsApp number</label>
          <div className="flex h-[50px] overflow-hidden rounded-xl border-[1.5px] border-line bg-surface">
            <span className="flex items-center border-r border-line px-3 text-base font-semibold">+91</span>
            <input id="wa" inputMode="numeric" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit number" className="flex-1 bg-transparent px-3 text-base" />
          </div>
          <span className="text-xs text-hill">Your confirmation and live updates arrive here.</span>
        </div>
        {/* Mount Abu has real dead spots — inside the older hotels, down
            towards Gaumukh. A rider at the gate with one unreachable number
            is the commonest way a delivery goes wrong here. */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="alt" className={label}>
            Another number <span className="font-normal text-muted">(optional)</span>
          </label>
          <div className="flex h-[50px] overflow-hidden rounded-xl border-[1.5px] border-line bg-surface">
            <span className="flex items-center border-r border-line px-3 text-base font-semibold">+91</span>
            <input
              id="alt"
              inputMode="numeric"
              autoComplete="tel-national"
              value={altPhone}
              onChange={(e) => setAltPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="10-digit number"
              className="flex-1 bg-transparent px-3 text-base"
            />
          </div>
          <span className="text-xs text-hill">
            Please give a number with working network and WhatsApp — the signal drops in parts of Mount Abu, and our rider
            will try this one if yours doesn&apos;t ring.
          </span>
        </div>
        <fieldset>
          <legend className={`${label} mb-2`}>Staying at</legend>
          <div className="grid grid-cols-4 gap-2">
            {STAYS.map((s) => (
              <button key={s.id} type="button" onClick={() => setStay(s.id)} aria-pressed={stay === s.id} className={`h-11 rounded-xl text-[13px] font-semibold ${stay === s.id ? "border-2 border-ink bg-ink text-reversed" : "border-[1.5px] border-line bg-surface"}`}>
                {s.label}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="prop" className={label}>{stay === "home" ? "Area / society" : "Hotel / property name"}</label>
          <input id="prop" value={propertyName} onChange={(e) => setPropertyName(e.target.value)} placeholder={stay === "home" ? "e.g. near Nakki Lake" : "the name on your booking"} className={input} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="room" className={label}>Room no. or landmark</label>
          <input id="room" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Room 204 / near the gate" className={input} />
        </div>
        <LocationPin value={pin} onChange={setPin} />

        <div>
          <label htmlFor="notes" className={label}>Delivery note <span className="font-normal text-muted">(optional)</span></label>
          <input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} placeholder="Call on arrival, leave at reception…" className={input} />
        </div>
      </section>

      <ClosedNotice />

      <section className="mt-5">
        <CouponField subtotalPaise={cart.subtotalPaise} phone={phone} applied={coupon} onChange={setCoupon} />
      </section>

      <section className="mt-5 flex flex-col gap-2.5 rounded-[18px] bg-surface p-4 text-sm">
        <div className="flex justify-between"><span className="text-muted">Item total</span><span>{formatINR(cart.subtotalPaise, { decimals: true })}</span></div>
        {discount > 0 && (
          <div className="flex justify-between text-success"><span>Coupon {coupon?.code}</span><span>−{formatINR(discount, { decimals: true })}</span></div>
        )}
        {gst > 0 && <div className="flex justify-between"><span className="text-muted">GST 5%</span><span>{formatINR(gst, { decimals: true })}</span></div>}
        <div className="flex justify-between"><span className="text-muted">Delivery</span><span>{deliveryFeePaise ? formatINR(deliveryFeePaise) : "Free"}</span></div>
        <div className="h-px bg-line" />
        <div className="flex justify-between text-base font-bold"><span>To pay</span><span>{formatINR(total, { decimals: true })}</span></div>
      </section>

      {error && <p role="alert" className="mt-3 rounded-xl bg-error/10 px-4 py-3 text-sm font-semibold text-error">{error}</p>}

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-line bg-paper px-3 pb-5 pt-3">
        <button type="button" onClick={() => pay(false)} disabled={!valid || busy} className="flex h-[60px] w-full flex-col items-center justify-center rounded-[18px] bg-clay text-ink disabled:opacity-50">
          <span className="text-[17px] font-bold">
            {shut ? "Closed right now" : busy ? "Opening payment…" : `Pay ${formatINR(total, { decimals: true })}`}
          </span>
          <span className="text-xs font-medium">
            {shut ? "We'll take your order when we open" : "UPI · Card · Netbanking — secured by Cashfree"}
          </span>
        </button>

        {/* Staff only, and only visible because someone is signed in on this
            device. Walks the whole path — ticket, kitchen, rider — with no
            money and no gateway. The order is marked as a demo, so it never
            reaches sales, costing or the indent. */}
        {staffName && (
          <button
            type="button"
            onClick={() => pay(true)}
            disabled={!valid || busy}
            className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-ink text-sm font-bold disabled:opacity-50"
          >
            {busy ? "Placing…" : "Place as demo — no payment"}
            <span className="text-xs font-medium text-muted">({staffName})</span>
          </button>
        )}
      </div>
    </div>
  );
}
