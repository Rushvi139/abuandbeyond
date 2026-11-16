import Link from "next/link";
import { DateRangeBar } from "@/components/admin/date-range";
import { requireRole } from "@/lib/auth";
import { rangeLabel, readRange } from "@/lib/date-range";
import { formatINR } from "@/lib/pricing";
import { vendorLedger } from "@/lib/admin/accounts-queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vendors — Abu & Beyond" };

const d = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/** One line per vendor: bought and paid in the chosen dates, and what is owed in total. */
export default async function VendorListPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  await requireRole(["owner"], "/admin/accounts/vendor-list");
  const range = readRange(await searchParams, "month");
  const ledger = await vendorLedger(range.from, range.to);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const n = (x: unknown) => Number(x);
  const cell = (v: number) => (v ? formatINR(v) : <span className="text-muted">—</span>);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-[32px] uppercase leading-none">Vendors</h1>
        <p className="mt-1 text-sm text-muted">Billed, cash spends and paid are for {rangeLabel(range)}. Still owed is every unpaid bill, whenever it was raised.</p>
      </div>
      <DateRangeBar path="/admin/accounts/vendor-list" range={range} />
      <div className="overflow-x-auto rounded-2xl bg-surface">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wide text-muted"><tr><th className="px-4 py-2.5">Vendor</th><th className="px-2 py-2.5 text-right">Billed</th><th className="px-2 py-2.5 text-right">Cash spends</th><th className="px-2 py-2.5 text-right">Paid</th><th className="px-4 py-2.5 text-right">Still owed</th></tr></thead>
          <tbody>
            {ledger.map((v) => {
              const late = v.oldestDue && v.oldestDue < today;
              return (
                <tr key={v.id} className="border-t border-line">
                  <td className="px-4 py-2"><Link href={`/admin/accounts/vendors/${v.id}`} className="font-semibold underline-offset-2 hover:underline">{v.name}</Link>{v.oldestDue && <span className={`block text-[11px] ${late ? "font-semibold text-error" : "text-muted"}`}>{late ? "overdue since" : "due"} {d(v.oldestDue)}</span>}</td>
                  <td className="px-2 py-2 text-right">{cell(n(v.billedMonth))}</td>
                  <td className="px-2 py-2 text-right">{cell(n(v.expensesMonth))}</td>
                  <td className="px-2 py-2 text-right text-success">{cell(n(v.paidMonth))}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${n(v.outstanding) ? (late ? "text-error" : "") : "text-muted"}`}>{n(v.outstanding) ? formatINR(n(v.outstanding)) : "settled"}</td>
                </tr>
              );
            })}
            {ledger.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">No vendor activity in these dates and nothing owed.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
