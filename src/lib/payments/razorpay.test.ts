import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { verifyCheckoutSignature, verifyWebhookSignature } = await import("./razorpay");

describe("razorpay signatures", () => {
  it("accepts a correct checkout signature and rejects a tampered one", () => {
    const sig = createHmac("sha256", "secret").update("order_1|pay_1").digest("hex");
    expect(verifyCheckoutSignature("order_1", "pay_1", sig, "secret")).toBe(true);
    expect(verifyCheckoutSignature("order_1", "pay_2", sig, "secret")).toBe(false);
    expect(verifyCheckoutSignature("order_1", "pay_1", sig.slice(0, -1) + "0", "secret")).toBe(false);
  });
  it("verifies the webhook body and refuses when no secret is set", () => {
    const body = '{"event":"payment.captured"}';
    const sig = createHmac("sha256", "whsec").update(body).digest("hex");
    expect(verifyWebhookSignature(body, sig, "whsec")).toBe(true);
    expect(verifyWebhookSignature(body + " ", sig, "whsec")).toBe(false);
    expect(verifyWebhookSignature(body, sig, "")).toBe(false);
  });
});
