/**
 * The three places money goes out of. Saraspur is the bank account that UPI
 * and QR-scanner payments land in, so UPI taken at the door counts as money
 * into Saraspur; cash taken at the door is the cash in hand.
 */
export const PAID_FROM = ["cash", "saraspur", "hdfc"] as const;
export type PaidFrom = (typeof PAID_FROM)[number];

export const PAID_FROM_LABEL: Record<PaidFrom, string> = {
  cash: "Cash from orders",
  saraspur: "Saraspur (UPI / QR)",
  hdfc: "HDFC",
};

/** What the older `mode` column shows for each, so existing lists keep reading right. */
export const PAID_FROM_MODE: Record<PaidFrom, string> = { cash: "Cash", saraspur: "Saraspur", hdfc: "HDFC" };

export const isPaidFrom = (v: unknown): v is PaidFrom => typeof v === "string" && (PAID_FROM as readonly string[]).includes(v);
