import { describe, expect, it } from "vitest";
import { canTransition, TRANSITIONS, type OrderStatus } from "./status";

const ALL = Object.keys(TRANSITIONS) as OrderStatus[];

describe("order state machine", () => {
  it("follows the happy path", () => {
    const path: OrderStatus[] = ["pending_payment", "paid", "accepted", "preparing", "ready", "out_for_delivery", "delivered"];
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i], path[i + 1])).toBe(true);
  });
  it("never leaves delivered or cancelled", () => {
    for (const to of ALL) {
      expect(canTransition("delivered", to)).toBe(false);
      expect(canTransition("cancelled", to)).toBe(false);
    }
  });
  it("cannot skip the kitchen", () => {
    expect(canTransition("paid", "ready")).toBe(false);
    expect(canTransition("paid", "delivered")).toBe(false);
    expect(canTransition("pending_payment", "accepted")).toBe(false);
  });
  it("cannot cancel once out for delivery", () => {
    expect(canTransition("out_for_delivery", "cancelled")).toBe(false);
    expect(canTransition("ready", "cancelled")).toBe(false);
  });
  it("allows a retry after a failed payment", () => {
    expect(canTransition("payment_failed", "paid")).toBe(true);
  });
});
