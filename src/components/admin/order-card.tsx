"use client";

import { useState, useTransition } from "react";
import { acceptOrder, assignRider, cancelOrder, setStatus } from "@/lib/orders/actions";
import type { OrderView } from "@/lib/orders/queries";
import { STATUS_LABEL, type OrderStatus } from "@/lib/orders/status";
import { formatINR } from "@/lib/pricing";
import { PrintButton } from "@/components/kitchen/auto-print";
import { clockLabel } from "@/lib/hours";
import { CollectButton } from "@/components/admin/collect-button";
import { PaymentLink } from "@/components/admin/payment-link";
import { WhatsAppButton } from "@/components/admin/whatsapp-button";
import { VegMark } from "@/components/store/veg-mark";

const CUISINE: Record<string, string> = { abu: "ABU", italy: "ABU & ITALY", mexico: "ABU & MEXICO", china: "ABU & CHINA", lebanon: "ABU & LEBANON" };
const STATUS_TONE: Record<string, string> = {
  paid: "bg-acid text-ink", accepted: "bg-ink text-reversed", preparing: "bg-clay text-ink", ready: "bg-success text-reversed",
  out_for_delivery: "bg-hill text-reversed", delivered: "bg-line text-ink", cancelled: "bg-error text-reversed", payment_failed: "bg-error text-reversed", pending_payment: "bg-line text-muted",
};

export function minutesSince(iso: string) {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

export function OrderCard({ order, riders, role, compact = false, dark = false }: { order: OrderView; riders?: { id: string; name: string }[]; role: string; compact?: boolean; dark?: boolean }) {
  const [pending, start] = useTransition();
  const [prep, setPrep] = useState(20);
  const [err, setErr] = useState<string | null>(null);
  const age = minutesSince(order.paidAt ?? order.createdAt);
  const ageTone = age >= 20 ? "text-error" : age >= 10 ? "text-clay" : dark ? "text-kraft" : "text-muted";
  const run = (fn: () => Promise<void>) => start(async () => { setErr(null); try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : "failed"); } });
  const canKitchen = ["owner", "manager", "kitchen"].includes(role);
  const canRider = ["owner", "manager", "rider"].includes(role);
  const canManage = ["owner", "manager"].includes(role);

  return (
    <article
      className={`flex flex-col gap-3 rounded-2xl p-4 ${dark ? "bg-ink text-reversed" : "bg-surface"} ${
        pending ? "opacity-60" : ""
      } ${order.scheduledFor ? "ring-2 ring-hill" : ""}`}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className={`font-display ${compact ? "text-[26px]" : "text-[30px]"}`}>#{order.number}</span>
            {order.isDemo && (
              <span className="rounded-full border border-dashed border-current px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider opacity-80">Demo</span>
            )}
            {/* Taken on test keys. Once we are live these are the only orders
                Cashfree will not recognise, so the row has to say so itself. */}
            {order.gatewayEnv === "sandbox" && (
              <span className="rounded-full border border-dashed border-current px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider opacity-80">Sandbox</span>
            )}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${STATUS_TONE[order.status]}`}>{STATUS_LABEL[order.status as OrderStatus]}</span>
          </div>
          <div className={`text-[13px] ${dark ? "text-kraft" : "text-muted"}`}>
            {order.customer.name ?? "Guest"} · {[order.propertyName, order.roomOrLandmark].filter(Boolean).join(", ") || order.stayType}
          </div>
        </div>
        <div className="text-right">
          <div className={`font-display text-[22px] ${ageTone}`}>{age}m</div>
          {order.prepMinutes && <div className={`text-[11px] ${dark ? "text-kraft" : "text-muted"}`}>prep {order.prepMinutes}m</div>}
        </div>
      </header>

      <ul className="flex flex-col gap-1.5">
        {order.lines.map((l) => (
          <li key={l.id} className="flex items-start gap-2">
            <span className={`font-display ${compact ? "text-[20px]" : "text-[22px]"} leading-none`}>{l.qty}×</span>
            <div className="flex flex-1 flex-col">
              <span className={`flex items-center gap-1.5 ${compact ? "text-[15px]" : "text-base"} font-semibold`}><VegMark veg={l.isVeg} />{l.name}</span>
              {(l.options.length > 0 || l.addons.length > 0 || l.note) && (
                <span className={`text-[13px] ${dark ? "text-acid" : "text-clay"} font-semibold`}>{[...l.options, ...l.addons.map((a) => "+ " + a), l.note ? `“${l.note}”` : ""].filter(Boolean).join(" · ")}</span>
              )}
            </div>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${dark ? "bg-paper/15 text-reversed" : "bg-paper text-ink"}`}>{CUISINE[l.cuisine]}</span>
          </li>
        ))}
      </ul>
      {order.notes && <p className={`rounded-xl px-3 py-2 text-[13px] ${dark ? "bg-paper/10" : "bg-paper"}`}>Delivery: {order.notes}</p>}
      {order.paymentMode === "on_delivery" && !order.collectedAt && (
        <p className="rounded-xl bg-acid px-3 py-2 text-[13px] font-bold uppercase tracking-wide text-ink">
          Not paid · collect {formatINR(order.totalPaise)} at the door
        </p>
      )}
      {order.scheduledFor && (
        <p className="rounded-xl bg-hill px-3 py-2 text-[13px] font-bold uppercase tracking-wide text-reversed">
          Scheduled · deliver {scheduledLabel(order.scheduledFor)}
        </p>
      )}
      {order.kitchenNote && (
        <p className={`rounded-xl px-3 py-2 text-[13px] font-semibold ${dark ? "bg-acid text-ink" : "bg-acid/30"}`}>Note: {order.kitchenNote}</p>
      )}

      <footer className="flex flex-wrap items-center gap-2">
        {order.status === "paid" && canKitchen && (
          <>
            <label className="flex items-center gap-1 text-xs font-semibold">
              Prep
              <select value={prep} onChange={(e) => setPrep(Number(e.target.value))} className={`h-10 rounded-lg px-2 text-sm ${dark ? "bg-paper text-ink" : "border border-line bg-surface"}`}>
                {[10, 15, 20, 25, 30, 40, 50, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
              </select>
            </label>
            <button onClick={() => run(() => acceptOrder(order.id, prep))} className="h-10 flex-1 rounded-xl bg-clay px-4 text-sm font-bold text-ink">Accept</button>
          </>
        )}
        {order.status === "accepted" && canKitchen && <button onClick={() => run(() => setStatus(order.id, "preparing"))} className="h-10 flex-1 rounded-xl bg-clay px-4 text-sm font-bold text-ink">Start cooking</button>}
        {order.status === "preparing" && canKitchen && <button onClick={() => run(() => setStatus(order.id, "ready"))} className="h-10 flex-1 rounded-xl bg-success px-4 text-sm font-bold text-reversed">Ready & packed</button>}
        {order.status === "ready" && canRider && <button onClick={() => run(() => setStatus(order.id, "out_for_delivery"))} className="h-10 flex-1 rounded-xl bg-hill px-4 text-sm font-bold text-reversed">Picked up</button>}
        {order.status === "out_for_delivery" && canRider && <button onClick={() => run(() => setStatus(order.id, "delivered"))} className="h-10 flex-1 rounded-xl bg-success px-4 text-sm font-bold text-reversed">Delivered</button>}
        {canManage && riders && ["paid", "accepted", "preparing", "ready"].includes(order.status) && (
          <select value={order.rider?.id ?? ""} onChange={(e) => run(() => assignRider(order.id, e.target.value || null))} className="h-10 rounded-lg border border-line bg-surface px-2 text-sm">
            <option value="">Rider…</option>
            {riders.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}
        {canManage && ["paid", "accepted", "preparing"].includes(order.status) && (
          <button onClick={() => { const r = prompt("Reason for cancelling (customer is refunded):"); if (r) run(() => cancelOrder(order.id, r)); }} className="h-10 rounded-xl px-3 text-xs font-semibold text-error">Cancel</button>
        )}
        {/* A rider at the gate with no answer on the phone. Opens WhatsApp
            with the order number already typed. */}
        {(order.status === "ready" || order.status === "out_for_delivery") && (
          <WhatsAppButton
            phone={order.customer.phone}
            dark={dark}
            text={`Hi${order.customer.name ? " " + order.customer.name.split(" ")[0] : ""}, this is Abu & Beyond. Your order #${order.number} is on the way to ${[order.propertyName, order.roomOrLandmark].filter(Boolean).join(", ") || "you"}.`}
          />
        )}
        {(order.status === "ready" || order.status === "out_for_delivery") && (
          <a href={`tel:${order.customer.phone}`} className={`h-10 rounded-xl px-3 text-xs font-semibold leading-10 ${dark ? "bg-paper/15" : "bg-paper"}`}>Call {order.customer.phone.replace("+91", "")}</a>
        )}
        {canManage && order.status === "pending_payment" && order.paymentSessionId && <PaymentLink code={order.code} />}
        {canKitchen && <PrintButton orderId={order.id} printed={order.kotPrintedAt != null} />}
        {/* Only whoever actually handles the money, and only once the food has
            left the kitchen. A cook tapping this marks cash received that
            nobody is holding, and the evening count never balances again. */}
        {order.paymentMode === "on_delivery" && canRider &&
          ["ready", "out_for_delivery", "delivered"].includes(order.status) && (
          <CollectButton orderId={order.id} amountPaise={order.totalPaise} collected={order.collectedAt != null} />
        )}
        {order.altPhone && (
          <a
            href={`tel:${order.altPhone}`}
            title="Alternate number the guest gave"
            className={`h-10 rounded-xl px-3 text-xs font-semibold leading-10 ${dark ? "bg-paper/15" : "bg-paper"}`}
          >
            Call 2nd
          </a>
        )}
        {/* Always offer directions. With a shared pin we route to the exact
            coordinates; without one, to the property and landmark, which Maps
            resolves well enough on this plateau. A rider on a bike should
            never have to retype an address. */}
        <a
          href={`https://www.google.com/maps/dir/?api=1&travelmode=two-wheeler&destination=${encodeURIComponent(
            order.lat != null && order.lng != null
              ? `${order.lat},${order.lng}`
              : [order.propertyName, order.roomOrLandmark, "Mount Abu, Rajasthan"].filter(Boolean).join(", "),
          )}`}
          target="_blank"
          rel="noreferrer"
          className={`h-10 rounded-xl px-3 text-xs font-semibold leading-10 ${dark ? "bg-paper/15" : "bg-paper"}`}
        >
          {order.lat != null && order.lng != null ? "Navigate · pinned" : "Navigate"}
        </a>
        <span className={`ml-auto text-sm font-bold ${dark ? "text-kraft" : ""}`}>{formatINR(order.totalPaise)}</span>
      </footer>
      {err && <p className="text-xs font-semibold text-error">{err}</p>}
    </article>
  );
}

/** "9:30 PM", or "tomorrow 1:00 PM" when it is not today in Kolkata. */
function scheduledLabel(iso: string): string {
  const at = new Date(iso);
  const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
  const prefix = day(at) === day(new Date()) ? "" : "tomorrow ";
  return prefix + clockLabel(at);
}
