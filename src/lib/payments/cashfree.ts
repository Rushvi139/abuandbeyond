import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Cashfree Payment Gateway.
 *
 * Two things differ from most gateways and both matter:
 *   - amounts are rupees with decimals, not paise, so every crossing converts;
 *   - nothing the browser holds is a credential. It gets a short-lived
 *     `payment_session_id`, and payment is only ever confirmed server-side.
 */

const appId = () => process.env.CASHFREE_APP_ID ?? "";
const secret = () => process.env.CASHFREE_SECRET_KEY ?? "";
export const cashfreeMode = () => (process.env.CASHFREE_ENV === "production" ? "production" : "sandbox");
const base = () => (cashfreeMode() === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg");

const API_VERSION = "2026-01-01";

export function cashfreeConfigured() {
  return Boolean(appId() && secret());
}

/** Paise is our unit everywhere; Cashfree wants rupees. Convert only at this boundary. */
export const toRupees = (paise: number) => Number((paise / 100).toFixed(2));
export const toPaise = (rupees: number) => Math.round(Number(rupees) * 100);

type CashfreeError = { message?: string; code?: string; type?: string };

async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  if (!cashfreeConfigured()) throw new Error("Cashfree keys are not set");
  const res = await fetch(base() + path, {
    method: init.method ?? "GET",
    headers: {
      "x-client-id": appId(),
      "x-client-secret": secret(),
      "x-api-version": API_VERSION,
      "Content-Type": "application/json",
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as T & CashfreeError;
  if (!res.ok) throw new Error(json.message ?? `Cashfree ${res.status}`);
  return json;
}

export type CashfreeOrder = {
  cf_order_id: string;
  order_id: string;
  order_status: "ACTIVE" | "PAID" | "EXPIRED" | "TERMINATED" | "TERMINATION_REQUESTED";
  order_amount: number;
  payment_session_id?: string;
};

/** Creates the order Cashfree will collect against. `orderId` is our own order code. */
export async function createCashfreeOrder(args: {
  orderId: string;
  amountPaise: number;
  customerId: string;
  phone: string;
  name?: string | null;
  returnUrl: string;
  notifyUrl: string;
}) {
  return api<CashfreeOrder>("/orders", {
    method: "POST",
    body: {
      order_id: args.orderId,
      order_amount: toRupees(args.amountPaise),
      order_currency: "INR",
      customer_details: {
        customer_id: args.customerId,
        customer_phone: args.phone.replace(/^\+91/, ""),
        ...(args.name ? { customer_name: args.name } : {}),
      },
      order_meta: { return_url: args.returnUrl, notify_url: args.notifyUrl },
    },
  });
}

/** The only thing we trust about a payment. Never believe the browser. */
export async function fetchCashfreeOrder(orderId: string) {
  return api<CashfreeOrder>(`/orders/${encodeURIComponent(orderId)}`);
}

export type CashfreePayment = {
  cf_payment_id: string | number;
  payment_status: "SUCCESS" | "FAILED" | "PENDING" | "USER_DROPPED" | "CANCELLED" | "VOID";
  payment_amount: number;
  payment_method?: unknown;
  payment_group?: string;
};

export async function fetchCashfreePayments(orderId: string) {
  return api<CashfreePayment[]>(`/orders/${encodeURIComponent(orderId)}/payments`);
}

/** Refunds are keyed by order, and we have to invent the refund id ourselves. */
export async function refundCashfreeOrder(orderId: string, refundId: string, amountPaise: number, note?: string) {
  return api<{ refund_id: string; refund_status: string; refund_amount: number }>(
    `/orders/${encodeURIComponent(orderId)}/refunds`,
    { method: "POST", body: { refund_id: refundId, refund_amount: toRupees(amountPaise), refund_note: note ?? "Refund" } },
  );
}

function safeEq(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const sign = (key: string, timestamp: string, rawBody: string) =>
  createHmac("sha256", key).update(timestamp + rawBody).digest("base64");

/**
 * Webhook signature: base64( HMAC-SHA256( timestamp + rawBody, secret ) ).
 *
 * Cashfree's docs say the API secret signs webhooks, but the dashboard also
 * issues a per-endpoint token when you add an endpoint. Rather than bet on
 * which one a given event is signed with, we accept either — both are secrets
 * only Cashfree and we hold, so nothing is weakened by trying both.
 *
 * The body must be the untouched raw string: parsing turns 170.00 into 170 and
 * the signature stops matching.
 */
export function verifyCashfreeWebhook(
  rawBody: string,
  signature: string,
  timestamp: string,
  keys: string | string[] = [secret(), process.env.CASHFREE_WEBHOOK_SECRET ?? ""],
) {
  if (!signature || !timestamp) return false;
  const candidates = (Array.isArray(keys) ? keys : [keys]).filter(Boolean);
  if (!candidates.length) return false;
  // check every key, without short-circuiting, so timing says nothing about which matched
  return candidates.reduce((ok, key) => safeEq(sign(key, timestamp, rawBody), signature) || ok, false);
}

/** Rejects a webhook whose timestamp is too old to be a genuine delivery or retry. */
export function webhookTimestampFresh(timestamp: string, maxAgeSeconds = 60 * 60 * 24) {
  const t = Number(timestamp);
  if (!Number.isFinite(t) || t <= 0) return false;
  const seconds = t > 1e12 ? t / 1000 : t; // Cashfree sends seconds; tolerate milliseconds
  return Math.abs(Date.now() / 1000 - seconds) <= maxAgeSeconds;
}
