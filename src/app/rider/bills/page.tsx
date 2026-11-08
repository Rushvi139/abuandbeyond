import Image from "next/image";
import Link from "next/link";
import { BillForm, ExpenseForm } from "@/components/admin/accounts-forms";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bills & expenses — Abu & Beyond" };

/**
 * Market-run bookkeeping for whoever is out buying: file a vendor bill or a cash
 * expense, with a photo of the paper. Deliberately shows no sales or margins —
 * the ledger itself stays on the owner's Accounts screen.
 */
export default async function RiderBillsPage() {
  const staff = await requireRole(["owner", "manager", "rider"], "/rider/bills");
  const sql = db();
  const [categories, vendors, mine] = await Promise.all([
    sql<{ id: string; name: string }[]>`select id, name from expense_categories order by name`,
    sql<{ name: string }[]>`select name from vendors where active order by name`,
    sql<{ kind: string; who: string; amount: number; at: string }[]>`
      select 'Expense' as kind, coalesce(c.name, 'Expense') as who, e.amount_paise as amount, e.created_at as at
      from expenses e left join expense_categories c on c.id = e.category_id
      where e.created_by = ${staff.id} and e.created_at > now() - interval '7 days'
      union all
      select 'Bill' as kind, v.name as who, b.amount_paise as amount, b.created_at as at
      from vendor_bills b join vendors v on v.id = b.vendor_id
      where b.created_at > now() - interval '7 days' and b.created_by = ${staff.id}
      order by at desc limit 20`.catch(() => []),
  ]);

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-paper p-4 pb-16">
      <header className="mb-4 flex items-center gap-3">
        <Image src="/brand/patch-primary.png" alt="Abu & Beyond" width={66} height={47} />
        <h1 className="font-display text-[26px] uppercase leading-none">Bills &amp; expenses</h1>
      </header>
      <Link href="/rider" className="mb-4 inline-flex h-10 items-center rounded-xl border-[1.5px] border-ink px-4 text-sm font-semibold">
        ← Deliveries
      </Link>

      <section className="mt-2">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Vendor bill</h2>
        <BillForm vendors={vendors.map((v) => v.name)} />
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Cash expense</h2>
        <ExpenseForm categories={categories} vendors={vendors.map((v) => v.name)} />
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">What you filed this week</h2>
        <div className="overflow-hidden rounded-2xl bg-surface text-sm">
          {mine.map((m, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0">
              <span className="w-14 flex-none text-muted">{new Date(m.at).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}</span>
              <span className="flex-1"><span className="font-semibold">{m.who}</span> <span className="text-xs text-muted">· {m.kind}</span></span>
              <span className="font-bold">{formatINR(m.amount)}</span>
            </div>
          ))}
          {mine.length === 0 && <p className="p-4 text-center text-muted">Nothing filed yet this week.</p>}
        </div>
      </section>
    </div>
  );
}
