import Link from "next/link";
import { notFound } from "next/navigation";
import { PayBill } from "@/components/admin/accounts-forms";
import { VendorDetailsCard } from "@/components/admin/vendor-details";
import { BOOKKEEPERS, requireRole } from "@/lib/auth";
import { vendorDetail } from "@/lib/admin/accounts-queries";
import { formatINR } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const d = (s: string | null) => (s ? new Date(`${s}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" }) : "");
const mon = (s: string) => new Date(`${s}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });

export default async function VendorPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireRole(BOOKKEEPERS, "/admin/accounts");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await vendorDetail(id);
  if (!data) notFound();
  const { vendor, bills, payments, expenses, byMonth } = data;

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const billed = bills.reduce((n, b) => n + Number(b.amount), 0);
  const paidOnBills = bills.reduce((n, b) => n + Number(b.paid), 0);
  const outstanding = billed - paidOnBills;
  const cash = expenses.reduce((n, e) => n + Number(e.amount), 0);
  const open = bills.filter((b) => Number(b.paid) < Number(b.amount));
  const missingInvoice = bills.filter((b) => !b.filePath).length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/admin/accounts" className="text-sm font-semibold text-muted underline-offset-2 hover:underline">← Accounts</Link>
        <VendorDetailsCard vendor={vendor} canEdit={BOOKKEEPERS.includes(staff.role)} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Billed, all time" value={formatINR(billed)} sub={`${bills.length} bill${bills.length === 1 ? "" : "s"}`} />
        <Stat label="Paid against bills" value={formatINR(paidOnBills)} />
        <Stat label="Still owed" value={formatINR(outstanding)} sub={open.length ? `${open.length} open` : "settled"} tone={outstanding > 0 ? "warn" : "good"} />
        <Stat label="Cash spends" value={formatINR(cash)} sub="expenses tagged to them" />
      </div>

      {missingInvoice > 0 && (
        <p className="rounded-xl bg-acid/20 px-4 py-2.5 text-sm">
          <b>{missingInvoice}</b> of {bills.length} bills have no invoice attached. Photograph them before the GST filing.
        </p>
      )}

      {byMonth.length > 1 && (
        <section>
          <h2 className="mb-2 font-display text-[18px] uppercase">Month by month</h2>
          <div className="overflow-x-auto rounded-2xl bg-surface">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr><th className="px-4 py-3">Month</th><th className="px-4 py-3 text-right">Billed</th><th className="px-4 py-3 text-right">Cash spends</th><th className="px-4 py-3 text-right">Paid</th></tr>
              </thead>
              <tbody>
                {byMonth.map((r) => (
                  <tr key={r.month} className="border-t border-line">
                    <td className="px-4 py-2.5 font-semibold">{mon(r.month)}</td>
                    <td className="px-4 py-2.5 text-right">{Number(r.billed) ? formatINR(Number(r.billed)) : <span className="text-muted">—</span>}</td>
                    <td className="px-4 py-2.5 text-right">{Number(r.spent) ? formatINR(Number(r.spent)) : <span className="text-muted">—</span>}</td>
                    <td className="px-4 py-2.5 text-right text-success">{Number(r.paid) ? formatINR(Number(r.paid)) : <span className="text-muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 font-display text-[18px] uppercase">Invoices</h2>
          <div className="flex flex-col gap-2">
            {bills.map((b) => {
              const due = Number(b.amount) - Number(b.paid);
              const late = due > 0 && (b.dueOn ?? b.billDate) < today;
              return (
                <div key={b.id} className={`rounded-2xl bg-surface p-3 text-sm ${due > 0 ? (late ? "border border-error" : "border border-acid") : ""}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{b.billNumber ? `#${b.billNumber}` : "No bill no."}</span>
                    <span className="text-muted">{d(b.billDate)}</span>
                    {b.filePath ? (
                      <a href={`/files/${b.filePath}`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-hill underline-offset-2 hover:underline">view invoice</a>
                    ) : (
                      <span className="text-xs text-muted">no invoice</span>
                    )}
                    <span className="ml-auto font-bold">{formatINR(Number(b.amount))}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                    {Number(b.gst) > 0 && <span>incl. GST {formatINR(Number(b.gst))}</span>}
                    {due <= 0 ? (
                      <span className="font-semibold text-success">Paid</span>
                    ) : (
                      <span className={`font-semibold ${late ? "text-error" : ""}`}>
                        Due {formatINR(due)}{b.dueOn ? ` by ${d(b.dueOn)}` : ""}
                        {Number(b.paid) > 0 && ` · ${formatINR(Number(b.paid))} paid so far`}
                      </span>
                    )}
                    {due > 0 && <PayBill billId={b.id} dueInr={due / 100} />}
                  </div>
                </div>
              );
            })}
            {bills.length === 0 && <p className="rounded-2xl bg-surface p-4 text-center text-sm text-muted">No bills from this vendor yet.</p>}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div>
            <h2 className="mb-2 font-display text-[18px] uppercase">Payments out</h2>
            <div className="overflow-hidden rounded-2xl bg-surface text-sm">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0">
                  <span className="w-16 flex-none text-muted">{d(p.paidOn)}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted">
                    {[p.billNumber && `#${p.billNumber}`, p.mode, p.reference].filter(Boolean).join(" · ") || "—"}
                  </span>
                  <span className="font-bold text-success">{formatINR(Number(p.amount))}</span>
                </div>
              ))}
              {payments.length === 0 && <p className="p-4 text-center text-muted">Nothing paid to them yet.</p>}
            </div>
          </div>

          {expenses.length > 0 && (
            <div>
              <h2 className="mb-2 font-display text-[18px] uppercase">Cash spends</h2>
              <p className="mb-2 text-[11px] text-muted">Expenses tagged to this vendor — paid on the spot, so they never became a bill.</p>
              <div className="overflow-hidden rounded-2xl bg-surface text-sm">
                {expenses.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0">
                    <span className="w-16 flex-none text-muted">{d(e.spentOn)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">{e.description}</span>{" "}
                      <span className="text-xs text-muted">· {e.category}{e.mode ? ` · ${e.mode}` : ""}</span>
                    </span>
                    {e.filePath && (
                      <a href={`/files/${e.filePath}`} target="_blank" rel="noreferrer" className="flex-none text-xs font-semibold text-hill underline-offset-2 hover:underline">slip</a>
                    )}
                    <span className="font-bold">{formatINR(Number(e.amount))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone = "" }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className={`rounded-xl bg-surface px-3 py-2 ${tone === "warn" ? "ring-1 ring-acid" : ""}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`font-display text-[20px] ${tone === "good" ? "text-success" : ""}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  );
}
