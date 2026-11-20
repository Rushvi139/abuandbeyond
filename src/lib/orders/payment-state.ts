/**
 * Has this order's money arrived? One answer, used by every screen, so the
 * order board, kitchen, rider and accounts never disagree.
 *
 *   paid       — online payment confirmed by PayU, or cash/UPI collected
 *   collect    — pay on delivery (or a counter order), not collected yet
 *   awaiting   — online order whose payment hasn't completed
 *   refunded   — cancelled and money sent back
 *   void       — cancelled with nothing taken
 *
 * An order on a B2B partner's account counts as settled for the kitchen and
 * rider ("On partner account"); what the partner owes lives on Partners.
 */
export type PaymentState = {
  kind: "paid" | "collect" | "awaiting" | "refunded" | "void";
  label: string;
};

type Input = {
  status: string;
  paymentMode: "online" | "on_delivery" | "credit";
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
  // On a partner's account: no money changes hands at the door. It is
  // settled on the partner's statement, which Partners tracks.
  if (o.paymentMode === "credit") return { kind: "paid", label: "On partner account" };
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
