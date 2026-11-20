/**
 * Has this order's money arrived? One answer, used by every screen, so the
 * order board, kitchen, rider and accounts never disagree.
 *
 *   paid       — online payment confirmed by PayU, or cash/UPI collected
 *   collect    — pay on delivery (or a counter order), not collected yet
 *   awaiting   — online order whose payment hasn't completed
 *   refunded   — cancelled and money sent back
 *   void       — cancelled with nothing taken
 */
export type PaymentState = {
  kind: "paid" | "collect" | "awaiting" | "refunded" | "void";
  label: string;
};

type Input = {
  status: string;
  paymentMode: "online" | "on_delivery";
  collectedAt: string | null;
  collectMethod?: string | null;
  refundedPaise?: number;
  totalPaise: number;
};

const rupees = (p: number) => "₹" + Math.round(p / 100).toLocaleString("en-IN");

export function paymentState(o: Input): PaymentState {
  if (o.status === "cancelled") {
    if (Number(o.refundedPaise ?? 0) > 0) return { kind: "refunded", label: "Refunded" };
    return { kind: "void", label: "Cancelled · nothing taken" };
  }
  if (o.paymentMode === "online") {
    if (o.status === "pending_payment") return { kind: "awaiting", label: "Awaiting payment" };
    if (o.status === "payment_failed") return { kind: "awaiting", label: "Payment failed" };
    return { kind: "paid", label: "Paid · online" };
  }
  if (o.collectMethod === "complimentary") return { kind: "paid", label: "Complimentary" };
  if (o.collectedAt) return { kind: "paid", label: `Paid · ${o.collectMethod === "upi" ? "UPI" : "cash"}` };
  return { kind: "collect", label: `To collect ${rupees(o.totalPaise)}` };
}

/** Tailwind classes for the badge, light and dark (kitchen) surfaces. */
export const PAYMENT_TONE: Record<PaymentState["kind"], string> = {
  paid: "bg-success text-reversed",
  collect: "bg-acid text-ink",
  awaiting: "bg-error text-reversed",
  refunded: "bg-line text-ink",
  void: "bg-line text-muted",
};
