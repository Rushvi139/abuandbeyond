import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const KEY = "testKey";
const SALT = "testSalt";
process.env.PAYU_MERCHANT_KEY = KEY;
process.env.PAYU_MERCHANT_SALT = SALT;

const { buildPaymentForm, newRefundToken, newTxnId, paymentHash, payuPaymentUrl, toPaise, toRupeeString, verifyResponseHash } = await import("./payu");

const sha = (s: string) => createHash("sha512").update(s).digest("hex");

describe("PayU money conversion", () => {
  it("sends rupees with two decimals", () => {
    expect(toRupeeString(34965)).toBe("349.65");
    expect(toRupeeString(29900)).toBe("299.00");
    expect(toRupeeString(5)).toBe("0.05");
  });
  it("reads rupees back to whole paise", () => {
    expect(toPaise("349.65")).toBe(34965);
    expect(toPaise(0.1 + 0.2)).toBe(30);
    expect(toPaise("299.00")).toBe(29900);
  });
});

describe("PayU request hash", () => {
  it("is sha512 over key|txnid|amount|productinfo|firstname|email|udf1..5 then six empties then salt", () => {
    const f = { key: KEY, txnid: "AB12-deadbeef", amount: "349.65", productinfo: "Food", firstname: "Asha", email: "a@b.in", udf1: "AB12", udf2: "", udf3: "", udf4: "", udf5: "" };
    expect(paymentHash(f, SALT)).toBe(sha(`${KEY}|AB12-deadbeef|349.65|Food|Asha|a@b.in|AB12||||||||||${SALT}`));
  });

  it("builds a form whose hash covers the amount from paise, on the test host by default", () => {
    const { action, fields } = buildPaymentForm({
      txnid: "AB12-00000000", amountPaise: 34965, productinfo: "Abu and Beyond order 12", firstname: "Asha",
      email: "orders@example.in", phone: "+919876543210", surl: "https://x/r", furl: "https://x/r", orderCode: "AB12",
    });
    expect(action).toBe("https://test.payu.in/_payment");
    expect(payuPaymentUrl()).toBe(action);
    expect(fields.amount).toBe("349.65");
    expect(fields.phone).toBe("9876543210");
    expect(fields.udf1).toBe("AB12");
    expect(fields.hash).toBe(paymentHash(fields, SALT));
  });
});

describe("PayU reverse hash", () => {
  const resp = (extra: Record<string, string> = {}) => {
    const r: Record<string, string> = {
      key: KEY, txnid: "AB12-deadbeef", amount: "349.65", productinfo: "Food", firstname: "Asha", email: "a@b.in",
      udf1: "AB12", status: "success", mihpayid: "403993715", ...extra,
    };
    const base = `${SALT}|${r.status}||||||||||${r.udf1}|${r.email}|${r.firstname}|${r.productinfo}|${r.amount}|${r.txnid}|${KEY}`;
    r.hash = sha(r.additionalCharges ? `${r.additionalCharges}|${base}` : base);
    return r;
  };

  it("accepts a genuine response", () => {
    expect(verifyResponseHash(resp(), SALT, KEY)).toBe(true);
  });
  it("accepts one with additional charges", () => {
    expect(verifyResponseHash(resp({ additionalCharges: "8.50" }), SALT, KEY)).toBe(true);
  });
  it("rejects a changed status", () => {
    expect(verifyResponseHash({ ...resp({ status: "failure" }), status: "success" }, SALT, KEY)).toBe(false);
  });
  it("rejects a changed amount", () => {
    expect(verifyResponseHash({ ...resp(), amount: "1.00" }, SALT, KEY)).toBe(false);
  });
  it("rejects another merchant's key", () => {
    expect(verifyResponseHash({ ...resp(), key: "otherKey" }, SALT, KEY)).toBe(false);
  });
  it("rejects a missing hash", () => {
    const r = resp();
    delete r.hash;
    expect(verifyResponseHash(r, SALT, KEY)).toBe(false);
  });
});

describe("PayU ids", () => {
  it("makes txnids within PayU's 25 characters, unique per attempt", () => {
    const a = newTxnId("AB-1234567890ABCDEFGH");
    expect(a.length).toBeLessThanOrEqual(25);
    expect(a).not.toBe(newTxnId("AB-1234567890ABCDEFGH"));
  });
  it("makes refund tokens within 23 characters", () => {
    expect(newRefundToken().length).toBeLessThanOrEqual(23);
  });
});
