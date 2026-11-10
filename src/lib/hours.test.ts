import { describe, expect, it } from "vitest";
import { hoursLine, isBookableSlot, serviceState, serviceWindows, upcomingSlots } from "./hours";

/** A Kolkata wall-clock time, as a real instant. +05:30 is fixed year-round. */
const at = (hhmm: string, day = "2026-11-10") => new Date(`${day}T${hhmm}:00+05:30`);

describe("service hours", () => {
  it("reads back the way the owner wrote them", () => {
    expect(hoursLine()).toBe("Day 12 PM to 3 PM · Evening 7 PM to 2 AM");
    expect(serviceWindows()).toEqual([
      { label: "Day", when: "12 PM to 3 PM" },
      { label: "Evening", when: "7 PM to 2 AM" },
    ]);
  });

  it("is open during the lunch window", () => {
    expect(serviceState(at("12:00")).open).toBe(true);
    expect(serviceState(at("14:59")).open).toBe(true);
  });

  it("is shut between the two shifts", () => {
    expect(serviceState(at("15:00")).open).toBe(false);
    expect(serviceState(at("18:59")).open).toBe(false);
  });

  // The evening shift runs to 2am, so 01:30 is inside a window that started
  // yesterday. Treating the clock as a plain number says 1 < 19, closed.
  it("stays open past midnight", () => {
    expect(serviceState(at("19:00")).open).toBe(true);
    expect(serviceState(at("23:59")).open).toBe(true);
    expect(serviceState(at("00:30")).open).toBe(true);
    expect(serviceState(at("01:59")).open).toBe(true);
    expect(serviceState(at("02:00")).open).toBe(false);
  });

  it("says when we next open, wrapping to tomorrow after the last shift", () => {
    expect(serviceState(at("03:00")).opensAt).toBe("12 PM");
    expect(serviceState(at("16:00")).opensAt).toBe("7 PM");
    // 11:00 is before lunch, so lunch is next — not tomorrow's.
    expect(serviceState(at("11:00")).opensAt).toBe("12 PM");
  });

  it("says when the current shift ends", () => {
    expect(serviceState(at("13:00")).closesAt).toBe("3 PM");
    expect(serviceState(at("21:00")).closesAt).toBe("2 AM");
    expect(serviceState(at("01:00")).closesAt).toBe("2 AM");
  });

  // The server runs in UTC. 20:00 UTC is 01:30 next day in Kolkata, inside the
  // evening shift — a naive new Date().getHours() would call it closed.
  it("uses Kolkata time, not the server's", () => {
    expect(serviceState(new Date("2026-11-10T20:00:00Z")).open).toBe(true);
    expect(serviceState(new Date("2026-11-10T06:00:00Z")).open).toBe(false); // 11:30 IST
    expect(serviceState(new Date("2026-11-10T07:00:00Z")).open).toBe(true); // 12:30 IST
  });
});

describe("bookable slots", () => {
  // 4pm: shut, and the next shift starts at 7. Everything offered must be
  // inside a window, so the first slot is 7 PM, not 4:45.
  const afternoon = new Date("2026-11-10T16:00:00+05:30");

  it("offers nothing before the kitchen opens", () => {
    const slots = upcomingSlots(afternoon);
    expect(slots[0].label).toBe("7:00 PM");
    expect(slots.every((s) => s.label !== "4:45 PM")).toBe(true);
  });

  it("keeps a lead time, so nothing can be ordered for five minutes away", () => {
    // 8pm, mid-service. 45 minutes' lead rounds up to 9:00 PM.
    const slots = upcomingSlots(new Date("2026-11-10T20:00:00+05:30"));
    expect(slots[0].label).toBe("9:00 PM");
  });

  it("carries the evening shift past midnight and stops at 2 AM", () => {
    const labels = upcomingSlots(afternoon).map((s) => s.label);
    expect(labels).toContain("11:30 PM");
    expect(labels).toContain("1:30 AM");
    expect(labels).not.toContain("2:30 AM");
  });

  it("marks tomorrow's slots as tomorrow", () => {
    const slots = upcomingSlots(afternoon);
    expect(slots.find((s) => s.label === "8:00 PM")!.day).toBe("Today");
    // Past midnight is already the next calendar day in Kolkata.
    expect(slots.find((s) => s.label === "1:00 AM")!.day).toBe("Tomorrow");
    expect(slots.find((s) => s.label === "12:30 PM")!.day).toBe("Tomorrow");
  });

  it("refuses a time outside a window, in the past, or too far out", () => {
    const now = afternoon;
    expect(isBookableSlot(new Date("2026-11-10T20:00:00+05:30"), now)).toBe(true);
    expect(isBookableSlot(new Date("2026-11-10T17:00:00+05:30"), now)).toBe(false); // shut
    expect(isBookableSlot(new Date("2026-11-10T13:00:00+05:30"), now)).toBe(false); // past
    expect(isBookableSlot(new Date("2026-11-20T20:00:00+05:30"), now)).toBe(false); // too far
    expect(isBookableSlot(new Date("nonsense"), now)).toBe(false);
  });
});
