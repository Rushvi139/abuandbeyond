import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * PayU (India) hosted checkout.
 *
 * How it differs from the Cashfree integration it replaced, and why each
 * difference matters here:
 *
 *   - There is no "create order" call. The browser posts a signed form
 *     straight to PayU's payment page. The signature (a SHA-512 over the
 *     fields and our salt) is computed here, so the salt never leaves the
 *     server, and the browser cannot change the amount without breaking it.
 *   - Amounts are rupee strings ("349.65"). Paise is our unit everywhere;
 *     this file is the only place that converts.
 *   - A txnid can be used once. A guest who abandons and retries needs a new
 *     one, so every attempt gets its own row in `payment_attempts`, all
 *     pointing back at the same order.
 *   - PayU's return post and its webhook are both signed with a "reverse"
 *     hash. We check it, but we still never mark an order paid on it alone:
 *     we ask PayU's own `verify_payment` from the server first. That is the
 *     equivalent of the old `GET /pg/orders/{id}` and is the rule in CLAUDE.md.
 */

const key = () => process.env.PAYU_MERCHANT_KEY ?? "";
const salt = () => process.env.PAYU_MERCHANT_SALT ?? "";

/** `test` unless explicitly told otherwise — live money needs a deliberate switch. */
export const payuMode = (): "test" | "production" => (process.env.PAYU_ENV === "production" ? "production" : "test");

/** What we store in `orders.gateway_env`, whose check constraint predates PayU. */
export const payuEnvLabel = () => (payuMode() === "production" ? "production" : "sandbox");

export const payuPaymentUrl = () =>
  payuMode() === "production" ? "https://secure.payu.in/_payment" : "https://test.payu.in/_payment";

const postServiceUrl = () =>
  payuMode() === "production"
    ? "https://info.payu.in/merchant/postservice.php?form=2"
    : "https://test.payu.in/merchant/postservice.php?form=2";

export function payuConfigured() {
  return Boolean(key() && salt());
}

/** Paise → "349.65". PayU wants rupees with two decimals. */
export const toRupeeString = (paise: number) => (paise / 100).toFixed(2);
/** "349.65" (or 349.65) → 34965. Rounds, so float noise can't leave us a paisa out. */
export const toPaise = (rupees: string | number) => Math.round(Number(rupees) * 100);

const sha512 = (s: string) => createHash("sha512").update(s, "utf8").digest("hex");

function safeEq(a: string, b: string) {
  const x = Buffer.from(a.toLowerCase()), y = Buffer.from(b.toLowerCase());
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * A txnid for one payment attempt: the order code plus a short random tail.
 * PayU caps txnid at 25 characters and refuses a repeat, so the tail is what
 * lets a guest try again on the same order.
 */
export function newTxnId(orderCode: string) {
  const tail = randomBytes(4).toString("hex"); // 8 chars
  return `${orderCode.replace(/[^A-Za-z0-9]/g, "").slice(0, 16)}-${tail}`;
}

/** A refund token: unique per request, at most 23 characters. */
export function newRefundToken() {
  return `rf${Date.now().toString(36)}${randomBytes(3).toString("hex")}`.slice(0, 23);
}

export type PayuFields = {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  surl: string;
  furl: string;
  udf1: string;
  udf2: string;
  udf3: string;
  udf4: string;
  udf5: string;
  hash: string;
};

/**
 * sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
 * Five udf slots, then five empty ones (udf6–udf10), always: six pipes between udf5 and the salt.
 */
export function paymentHash(f: Omit<PayuFields, "hash" | "phone" | "surl" | "furl">, saltValue = salt()) {
  return sha512(
    [f.key, f.txnid, f.amount, f.productinfo, f.firstname, f.email, f.udf1, f.udf2, f.udf3, f.udf4, f.udf5, "", "", "", "", "", saltValue].join("|"),
  );
}

/**
 * The form the browser posts to PayU. Only the hash proves we made it, so
 * every field that goes into the hash is fixed here and nowhere else.
 */
export function buildPaymentForm(args: {
  txnid: string;
  amountPaise: number;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  surl: string;
  furl: string;
  orderCode: string;
}): { action: string; fields: PayuFields } {
  if (!payuConfigured()) throw new Error("PayU keys are not set");
  // PayU rejects some punctuation in these; keep them plain.
  const clean = (s: string, n: number) => s.replace(/[^\p{L}\p{N} .,&-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, n);
  const base = {
    key: key(),
    txnid: args.txnid,
    amount: toRupeeString(args.amountPaise),
    productinfo: clean(args.productinfo, 100) || "Food order",
    firstname: clean(args.firstname, 60) || "Guest",
    email: args.email,
    udf1: args.orderCode, // covered by the reverse hash, so we can trust it on return
    udf2: "",
    udf3: "",
    udf4: "",
    udf5: "",
  };
  return {
    action: payuPaymentUrl(),
    fields: { ...base, phone: args.phone.replace(/^\+91/, ""), surl: args.surl, furl: args.furl, hash: paymentHash(base) },
  };
}

/** The fields PayU posts back to surl/furl and to the payment webhook. */
export type PayuResponse = Record<string, string | undefined> & {
  key?: string;
  txnid?: string;
  amount?: string;
  productinfo?: string;
  firstname?: string;
  email?: string;
  status?: string;
  mihpayid?: string;
  hash?: string;
  additionalCharges?: string;
  udf1?: string;
};

/**
 * Reverse hash:
 *   sha512([additionalCharges|]SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
 *
 * It proves the post came from PayU and that nothing in it was changed on
 * the way through the guest's browser. It does not, on its own, prove the
 * money arrived — `verifyPayment` is still asked before anything is marked paid.
 */
export function verifyResponseHash(r: PayuResponse, saltValue = salt(), keyValue = key()) {
  if (!r.hash || !saltValue) return false;
  if ((r.key ?? "") !== keyValue) return false;
  const parts = [
    saltValue,
    r.status ?? "",
    "", "", "", "", "", // udf10..udf6
    r.udf5 ?? "", r.udf4 ?? "", r.udf3 ?? "", r.udf2 ?? "", r.udf1 ?? "",
    r.email ?? "", r.firstname ?? "", r.productinfo ?? "", r.amount ?? "", r.txnid ?? "", keyValue,
  ];
  if (r.additionalCharges) parts.unshift(r.additionalCharges);
  return safeEq(sha512(parts.join("|")), r.hash);
}

async function postService<T>(command: string, vars: Record<string, string>): Promise<T> {
  if (!payuConfigured()) throw new Error("PayU keys are not set");
  const var1 = vars.var1 ?? "";
  const body = new URLSearchParams({ key: key(), command, ...vars, hash: sha512(`${key()}|${command}|${var1}|${salt()}`) });
  const res = await fetch(postServiceUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`PayU ${res.status}`);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("PayU sent something that wasn't JSON");
  }
}

export type PayuTxn = {
  mihpayid?: string | number;
  status?: string; // "success" | "failure" | "pending" | "Not Found" ...
  unmappedstatus?: string;
  amt?: string;
  transaction_amount?: string;
  net_amount_debit?: string | number;
  mode?: string;
  error_Message?: string;
  error_code?: string;
};

/**
 * The only thing we trust about a payment. Takes several txnids at once —
 * every attempt on an order — and returns PayU's view of each.
 */
export async function verifyPayment(txnids: string[]): Promise<Record<string, PayuTxn>> {
  if (txnids.length === 0) return {};
  const r = await postService<{ status?: number; transaction_details?: Record<string, PayuTxn> }>("verify_payment", {
    var1: txnids.join("|"),
  });
  return r.transaction_details ?? {};
}

/** The successful attempt, if any; PayU says "success" only once money is captured. */
export function successfulAttempt(details: Record<string, PayuTxn>) {
  for (const [txnid, t] of Object.entries(details)) {
    if (t.status === "success" && t.mihpayid && t.mihpayid !== "Not Found") return { txnid, txn: t };
  }
  return null;
}

/** A failure PayU will not change its mind about. "pending" and "Not Found" are not final. */
export const isFinalFailure = (t: PayuTxn) => t.status === "failure" || t.status === "failed" || t.unmappedstatus === "userCancelled" || t.unmappedstatus === "dropped" || t.unmappedstatus === "bounced";

/**
 * Refunds are keyed by PayU's mihpayid and need a token we make up ourselves.
 * PayU answers `status: 1` when it has queued the refund; the money moves later.
 */
export async function refundPayment(mihpayid: string, token: string, amountPaise: number) {
  const r = await postService<{ status?: number; msg?: string; request_id?: string; error_code?: number | string }>(
    "cancel_refund_transaction",
    { var1: mihpayid, var2: token, var3: toRupeeString(amountPaise) },
  );
  if (r.status !== 1) throw new Error(r.msg ?? "PayU refused the refund");
  return r;
}
