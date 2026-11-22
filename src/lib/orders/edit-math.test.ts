import { describe, expect, it } from "vitest";
import { balanceAfterEdit, editSummary, editTotals, type EditLine } from "./edit-math";

const noGst = () => 0;
const gst5 = (n: number) => Math.round(n * 0.05);

const line = (over: Partial<EditLine>): EditLine => ({ itemId: "i", name: "Dish", qty: 1, unitPaise: 10000, optionNames: [], addonNames: [], ...over });

describe("editTotals", () => {
  it("adds up lines and keeps the delivery fee", () => {
    expect(editTotals([{ qty: 2, unitPaise: 19900 }, { qty: 1, unitPaise: 9900 }], { discountPaise: 0, complimentary: false, deliveryFeePaise: 2000 }, noGst))
      .toEqual({ subtotalPaise: 49700, discountPaise: 0, gstPaise: 0, totalPaise: 51700 });
  });
  it("never lets the old discount exceed the new subtotal", () => {
    const t = editTotals([{ qty: 1, unitPaise: 5000 }], { discountPaise: 10000, complimentary: false, deliveryFeePaise: 0 }, noGst);
    expect(t.discountPaise).toBe(5000);
    expect(t.totalPaise).toBe(0);
  });
  it("takes GST on the discounted value", () => {
    const t = editTotals([{ qty: 1, unitPaise: 20000 }], { discountPaise: 2000, complimentary: false, deliveryFeePaise: 0 }, gst5);
    expect(t.gstPaise).toBe(900);
    expect(t.totalPaise).toBe(18900);
  });
  it("keeps a complimentary order free", () => {
    const t = editTotals([{ qty: 3, unitPaise: 25000 }], { discountPaise: 0, complimentary: true, deliveryFeePaise: 2000 }, gst5);
    expect(t.totalPaise).toBe(0);
    expect(t.discountPaise).toBe(75000);
  });
});

describe("editSummary", () => {
  const before = [line({ orderItemId: "a", name: "Butter Chicken" }), line({ orderItemId: "b", name: "Jeera Rice" })];
  it("lists additions, removals and quantity changes", () => {
    const after = [line({ orderItemId: "a", name: "Butter Chicken", qty: 2 }), line({ name: "Tawa Roti", qty: 4 })];
    expect(editSummary(before, after)).toBe("Butter Chicken qty 1 to 2; ADD 4 Tawa Roti; REMOVE 1 Jeera Rice");
  });
  it("names an add-on put on an existing line", () => {
    const after = [line({ orderItemId: "a", name: "Butter Chicken", addonNames: ["Extra cheese"] }), before[1]];
    expect(editSummary(before, after)).toBe("Butter Chicken NOW Butter Chicken +Extra cheese");
  });
  it("says so when nothing changed", () => {
    expect(editSummary(before, before)).toBe("No change");
  });
});

describe("balanceAfterEdit", () => {
  it("is the difference once money has been taken", () => {
    expect(balanceAfterEdit(60000, 45000, true)).toBe(15000);
    expect(balanceAfterEdit(30000, 45000, true)).toBe(-15000);
  });
  it("is nothing before any money is taken", () => {
    expect(balanceAfterEdit(60000, 0, false)).toBe(0);
  });
});
