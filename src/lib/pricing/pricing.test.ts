import { describe, expect, it } from "vitest";
import { formatINR, gstOn } from "./index";

describe("pricing", () => {
  it("adds 5% GST in paise, rounded", () => {
    expect(gstOn(67800)).toBe(3390);
    expect(gstOn(29900)).toBe(1495);
  });
  it("formats rupees", () => {
    expect(formatINR(29900)).toBe("₹299");
    expect(formatINR(71190, { decimals: true })).toBe("₹711.90");
    expect(formatINR(150000000)).toBe("₹15,00,000");
  });
});
