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
  assertRole: vi.fn(async () => staff),
}));

/** Records every statement so a test can assert nothing ran. */
const statements: string[] = [];
const rowsFor: { value: Record<string, unknown>[] } = { value: [] };
const sql = Object.assign(
  async (strings: TemplateStringsArray, ...vals: unknown[]) => {
    statements.push(strings.join("?").replace(/\s+/g, " ").trim());
    void vals;
    return rowsFor.value;
  },
  { begin: async (fn: (tx: unknown) => Promise<unknown>) => fn(sql) },
);
vi.mock("@/lib/db", () => ({ db: () => sql }));

const { updateExpenseCell, updateBillCell } = await import("./register-actions");
const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  statements.length = 0;
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
