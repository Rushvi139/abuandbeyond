import { describe, expect, it } from "vitest";
import { orderClock } from "./clock";

const now = new Date("2026-11-17T00:30:00+05:30").getTime();
const at = (s: string) => new Date(`2026-11-${s}+05:30`).toISOString();

describe("orderClock", () => {
  it("counts minutes on a live order", () => {
    expect(orderClock({ status: "preparing", paidAt: at("17T00:05:00"), createdAt: at("17T00:04:00"), deliveredAt: null, scheduledFor: null }, now)).toMatchObject({ text: "25m", tone: "late" });
  });
  it("shows when a later scheduled order is due instead of counting", () => {
    expect(orderClock({ status: "preparing", paidAt: at("17T00:19:00"), createdAt: at("17T00:19:00"), deliveredAt: null, scheduledFor: at("17T01:30:00") }, now).text).toBe("due 1:30 AM");
  });
  it("shows how long a delivered order took, not how long ago it was", () => {
    expect(orderClock({ status: "delivered", paidAt: at("10T20:00:00"), createdAt: at("10T19:59:00"), deliveredAt: at("10T20:38:00"), scheduledFor: null }, now).text).toBe("took 38m");
  });
  it("shows nothing for cancelled", () => {
    expect(orderClock({ status: "cancelled", paidAt: null, createdAt: at("10T20:00:00"), deliveredAt: null, scheduledFor: null }, now).text).toBe("—");
  });
});
