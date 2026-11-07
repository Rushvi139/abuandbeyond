"use client";

import Link from "next/link";
import { useCart } from "@/hooks/use-cart";
import { formatINR, gstOn } from "@/lib/pricing";
import { VegMark } from "./veg-mark";

export function CheckoutPlaceholder() {
  const cart = useCart();
  const gst = gstOn(cart.subtotalPaise);

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-paper px-5 pb-32 pt-4">
      <div className="flex items-center gap-3">
        <Link href="/" aria-label="Back to menu" className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-surface">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
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
                <span className="text-xs text-muted">
                  {[...l.options.map((o) => o.name), ...l.addons.map((a) => a.name), l.note].filter(Boolean).join(" · ")}
                </span>
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
        <Link href="/" className="flex h-12 items-center text-sm font-semibold">
          + Add more items
        </Link>
      </section>

      <section className="mt-5 flex flex-col gap-2.5 rounded-[18px] bg-surface p-4 text-sm">
        <div className="flex justify-between"><span className="text-muted">Item total</span><span>{formatINR(cart.subtotalPaise, { decimals: true })}</span></div>
        <div className="flex justify-between"><span className="text-muted">GST 5%</span><span>{formatINR(gst, { decimals: true })}</span></div>
        <div className="h-px bg-line" />
        <div className="flex justify-between text-base font-bold"><span>To pay</span><span>{formatINR(cart.subtotalPaise + gst, { decimals: true })}</span></div>
      </section>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-line bg-paper px-3 pb-5 pt-3">
        <div className="flex h-[60px] flex-col items-center justify-center rounded-[18px] bg-ink text-reversed">
          <span className="text-[15px] font-bold">Online payment opens soon</span>
          <span className="text-xs text-kraft">Delivery details and Razorpay checkout are the next build step</span>
        </div>
      </div>
    </div>
  );
}
