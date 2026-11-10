import { describe, expect, it } from "vitest";
import { LEGAL } from "@/lib/legal";
import { formatINR, gstAt, gstOn, gstRegistered } from "./index";

describe("pricing", () => {
  it("works out 5% in paise, rounded", () => {
    expect(gstAt(67800)).toBe(3390);
    expect(gstAt(29900)).toBe(1495);
  });

  // Collecting GST without a registration is not allowed, so the GSTIN is the
  // switch. When one is added, this test flips to the branch below and both
  // keep passing — which is the point.
  it("charges tax only when there is a GSTIN to charge it under", () => {
    expect(gstRegistered()).toBe(Boolean(LEGAL.gstin));
    if (LEGAL.gstin) {
      expect(gstOn(29900)).toBe(1495);
    } else {
      expect(gstOn(29900)).toBe(0);
      expect(gstOn(67800)).toBe(0);
    }
  });
  it("formats rupees", () => {
    expect(formatINR(29900)).toBe("₹299");
    expect(formatINR(71190, { decimals: true })).toBe("₹711.90");
    expect(formatINR(150000000)).toBe("₹15,00,000");
  });
});
