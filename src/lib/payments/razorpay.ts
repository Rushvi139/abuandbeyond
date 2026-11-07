import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const keyId = () => process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "";
const keySecret = () => process.env.RAZORPAY_KEY_SECRET ?? "";

export function razorpayConfigured() {
  return Boolean(keyId() && keySecret());
}

async function api<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
  const res = await fetch("https://api.razorpay.com/v1" + path, {
    method,
    headers: {
      Authorization: "Basic " + Buffer.from(`${keyId()}:${keySecret()}`).toString("base64"),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const json = (await res.json()) as T & { error?: { description?: string } };
  if (!res.ok) throw new Error(json.error?.description ?? `Razorpay ${res.status}`);
  return json;
}

/** Creates a Razorpay order for our order. receipt = our order code. */
export async function createRazorpayOrder(amountPaise: number, receipt: string, notes: Record<string, string> = {}) {
  return api<{ id: string; amount: number; currency: string }>("/orders", { amount: amountPaise, currency: "INR", receipt, notes });
}

export async function refundPayment(paymentId: string, amountPaise?: number) {
  return api<{ id: string; amount: number; status: string }>(`/payments/${paymentId}/refund`, amountPaise ? { amount: amountPaise } : {});
}

function safeEq(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Checkout success handler: signature = HMAC_SHA256(order_id|payment_id, key_secret). */
export function verifyCheckoutSignature(razorpayOrderId: string, paymentId: string, signature: string, secret = keySecret()) {
  const expected = createHmac("sha256", secret).update(`${razorpayOrderId}|${paymentId}`).digest("hex");
  return safeEq(expected, signature);
}

/** Webhook: X-Razorpay-Signature = HMAC_SHA256(raw body, webhook secret). */
export function verifyWebhookSignature(rawBody: string, signature: string, secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "") {
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEq(expected, signature);
}
