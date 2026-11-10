import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: () => null }));
const { discountFor } = await import("./coupons");
import type { Coupon } from "./coupons";

const coupon = (over: Partial<Coupon>): Coupon => ({
  id: "c", code: "X", description: null, kind: "percent", percent: null, valuePaise: null,
  maxDiscountPaise: null, minOrderPaise: 0, startsOn: null, endsOn: null,
  maxRedemptions: null, perCustomerLimit: 1, firstOrderOnly: false, active: true,
  ...over,
});

describe("what a coupon takes off", () => {
  it("takes a percentage of the item total", () => {
    expect(discountFor(coupon({ kind: "percent", percent: 20 }), 50_000)).toBe(10_000);
  });

  it("rounds a percentage to whole paise", () => {
    // ₹333.33 at 15% is 4999.95 paise — money has no fractions of a paisa.
    expect(discountFor(coupon({ kind: "percent", percent: 15 }), 33_333)).toBe(5_000);
  });

  it("honours the cap on a percentage", () => {
    const c = coupon({ kind: "percent", percent: 50, maxDiscountPaise: 15_000 });
    expect(discountFor(c, 100_000)).toBe(15_000); // ₹500 order, 50% would be ₹250
    expect(discountFor(c, 20_000)).toBe(10_000); // small order, the cap doesn't bite
  });

  it("takes a flat amount", () => {
    expect(discountFor(coupon({ kind: "flat", valuePaise: 10_000 }), 60_000)).toBe(10_000);
  });

  // The one that would hand money back: ₹200 off a ₹150 order must take ₹150,
  // not ₹200, or the total goes negative and the gateway refuses it.
  it("never takes more than the bill", () => {
    expect(discountFor(coupon({ kind: "flat", valuePaise: 20_000 }), 15_000)).toBe(15_000);
    expect(discountFor(coupon({ kind: "flat", valuePaise: 20_000 }), 0)).toBe(0);
  });

  it("never returns a negative discount", () => {
    expect(discountFor(coupon({ kind: "percent", percent: 10 }), 0)).toBe(0);
  });

  it("a 100% code clears the food but is still bounded by it", () => {
    expect(discountFor(coupon({ kind: "percent", percent: 100 }), 42_000)).toBe(42_000);
  });
});

describe("GST follows the discount", () => {
  // Worked by hand: ₹500 of food, ₹100 off, 5% GST on the ₹400 that is actually
  // being paid for = ₹20, not ₹25. Charging GST on the pre-discount value would
  // overcharge the customer and overstate the kitchen's output tax.
  it("is charged on the discounted value", async () => {
    // gstAt, not gstOn: the rule under test is which base the tax applies to,
    // and that must stay right whether or not we are currently registered.
    const { gstAt } = await import("../pricing");
    const subtotal = 50_000;
    const discount = discountFor(coupon({ kind: "flat", valuePaise: 10_000 }), subtotal);
    expect(discount).toBe(10_000);
    expect(gstAt(subtotal - discount)).toBe(2_000);
    expect(gstAt(subtotal)).toBe(2_500);
  });
});
