import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { intentOf, parseWebhook, validSignature } from "./intent";

const sign = (raw: string, secret: string) => "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");

describe("validSignature", () => {
  const raw = '{"entry":[]}';
  it("accepts a correct signature", () => expect(validSignature(raw, sign(raw, "s3cret"), "s3cret")).toBe(true));
  it("rejects a wrong secret, a changed body, a missing header", () => {
    expect(validSignature(raw, sign(raw, "other"), "s3cret")).toBe(false);
    expect(validSignature(raw + " ", sign(raw, "s3cret"), "s3cret")).toBe(false);
    expect(validSignature(raw, null, "s3cret")).toBe(false);
    expect(validSignature(raw, "sha256=zz", "s3cret")).toBe(false);
  });
  it("rejects everything when no secret is configured", () => {
    expect(validSignature(raw, sign(raw, ""), "")).toBe(false);
  });
});

describe("intentOf", () => {
  it.each([
    ["STOP", "stop"], ["stop messages", "stop"], ["Start", "start"],
    ["where is my order", "track"], ["any update?", "track"], ["it's late", "track"],
    ["same again please", "reorder"], ["reorder", "reorder"],
    ["hi", "menu"], ["menu?", "menu"], ["", "menu"],
  ])("%s -> %s", (t, i) => expect(intentOf(t)).toBe(i));
});

describe("parseWebhook", () => {
  const body = {
    entry: [{ changes: [{ value: {
      contacts: [{ wa_id: "919876512345", profile: { name: "Rahul" } }],
      messages: [{ id: "wamid.1", from: "919876512345", type: "text", text: { body: "hi" } }, { id: "wamid.2", from: "919876512345", type: "image" }],
      statuses: [{ id: "wamid.9", status: "delivered" }, { id: "wamid.8", status: "failed", errors: [{ title: "Undeliverable" }] }, { id: "x", status: "weird" }],
    } }] }],
  };
  it("extracts messages and receipts, ignores junk", () => {
    const r = parseWebhook(body);
    expect(r.messages).toEqual([
      { id: "wamid.1", from: "919876512345", text: "hi", name: "Rahul" },
      { id: "wamid.2", from: "919876512345", text: "", name: "Rahul" },
    ]);
    expect(r.receipts).toEqual([{ id: "wamid.9", status: "delivered", error: null }, { id: "wamid.8", status: "failed", error: "Undeliverable" }]);
  });
  it("survives garbage", () => {
    expect(parseWebhook(null)).toEqual({ messages: [], receipts: [] });
    expect(parseWebhook({ entry: "no" })).toEqual({ messages: [], receipts: [] });
  });
});
