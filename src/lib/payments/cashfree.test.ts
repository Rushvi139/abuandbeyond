import { describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

vi.mock("server-only", () => ({}));
vi.stubEnv("CASHFREE_SECRET_KEY", "test_secret");
const { verifyCashfreeWebhook, webhookTimestampFresh, toRupees, toPaise } = await import("./cashfree");

const sign = (ts: string, body: string, key = "test_secret") =>
  createHmac("sha256", key).update(ts + body).digest("base64");

describe("cashfree money conversion", () => {
  it("sends paise to Cashfree as rupees with two decimals", () => {
    expect(toRupees(50000)).toBe(500);
    expect(toRupees(73500)).toBe(735);
    expect(toRupees(29999)).toBe(299.99);
  });

  it("brings rupees back to paise without drift", () => {
    expect(toPaise(735)).toBe(73500);
    expect(toPaise(299.99)).toBe(29999);
    expect(toPaise(0.1 + 0.2)).toBe(30);
  });
});

describe("cashfree webhook signature", () => {
  const body = '{"data":{"order":{"order_id":"abc","order_amount":735.00}}}';
  const ts = String(Math.floor(Date.now() / 1000));

  it("accepts a signature over timestamp + raw body", () => {
    expect(verifyCashfreeWebhook(body, sign(ts, body), ts)).toBe(true);
  });

  it("rejects a signature made without the timestamp", () => {
    const wrong = createHmac("sha256", "test_secret").update(body).digest("base64");
    expect(verifyCashfreeWebhook(body, wrong, ts)).toBe(false);
  });

  it("rejects a body that was re-serialised (735.00 becoming 735)", () => {
    const reparsed = JSON.stringify(JSON.parse(body));
    expect(reparsed).not.toBe(body);
    expect(verifyCashfreeWebhook(reparsed, sign(ts, body), ts)).toBe(false);
  });

  it("rejects another merchant's secret", () => {
    expect(verifyCashfreeWebhook(body, sign(ts, body, "someone_else"), ts)).toBe(false);
  });

  it("accepts the per-endpoint webhook token as well as the API secret", () => {
    const endpointKey = "endpoint_token";
    const keys = ["test_secret", endpointKey];
    expect(verifyCashfreeWebhook(body, sign(ts, body, endpointKey), ts, keys)).toBe(true);
    expect(verifyCashfreeWebhook(body, sign(ts, body, "test_secret"), ts, keys)).toBe(true);
    expect(verifyCashfreeWebhook(body, sign(ts, body, "neither"), ts, keys)).toBe(false);
  });

  it("rejects everything when no key is configured", () => {
    expect(verifyCashfreeWebhook(body, sign(ts, body), ts, [])).toBe(false);
    expect(verifyCashfreeWebhook(body, sign(ts, body), ts, [""])).toBe(false);
  });

  it("rejects empty or missing pieces", () => {
    expect(verifyCashfreeWebhook(body, "", ts)).toBe(false);
    expect(verifyCashfreeWebhook(body, sign(ts, body), "")).toBe(false);
  });
});

describe("webhook timestamp freshness", () => {
  it("accepts now, in seconds or milliseconds", () => {
    expect(webhookTimestampFresh(String(Math.floor(Date.now() / 1000)))).toBe(true);
    expect(webhookTimestampFresh(String(Date.now()))).toBe(true);
  });

  it("rejects a replay from last week and anything unparseable", () => {
    expect(webhookTimestampFresh(String(Math.floor(Date.now() / 1000) - 7 * 86400))).toBe(false);
    expect(webhookTimestampFresh("not-a-time")).toBe(false);
  });
});
