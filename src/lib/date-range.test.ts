import { describe, expect, it } from "vitest";
import { presetRange, readRange } from "./date-range";

const today = "2026-11-17"; // a Tuesday

describe("date ranges", () => {
  it("this week starts on Monday", () => expect(presetRange("week", today)).toEqual({ from: "2026-11-16", to: today }));
  it("last month is the whole previous month", () => expect(presetRange("last-month", today)).toEqual({ from: "2026-10-01", to: "2026-10-31" }));
  it("reads a custom range and recognises a preset", () => {
    expect(readRange({ from: "2026-11-01", to: today }, "today", today)).toEqual({ from: "2026-11-01", to: today, preset: "month" });
  });
  it("swaps a backwards range", () => expect(readRange({ from: "2026-11-10", to: "2026-11-02" }, "today", today)).toMatchObject({ from: "2026-11-02", to: "2026-11-10" }));
  it("one date alone means that day", () => expect(readRange({ from: "2026-11-05" }, "today", today)).toMatchObject({ from: "2026-11-05", to: "2026-11-05" }));
  it("falls back on junk", () => expect(readRange({ range: "nope", from: "x" }, "month", today)).toMatchObject({ from: "2026-11-01", preset: "month" }));
});
