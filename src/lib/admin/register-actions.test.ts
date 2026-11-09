import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * These registers let a column name travel from the browser to a server action.
 * A column cannot be a bound parameter, so the only thing standing between a
 * typed cell and `update expenses set <anything>` is the whitelist. These tests
 * hold that line, and check the money guards that protect the vendor ledger.
 */
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const staff = { id: "00000000-0000-4000-8000-000000000001", role: "owner" };
vi.mock("@/lib/auth", () => ({
  BOOKKEEPERS: ["owner", "manager", "rider"],
  MANAGERS: ["owner", "manager"],
  assertRole: vi.fn(async () => staff),
}));

/** Records every statement and what was bound to it, so a test can assert
 *  nothing ran — or check the exact number that reached the column. */
const statements: string[] = [];
const bound: unknown[][] = [];
const rowsFor: { value: Record<string, unknown>[] } = { value: [] };
const sql = Object.assign(
  async (strings: TemplateStringsArray, ...vals: unknown[]) => {
    statements.push(strings.join("?").replace(/\s+/g, " ").trim());
    bound.push(vals);
    return rowsFor.value;
  },
  { begin: async (fn: (tx: unknown) => Promise<unknown>) => fn(sql) },
);

/** The values bound to the one statement matching a fragment. */
const boundFor = (fragment: string) => bound[statements.findIndex((s) => s.includes(fragment))];
vi.mock("@/lib/db", () => ({ db: () => sql }));

const { updateExpenseCell, updateBillCell, updateVendorCell, updateIngredientCell } = await import("./register-actions");
const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  statements.length = 0;
  bound.length = 0;
  rowsFor.value = [];
});

describe("the editable-column whitelist", () => {
  it.each([
    "id",
    "created_by",
    "amount_paise = 1, description",
    "amount_paise; drop table expenses; --",
    "is_one_time",
  ])("refuses %s and runs no statement", async (field) => {
    const r = await updateExpenseCell(ID, field, "1");
    expect(r.error).toBe("That column can't be edited.");
    expect(statements).toHaveLength(0);
  });

  it("refuses a column that is editable on the other table", async () => {
    const r = await updateExpenseCell(ID, "bill_number", "KD-1");
    expect(r.error).toBe("That column can't be edited.");
    expect(statements).toHaveLength(0);
  });

  it("refuses a row id that is not a uuid", async () => {
    const r = await updateExpenseCell("' or 1=1 --", "description", "x");
    expect(r.error).toBe("Unknown row.");
    expect(statements).toHaveLength(0);
  });
});

describe("expense cell validation", () => {
  it("will not blank a description", async () => {
    const r = await updateExpenseCell(ID, "description", "   ");
    expect(r.error).toBe("An expense needs a description.");
    expect(statements).toHaveLength(0);
  });

  it("will not book a zero or negative amount", async () => {
    expect((await updateExpenseCell(ID, "amount_paise", "0")).error).toBe("An expense needs an amount.");
    expect((await updateExpenseCell(ID, "amount_paise", "-40")).error).toBeTruthy();
    expect(statements).toHaveLength(0);
  });

  it("rejects a date that isn't one", async () => {
    const r = await updateExpenseCell(ID, "spent_on", "yesterday");
    expect(r.error).toBeTruthy();
    expect(statements).toHaveLength(0);
  });

  it("saves a good amount", async () => {
    const r = await updateExpenseCell(ID, "amount_paise", "132.50");
    expect(r.error).toBeUndefined();
    expect(statements.join(" ")).toContain("update expenses set amount_paise");
  });
});

describe("every editable surface guards its own columns", () => {
  it.each([
    ["vendor", (f: string) => updateVendorCell(ID, f, "x")],
    ["ingredient", (f: string) => updateIngredientCell(ID, f, "1")],
  ])("%s refuses a column outside its own list", async (_name, call) => {
    for (const field of ["id", "active", "created_at", "name, active = false"]) {
      statements.length = 0;
      expect((await call(field)).error).toBe("That column can't be edited.");
      expect(statements).toHaveLength(0);
    }
  });
});

describe("vendor cells", () => {
  it("refuses a name already taken by another vendor", async () => {
    rowsFor.value = [{ id: "someone-else" }];
    const r = await updateVendorCell(ID, "name", "Abu Dairy");
    expect(r.error).toBe("Another vendor already has that name.");
    expect(statements.join(" ")).not.toContain("update vendors");
  });

  it("will not leave a vendor nameless", async () => {
    const r = await updateVendorCell(ID, "name", "A");
    expect(r.error).toBe("A vendor needs a name.");
    expect(statements).toHaveLength(0);
  });

  it("keeps payment terms a sane whole number of days", async () => {
    expect((await updateVendorCell(ID, "payment_terms_days", "7.5")).error).toContain("whole number");
    expect((await updateVendorCell(ID, "payment_terms_days", "900")).error).toContain("whole number");
    expect(statements).toHaveLength(0);
    expect((await updateVendorCell(ID, "payment_terms_days", "")).error).toBeUndefined();
  });
});

describe("ingredient rates", () => {
  // The conversion that costs every dish on the menu. ₹240/kg must land as
  // 24 paise per gram, not 24000 — a thousandfold error in recipe costing.
  it("stores a per-kilo rate as paise per gram", async () => {
    rowsFor.value = [{ unit: "g" }];
    expect((await updateIngredientCell(ID, "rate", "240")).error).toBeUndefined();
    expect(Number(boundFor("rate_paise_per_unit")[0])).toBeCloseTo(24, 4);
  });

  it("stores a per-litre rate as paise per millilitre", async () => {
    rowsFor.value = [{ unit: "ml" }];
    await updateIngredientCell(ID, "rate", "180"); // ₹180/L
    expect(Number(boundFor("rate_paise_per_unit")[0])).toBeCloseTo(18, 4);
  });

  it("stores a per-piece rate as paise per piece", async () => {
    rowsFor.value = [{ unit: "pc" }];
    await updateIngredientCell(ID, "rate", "12"); // ₹12 each
    expect(Number(boundFor("rate_paise_per_unit")[0])).toBeCloseTo(1200, 4);
  });

  it("keeps a reorder level in base units, as the add form takes it", async () => {
    rowsFor.value = [{ unit: "g" }];
    await updateIngredientCell(ID, "reorder_level", "2000"); // 2000 g
    expect(Number(boundFor("reorder_level")[0])).toBe(2000);
  });

  it("refuses a duplicate ingredient name", async () => {
    rowsFor.value = [{ id: "other" }];
    expect((await updateIngredientCell(ID, "name", "Paneer")).error).toBe("Another ingredient already has that name.");
    expect(statements.join(" ")).not.toContain("update ingredients set name");
  });

  it("refuses a negative rate", async () => {
    expect((await updateIngredientCell(ID, "rate", "-5")).error).toBeTruthy();
    expect(statements).toHaveLength(0);
  });
});

describe("bill cell validation", () => {
  it("will not cut a bill below what has already been paid", async () => {
    rowsFor.value = [{ paid: 1_200_000 }]; // ₹12,000 paid
    const r = await updateBillCell(ID, "amount_paise", "5000"); // ₹5,000
    expect(r.error).toContain("12,000");
    expect(statements.join(" ")).not.toContain("update vendor_bills");
  });

  it("allows a bill to be cut to exactly what was paid", async () => {
    rowsFor.value = [{ paid: 1_200_000 }];
    const r = await updateBillCell(ID, "amount_paise", "12000");
    expect(r.error).toBeUndefined();
    expect(statements.join(" ")).toContain("update vendor_bills set amount_paise");
  });

  it("lets a due date be cleared but not garbled", async () => {
    expect((await updateBillCell(ID, "due_on", "not-a-date")).error).toBe("Use a real date, or clear it.");
    statements.length = 0;
    expect((await updateBillCell(ID, "due_on", "")).error).toBeUndefined();
    expect(statements.join(" ")).toContain("update vendor_bills set due_on");
  });
});
