"use client";

import { useState, useTransition } from "react";
import { acceptOrder, cancelOrder, setStatus } from "@/lib/orders/actions";
import type { OrderView } from "@/lib/orders/queries";
import { STATUS_LABEL, type OrderStatus } from "@/lib/orders/status";
import { formatINR } from "@/lib/pricing";
import { VegMark } from "@/components/store/veg-mark";
import { minutesSince } from "@/components/admin/order-card";

// Status colour pills — same palette as OrderCard
const PILL: Record<string, string> = {
  paid: "bg-acid text-ink",
  accepted: "bg-ink text-reversed",
  preparing: "bg-clay text-ink",
  ready: "bg-success text-reversed",
  out_for_delivery: "bg-hill text-reversed",
  delivered: "bg-line text-ink",
  cancelled: "bg-error text-reversed",
  pending_payment: "bg-line text-muted",
  payment_failed: "bg-error text-reversed",
};

// Compact summary: "2× Veg Burger, 1× Pesto Pasta"
function itemsSummary(lines: OrderView["lines"]) {
  return lines.map((l) => `${l.qty}× ${l.name}`).join(", ");
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${PILL[status] ?? "bg-line text-muted"}`}>
      {STATUS_LABEL[status as OrderStatus] ?? status}
    </span>
  );
}

type Col = "paid" | "accepted" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "cancelled";

const STAGE_COLS: { key: Col; label: string }[] = [
  { key: "paid", label: "New" },
  { key: "accepted", label: "Accepted" },
  { key: "preparing", label: "Cooking" },
  { key: "ready", label: "Ready" },
  { key: "out_for_delivery", label: "With rider" },
  { key: "delivered", label: "Done" },
  { key: "cancelled", label: "Cancelled" },
];

function OrderRow({
  order,
  riders,
  role,
  expanded,
  onToggle,
}: {
  order: OrderView;
  riders: { id: string; name: string }[];
  role: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [pending, start] = useTransition();
  const [prep, setPrep] = useState(20);
  const [err, setErr] = useState<string | null>(null);
  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setErr(null);
      try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : "failed"); }
    });

  const canKitchen = ["owner", "manager", "kitchen"].includes(role);
  const canRider = ["owner", "manager", "rider"].includes(role);
  const canManage = ["owner", "manager"].includes(role);
  const age = minutesSince(order.paidAt ?? order.createdAt);
  const ageTone = age >= 20 ? "text-error font-bold" : age >= 10 ? "text-clay font-semibold" : "text-muted";
  const isNew = order.status === "paid";

  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer border-b border-line transition-colors hover:bg-surface/60 ${isNew ? "bg-acid/10" : ""} ${pending ? "opacity-50" : ""}`}
      >
        {/* # */}
        <td className="whitespace-nowrap py-2.5 pl-4 pr-2 font-display text-[18px]">
          #{order.number}
        </td>
        {/* Customer */}
        <td className="px-2 py-2.5">
          <div className="text-sm font-semibold leading-tight">{order.customer.name ?? "Guest"}</div>
          <div className="text-[11px] text-muted">{[order.propertyName, order.roomOrLandmark].filter(Boolean).join(", ") || order.stayType}</div>
        </td>
        {/* Items */}
        <td className="max-w-[220px] truncate px-2 py-2.5 text-[12px] text-muted">{itemsSummary(order.lines)}</td>
        {/* Stage dots */}
        {STAGE_COLS.map(({ key }) => (
          <td key={key} className="px-1 py-2.5 text-center">
            {order.status === key ? (
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-clay" />
            ) : (
              <span className="inline-block h-2 w-2 rounded-full bg-line" />
            )}
          </td>
        ))}
        {/* Status pill */}
        <td className="px-2 py-2.5">
          <StatusPill status={order.status} />
        </td>
        {/* Age */}
        <td className={`whitespace-nowrap px-2 py-2.5 text-right text-sm ${ageTone}`}>{age}m</td>
        {/* Amount */}
        <td className="whitespace-nowrap px-2 py-2.5 pr-4 text-right text-sm font-semibold">{formatINR(order.totalPaise)}</td>
        {/* Quick actions (icons only) */}
        <td className="whitespace-nowrap px-2 py-2.5 pr-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            {order.status === "paid" && canKitchen && (
              <>
                <select
                  value={prep}
                  onChange={(e) => setPrep(Number(e.target.value))}
                  onClick={(e) => e.stopPropagation()}
                  className="h-8 rounded-lg border border-line bg-paper px-1.5 text-xs"
                  title="Prep time"
                >
                  {[10, 15, 20, 25, 30, 40, 50, 60].map((m) => <option key={m} value={m}>{m}m</option>)}
                </select>
                {/* Accept ✓ */}
                <button
                  title="Accept order"
                  disabled={pending}
                  onClick={() => run(() => acceptOrder(order.id, prep))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-success text-reversed transition-opacity disabled:opacity-40"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 7l3.5 3.5L12 3" />
                  </svg>
                </button>
                {/* Reject ✕ */}
                <button
                  title="Decline order"
                  disabled={pending}
                  onClick={() => {
                    const r = prompt(`Reason for declining #${order.number}:`);
                    if (r) run(() => cancelOrder(order.id, r));
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-error text-reversed transition-opacity disabled:opacity-40"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3l8 8M11 3l-8 8" />
                  </svg>
                </button>
              </>
            )}
            {order.status === "accepted" && canKitchen && (
              <button title="Start cooking" disabled={pending} onClick={() => run(() => setStatus(order.id, "preparing"))}
                className="h-8 rounded-lg bg-clay px-2 text-xs font-bold text-ink disabled:opacity-40">Cook</button>
            )}
            {order.status === "preparing" && canKitchen && (
              <button title="Mark ready" disabled={pending} onClick={() => run(() => setStatus(order.id, "ready"))}
                className="h-8 rounded-lg bg-success px-2 text-xs font-bold text-reversed disabled:opacity-40">Ready</button>
            )}
            {order.status === "ready" && canRider && (
              <button title="Picked up" disabled={pending} onClick={() => run(() => setStatus(order.id, "out_for_delivery"))}
                className="h-8 rounded-lg bg-hill px-2 text-xs font-bold text-reversed disabled:opacity-40">Out</button>
            )}
            {order.status === "out_for_delivery" && canRider && (
              <button title="Delivered" disabled={pending} onClick={() => run(() => setStatus(order.id, "delivered"))}
                className="h-8 rounded-lg bg-success px-2 text-xs font-bold text-reversed disabled:opacity-40">Done</button>
            )}
            {/* Expand chevron */}
            <button title="Details" className="flex h-8 w-8 items-center justify-center rounded-lg bg-paper text-muted" onClick={onToggle}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .15s" }}>
                <path d="M2 4l4 4 4-4" />
              </svg>
            </button>
          </div>
          {err && <p className="mt-1 text-right text-[10px] font-semibold text-error">{err}</p>}
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="border-b border-line bg-surface/40">
          <td colSpan={10} className="px-4 py-3">
            <div className="flex flex-wrap gap-6">
              {/* Items detail */}
              <div className="min-w-[200px] flex-1">
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">Items</p>
                <ul className="flex flex-col gap-1">
                  {order.lines.map((l) => (
                    <li key={l.id} className="flex items-start gap-2 text-sm">
                      <VegMark veg={l.isVeg} />
                      <span className="font-semibold">{l.qty}× {l.name}</span>
                      {(l.options.length > 0 || l.addons.length > 0) && (
                        <span className="text-[12px] text-clay font-semibold">{[...l.options, ...l.addons.map((a) => `+${a}`)].join(" · ")}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              {/* Status timeline */}
              <div className="min-w-[180px]">
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">Timeline</p>
                <ul className="flex flex-col gap-0.5 text-[12px]">
                  {order.events.map((e, i) => (
                    <li key={i} className="flex items-center gap-2 text-muted">
                      <StatusPill status={e.to} />
                      <span>{new Date(e.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {/* Delivery info */}
              <div className="min-w-[160px]">
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">Delivery</p>
                <p className="text-sm">{[order.propertyName, order.roomOrLandmark].filter(Boolean).join(", ") || order.stayType}</p>
                {order.notes && <p className="mt-1 text-[12px] text-muted">{order.notes}</p>}
                {order.scheduledFor && (
                  <p className="mt-1 text-[12px] font-semibold text-hill">
                    Scheduled · {new Date(order.scheduledFor).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                  </p>
                )}
                {order.paymentMode === "on_delivery" && (
                  <p className="mt-1 text-[12px] font-bold uppercase text-clay">Pay at door · {formatINR(order.totalPaise)}</p>
                )}
              </div>
              {/* Rider assign */}
              {canManage && riders.length > 0 && ["paid", "accepted", "preparing", "ready"].includes(order.status) && (
                <div className="min-w-[140px]">
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">Rider</p>
                  <select
                    defaultValue={order.rider?.id ?? ""}
                    onChange={(e) => run(() => import("@/lib/orders/actions").then((m) => m.assignRider(order.id, e.target.value || null)))}
                    className="h-9 rounded-xl border border-line bg-paper px-2 text-sm"
                  >
                    <option value="">Unassigned</option>
                    {riders.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              )}
              {/* Contacts */}
              <div className="min-w-[160px]">
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">Contact</p>
                <div className="flex flex-wrap gap-2">
                  <a href={`tel:${order.customer.phone}`}
                    className="flex h-8 items-center gap-1.5 rounded-lg bg-paper px-3 text-xs font-semibold">
                    📞 {order.customer.phone.replace("+91", "")}
                  </a>
                  <a href={`https://wa.me/${order.customer.phone.replace("+", "")}?text=${encodeURIComponent(`Hi! Your order #${order.number} from Abu %26 Beyond.`)}`}
                    target="_blank" rel="noreferrer"
                    className="flex h-8 items-center gap-1.5 rounded-lg bg-paper px-3 text-xs font-semibold">
                    WA
                  </a>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function OrdersTable({ orders, riders, role }: { orders: OrderView[]; riders: { id: string; name: string }[]; role: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"live" | "all">("live");

  const liveStatuses = new Set(["paid", "accepted", "preparing", "ready", "out_for_delivery"]);
  const shown = filter === "live" ? orders.filter((o) => liveStatuses.has(o.status)) : orders;
  const newCount = orders.filter((o) => o.status === "paid").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-[28px] uppercase">Orders</h1>
          {newCount > 0 && (
            <span className="rounded-full bg-acid px-3 py-1 text-sm font-bold text-ink">
              {newCount} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setFilter("live")} className={`h-9 rounded-xl px-4 text-sm font-semibold transition-colors ${filter === "live" ? "bg-ink text-reversed" : "bg-paper text-muted"}`}>Live</button>
          <button onClick={() => setFilter("all")} className={`h-9 rounded-xl px-4 text-sm font-semibold transition-colors ${filter === "all" ? "bg-ink text-reversed" : "bg-paper text-muted"}`}>All recent</button>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl bg-surface p-6 text-center text-muted">
          {filter === "live" ? "No live orders right now." : "No orders found."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-[11px] font-bold uppercase tracking-wider text-muted">
                <th className="py-2.5 pl-4 pr-2">#</th>
                <th className="px-2 py-2.5">Customer</th>
                <th className="px-2 py-2.5">Items</th>
                {STAGE_COLS.map(({ key, label }) => (
                  <th key={key} className="px-1 py-2.5 text-center text-[9px]">{label}</th>
                ))}
                <th className="px-2 py-2.5">Status</th>
                <th className="px-2 py-2.5 text-right">Age</th>
                <th className="px-2 py-2.5 pr-4 text-right">Total</th>
                <th className="px-2 py-2.5 pr-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => (
                <OrderRow
                  key={o.id}
                  order={o}
                  riders={riders}
                  role={role}
                  expanded={expandedId === o.id}
                  onToggle={() => setExpandedId((id) => (id === o.id ? null : o.id))}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
