import Link from "next/link";
import { ExpenseRegister, type ExpenseRow } from "@/components/admin/expense-register";
import { BOOKKEEPERS, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Expense register — Abu & Beyond" };

type Search = { from?: string; to?: string; category?: string; vendor?: string; mode?: string; q?: string };

const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export default async function ExpenseRegisterPage({ searchParams }: { searchParams: Promise<Search> }) {
  const staff = await requireRole(BOOKKEEPERS, "/admin/accounts/expenses");
  const sp = await searchParams;

  // Default to the last eight weeks, because the point of this screen is the
  // week-on-week shape, and a single month can't show it.
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const eightWeeksAgo = (() => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 55);
    return d.toISOString().slice(0, 10);
  })();
  const from = isDate(sp.from) ? sp.from! : eightWeeksAgo;
  const to = isDate(sp.to) ? sp.to! : today;
  const category = sp.category?.trim() || "";
  const vendor = sp.vendor?.trim() || "";
  const mode = sp.mode?.trim() || "";
  const q = sp.q?.trim() || "";

  const sql = db();
  const [rows, categories, vendorNames, modes] = await Promise.all([
    sql<ExpenseRow[]>`
      select e.id, e.spent_on::text as "spentOn", e.description, e.category_id as "categoryId", c.name as category,
        v.name as vendor, e.vendor_id as "vendorId", e.amount_paise::bigint as amount, e.mode, e.reference, e.note,
        e.file_path as "filePath", u.full_name as "updatedBy",
        e.ingredient_id as "ingredientId", i.name as "ingredientName", i.unit::text as "ingredientUnit",
        e.quantity::float as quantity
      from expenses e
      join expense_categories c on c.id = e.category_id
      left join vendors v on v.id = e.vendor_id
      left join staff_users u on u.id = e.updated_by
      left join ingredients i on i.id = e.ingredient_id
      where e.spent_on >= ${from}::date and e.spent_on <= ${to}::date
        and (${category} = '' or e.category_id = ${category})
        and (${vendor} = '' or v.name = ${vendor})
        and (${mode} = '' or e.mode = ${mode})
        and (${q} = '' or e.description ilike ${"%" + q + "%"} or coalesce(e.reference, '') ilike ${"%" + q + "%"})
      order by e.spent_on desc, e.created_at desc
      limit 500`,
    sql<{ id: string; name: string }[]>`select id, name from expense_categories order by name`,
    sql<{ name: string }[]>`select name from vendors order by name`,
    sql<{ mode: string }[]>`select distinct mode from expenses where mode is not null and mode <> '' order by mode`,
  ]);

  const total = rows.reduce((n, r) => n + Number(r.amount), 0);
  const qs = new URLSearchParams(Object.entries({ from, to, category, vendor, mode, q }).filter(([, v]) => v) as [string, string][]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/accounts" className="text-sm font-semibold text-muted underline-offset-2 hover:underline">← Accounts</Link>
          <h1 className="mt-1 font-display text-[32px] uppercase">Expense register</h1>
          <p className="text-sm text-muted">Grouped by week, newest first. {rows.length === 500 && "Showing the most recent 500 — narrow the dates to see further back."}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/accounts/vendors?${qs}`} className="h-10 rounded-xl border-[1.5px] border-ink px-3 text-sm font-semibold leading-10">
            Vendor bills
          </Link>
          <a href={`/admin/export/expenses?month=${to.slice(0, 7)}`} className="h-10 rounded-xl bg-ink px-3 text-sm font-semibold leading-10 text-reversed">
            Excel
          </a>
        </div>
      </div>

      <form className="grid grid-cols-2 gap-2 rounded-2xl bg-surface p-3 sm:grid-cols-3 lg:grid-cols-7">
        <Labelled label="From"><input type="date" name="from" defaultValue={from} className={inp} /></Labelled>
        <Labelled label="To"><input type="date" name="to" defaultValue={to} className={inp} /></Labelled>
        <Labelled label="Category">
          <select name="category" defaultValue={category} className={inp}>
            <option value="">All</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Labelled>
        <Labelled label="Vendor">
          <select name="vendor" defaultValue={vendor} className={inp}>
            <option value="">All</option>
            {vendorNames.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
          </select>
        </Labelled>
        <Labelled label="Paid by">
          <select name="mode" defaultValue={mode} className={inp}>
            <option value="">All</option>
            {modes.map((m) => <option key={m.mode} value={m.mode}>{m.mode}</option>)}
          </select>
        </Labelled>
        <Labelled label="Search"><input name="q" defaultValue={q} placeholder="description or ref" className={inp} /></Labelled>
        <div className="flex items-end gap-2">
          <button type="submit" className="h-10 flex-1 rounded-xl bg-ink text-sm font-semibold text-reversed">Apply</button>
          <Link href="/admin/accounts/expenses" className="h-10 rounded-xl px-2 text-sm leading-10 text-muted">Clear</Link>
        </div>
      </form>

      <p className="px-1 text-sm">
        <b className="font-display text-[20px]">{formatINR(total)}</b>{" "}
        <span className="text-muted">
          across {rows.length} entr{rows.length === 1 ? "y" : "ies"}
          {(category || vendor || mode || q) && " matching these filters"}
        </span>
      </p>

      <ExpenseRegister
        rows={rows.map((r) => ({ ...r, amount: Number(r.amount) }))}
        categories={categories}
        vendors={vendorNames.map((v) => v.name)}
        canEdit={BOOKKEEPERS.includes(staff.role)}
        canDelete={staff.role === "owner"}
      />
    </div>
  );
}

const inp = "h-10 w-full rounded-xl border-[1.5px] border-line bg-paper px-2.5 text-sm outline-none focus:border-ink";

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}
