"use client";

import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/hooks/use-cart";
import { formatINR, gstOn } from "@/lib/pricing";
import { VegMark } from "./veg-mark";

type Stay = "hotel" | "villa" | "homestay" | "home";
const STAYS: { id: Stay; label: string }[] = [
  { id: "hotel", label: "Hotel" },
  { id: "villa", label: "Villa" },
  { id: "homestay", label: "Homestay" },
  { id: "home", label: "Home" },
];

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (ev: string, cb: (r: unknown) => void) => void };
  }
}

export function CheckoutScreen({ deliveryFeePaise, sourceRef }: { deliveryFeePaise: number; sourceRef?: string }) {
  const cart = useCart();
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [stay, setStay] = useState<Stay>("hotel");
  const [propertyName, setPropertyName] = useState("");
  const [room, setRoom] = useState("");
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gst = gstOn(cart.subtotalPaise);
  const total = cart.subtotalPaise + gst + deliveryFeePaise;
  const valid = name.trim().length >= 2 && /^[6-9]\d{9}$/.test(phone) && cart.lines.length > 0;

  function shareLocation() {
    if (!navigator.geolocation) return setError("Location isn't available on this phone.");
    navigator.geolocation.getCurrentPosition(
      (p) => setPin({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setError("Couldn't get your location. The room number and hotel name are enough."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function pay() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, phone, stayType: stay, propertyName, roomOrLandmark: room, notes, sourceRef,
          lat: pin?.lat, lng: pin?.lng,
          lines: cart.lines.map((l) => ({ itemId: l.itemId, qty: l.qty, optionIds: l.options.map((o) => o.optionId), addonIds: l.addons.map((a) => a.addonId), note: l.note ?? "" })),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? "Couldn't place the order");
      const d = json.data as { code: string; number: number; amountPaise: number; razorpayOrderId: string; keyId: string; name: string; phone: string };
      if (!window.Razorpay) throw new Error("Payment page didn't load. Check your connection and try again.");
      const rzp = new window.Razorpay({
        key: d.keyId,
        amount: d.amountPaise,
        currency: "INR",
        name: "Abu & Beyond",
        description: `Order #${d.number}`,
        order_id: d.razorpayOrderId,
        prefill: { name: d.name, contact: d.phone },
        theme: { color: "#FF4D14" },
        handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          const v = await fetch("/api/razorpay/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(r) });
          const vj = await v.json();
          if (vj.ok) {
            cart.clear();
            router.push(`/o/${d.code}`);
          } else setError("Payment received but not confirmed yet. Keep this page open or check WhatsApp.");
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.on("payment.failed", () => {
        setError("Payment didn't go through. You can try again.");
        setBusy(false);
      });
      rzp.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  const input = "h-[50px] rounded-xl border-[1.5px] border-line bg-surface px-3.5 text-base";
  const label = "text-[13px] font-semibold";

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-paper px-5 pb-36 pt-4">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
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
        <button type="button" onClick={shareLocation} className={`flex h-12 items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed text-sm font-semibold ${pin ? "border-success text-success" : "border-hill text-hill"}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
          {pin ? "Location shared" : "Share my location (helps the rider)"}
        </button>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="notes" className={label}>Delivery note <span className="font-normal text-muted">(optional)</span></label>
          <input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} placeholder="Call on arrival, leave at reception…" className={input} />
        </div>
      </section>

      <section className="mt-5 flex flex-col gap-2.5 rounded-[18px] bg-surface p-4 text-sm">
        <div className="flex justify-between"><span className="text-muted">Item total</span><span>{formatINR(cart.subtotalPaise, { decimals: true })}</span></div>
        <div className="flex justify-between"><span className="text-muted">GST 5%</span><span>{formatINR(gst, { decimals: true })}</span></div>
        <div className="flex justify-between"><span className="text-muted">Delivery</span><span>{deliveryFeePaise ? formatINR(deliveryFeePaise) : "Free"}</span></div>
        <div className="h-px bg-line" />
        <div className="flex justify-between text-base font-bold"><span>To pay</span><span>{formatINR(total, { decimals: true })}</span></div>
      </section>

      {error && <p role="alert" className="mt-3 rounded-xl bg-error/10 px-4 py-3 text-sm font-semibold text-error">{error}</p>}

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-line bg-paper px-3 pb-5 pt-3">
        <button type="button" onClick={pay} disabled={!valid || busy} className="flex h-[60px] w-full flex-col items-center justify-center rounded-[18px] bg-clay text-ink disabled:opacity-50">
          <span className="text-[17px] font-bold">{busy ? "Opening payment…" : `Pay ${formatINR(total, { decimals: true })}`}</span>
          <span className="text-xs font-medium">UPI · Card · Wallet — secured by Razorpay</span>
        </button>
      </div>
    </div>
  );
}
