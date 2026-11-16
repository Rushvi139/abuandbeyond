import Link from "next/link";
import { SpendForm } from "@/components/admin/spend-form";
import { BOOKKEEPERS, requireRole } from "@/lib/auth";
import { spendFormData } from "@/lib/admin/spend-queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add spend — Abu & Beyond" };

/** The one form for money going out: market runs, supplier bills, salaries, gas, everything. */
export default async function NewSpendPage({ searchParams }: { searchParams: Promise<{ pay?: string }> }) {
  await requireRole(BOOKKEEPERS, "/admin/expenses/new");
  const { pay } = await searchParams;
  const data = await spendFormData();
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <Link href="/admin" className="text-sm font-semibold text-muted underline-offset-2 hover:underline">← Today</Link>
        <h1 className="mt-1 font-display text-[32px] uppercase">Add spend</h1>
        <p className="text-sm text-muted">Anything paid out or owed — vegetables, a supplier&apos;s bill, a salary, the gas. One form; it files itself.</p>
      </div>
      <SpendForm {...data} defaultPay={pay === "credit" ? "credit" : "cash"} />
    </div>
  );
}
