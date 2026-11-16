import { describe, expect, it } from "vitest";
import { paymentState } from "./payment-state";

const o = { status: "delivered", paymentMode: "online" as const, collectedAt: null, totalPaise: 82700 };

describe("paymentState", () => {
  it("online and confirmed is paid", () => expect(paymentState(o).label).toBe("Paid · online"));
  it("online not finished is awaiting", () => expect(paymentState({ ...o, status: "pending_payment" }).kind).toBe("awaiting"));
  it("pay on delivery not collected shows the amount", () =>
    expect(paymentState({ ...o, paymentMode: "on_delivery" }).label).toBe("To collect ₹827"));
  it("collected by UPI says so", () =>
    expect(paymentState({ ...o, paymentMode: "on_delivery", collectedAt: "x", collectMethod: "upi" }).label).toBe("Paid · UPI"));
  it("cancelled with a refund", () => expect(paymentState({ ...o, status: "cancelled", refundedPaise: 82700 }).kind).toBe("refunded"));
  it("cancelled cash order took nothing", () =>
    expect(paymentState({ ...o, status: "cancelled", paymentMode: "on_delivery" }).kind).toBe("void"));
});
