// Pure order-status rules (no DB) so they can be unit-tested.
export type OrderStatus =
  | "pending_payment"
  | "payment_failed"
  | "paid"
  | "accepted"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["paid", "payment_failed", "cancelled"],
  payment_failed: ["paid", "cancelled"],
  paid: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["out_for_delivery", "delivered"],
  out_for_delivery: ["delivered"],
  delivered: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export const LIVE: OrderStatus[] = ["paid", "accepted", "preparing", "ready", "out_for_delivery"];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  payment_failed: "Payment failed",
  paid: "Paid",
  accepted: "Accepted",
  preparing: "Cooking",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** Customer-facing steps for the status page. */
export const CUSTOMER_STEPS: { status: OrderStatus; label: string; sub: string }[] = [
  { status: "paid", label: "Payment received", sub: "We've got your order" },
  { status: "accepted", label: "Kitchen accepted", sub: "The oven is on" },
  { status: "preparing", label: "Cooking now", sub: "Hot food takes a minute" },
  { status: "out_for_delivery", label: "Out for delivery", sub: "Coming up the hill" },
  { status: "delivered", label: "Delivered", sub: "Leopards sleep. We don't." },
];

export function stepIndex(s: OrderStatus) {
  const order: OrderStatus[] = ["paid", "accepted", "preparing", "ready", "out_for_delivery", "delivered"];
  const i = order.indexOf(s);
  // "ready" shows as cooking done, still before out-for-delivery
  return i < 0 ? -1 : Math.min(i, 5);
}
