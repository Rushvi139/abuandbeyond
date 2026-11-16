import Link from "next/link";
import { ExpenseForm } from "@/components/admin/accounts-forms";
import { BOOKKEEPERS, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add expense — Abu & Beyond" };

/** The dashboard's "+ Expense" shortcut: just the form, nothing else on the page. */
export default async function NewExpensePage() {
  await requireRole(BOOKKEEPERS, "/admin/expenses/new");
  const sql = db();
  const [categories, vendors, ingredients] = await Promise.all([
    sql<{ id: string; name: string }[]>`select id, name from expense_categories order by name`,
    sql<{ name: string }[]>`select name from vendors where active order by name`,
    sql<{ id: string; name: string; unit: string }[]>`select id, name, unit::text from ingredients where active order by name`,
  ]);
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div>
        <Link href="/admin" className="text-sm font-semibold text-muted underline-offset-2 hover:underline">← Today</Link>
        <h1 className="mt-1 font-display text-[32px] uppercase">Add expense</h1>
        <p className="text-sm text-muted">Market run, gas, repairs — anything paid out. If it was an ingredient, pick it below and the stock goes up too.</p>
      </div>
      <ExpenseForm categories={categories} vendors={vendors.map((v) => v.name)} ingredients={ingredients} />
      <Link href="/admin/accounts/expenses" className="text-sm font-semibold underline-offset-2 hover:underline">See all expenses →</Link>
    </div>
  );
}
