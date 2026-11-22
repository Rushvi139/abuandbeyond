import { DateRangeBar } from "@/components/admin/date-range";
import { TagPaidFrom } from "@/components/admin/tag-paid-from";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { nextDay, readRange } from "@/lib/date-range";
import { PAID_FROM, PAID_FROM_LABEL, type PaidFrom } from "@/lib/admin/paid-from";
import { formatINR } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bank & cash — Abu & Beyond" };

type Out = { acct: PaidFrom | null; paise: number };
type Untagged = { kind: "expense" | "payment"; id: string; day: string; what: string; who: string | null; paise: number; mode: string | null };

const d = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * Money in and out of each of our three accounts: cash from orders, Saraspur
 * (where UPI, the QR scanner and PayU all pay in) and HDFC. Online orders
 * count at their order total; PayU's fee comes off before it lands.
 *
 * Under it, every spend in the range with no account yet, one tap to tag it.
 */
export default async function MoneyPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  await requireRole(["owner", "manager"], "/admin/accounts/money");
  const range = readRange(await searchParams, "month");
  const end = nextDay(range.to);
  const sql = db();

  const [inHand, online, out, untagged, partnerIn] = await Promise.all([
    sql<{ method: string; paise: number }[]>`
      select coalesce(p.method, 'cash') as method, sum(p.amount_paise - p.refunded_paise)::bigint as paise
      from orders o join payments p on p.order_id = o.id and p.gateway = 'on_delivery'
      where not o.is_demo and p.status in ('captured', 'partially_refunded')
        -- the door collection itself, or the extra collected after an edit
        and (p.created_at at time zone 'Asia/Kolkata') >= ${range.from}::date
        and (p.created_at at time zone 'Asia/Kolkata') < ${end}::date
      group by 1`,
    sql<{ paise: number; n: number }[]>`
      select coalesce(sum(total_paise - balance_collected_paise), 0)::bigint as paise, count(*)::int as n from orders
      where payment_mode = 'online' and paid_at is not null and status <> 'cancelled' and not is_demo
        and (paid_at at time zone 'Asia/Kolkata') >= ${range.from}::date
        and (paid_at at time zone 'Asia/Kolkata') < ${end}::date`,
    sql<Out[]>`
      select paid_from as acct, sum(paise)::bigint as paise from (
        select paid_from, amount_paise as paise from expenses where spent_on >= ${range.from}::date and spent_on <= ${range.to}::date
        union all
        select paid_from, amount_paise from vendor_payments where paid_on >= ${range.from}::date and paid_on <= ${range.to}::date
      ) x group by 1`,
    sql<Untagged[]>`
      select * from (
        select 'expense' as kind, e.id, e.spent_on::text as day, e.description as what, v.name as who, e.amount_paise::bigint as paise, e.mode
        from expenses e left join vendors v on v.id = e.vendor_id
        where e.paid_from is null and e.spent_on >= ${range.from}::date and e.spent_on <= ${range.to}::date
        union all
        select 'payment', p.id, p.paid_on::text, coalesce('Bill payment' || ' ' || b.bill_number, 'Bill payment'), v.name, p.amount_paise::bigint, p.mode
        from vendor_payments p join vendors v on v.id = p.vendor_id left join vendor_bills b on b.id = p.vendor_bill_id
        where p.paid_from is null and p.paid_on >= ${range.from}::date and p.paid_on <= ${range.to}::date
      ) x order by day desc limit 300`,
    // Partners settling their statements, into whichever account they paid.
    sql<{ acct: PaidFrom; paise: number }[]>`
      select paid_from as acct, sum(amount_paise)::bigint as paise from partner_statements
      where paid_on >= ${range.from}::date and paid_on <= ${range.to}::date and paid_from is not null group by 1`,
  ]);

  const moneyIn: Record<PaidFrom, number> = { cash: 0, saraspur: 0, hdfc: 0 };
  for (const r of inHand) moneyIn[r.method === "upi" ? "saraspur" : "cash"] += Number(r.paise);
  const onlinePaise = Number(online[0]?.paise ?? 0);
  moneyIn.saraspur += onlinePaise;
  for (const r of partnerIn) moneyIn[r.acct] += Number(r.paise);
  const moneyOut: Record<PaidFrom, number> = { cash: 0, saraspur: 0, hdfc: 0 };
  let notTagged = 0;
  for (const r of out) {
    if (r.acct) moneyOut[r.acct] += Number(r.paise);
    else notTagged += Number(r.paise);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-[32px] uppercase leading-none">Bank &amp; cash</h1>
        <p className="mt-1 text-sm text-muted">What came into and went out of each account. Saraspur is where UPI, the QR scanner and PayU pay in.</p>
      </div>
      <DateRangeBar path="/admin/accounts/money" range={range} />

      <section className="overflow-x-auto rounded-2xl bg-surface">
        <table className="w-full min-w-[520px] text-sm tabular-nums">
          <thead className="text-left text-[11px] uppercase tracking-wide text-muted">
            <tr><th className="px-4 py-2.5">Account</th><th className="px-2 py-2.5 text-right">In (orders &amp; partners)</th><th className="px-2 py-2.5 text-right">Out (spends &amp; bills)</th><th className="px-4 py-2.5 text-right">Net</th></tr>
          </thead>
          <tbody>
            {PAID_FROM.map((f) => (
              <tr key={f} className="border-t border-line">
                <td className="px-4 py-2 font-semibold">{PAID_FROM_LABEL[f]}</td>
                <td className="px-2 py-2 text-right">{formatINR(moneyIn[f])}</td>
                <td className="px-2 py-2 text-right">{formatINR(moneyOut[f])}</td>
                <td className={`px-4 py-2 text-right font-bold ${moneyIn[f] - moneyOut[f] < 0 ? "text-error" : ""}`}>{formatINR(moneyIn[f] - moneyOut[f])}</td>
              </tr>
            ))}
            {notTagged > 0 && (
              <tr className="border-t border-line bg-acid/25">
                <td className="px-4 py-2 font-semibold">Not tagged yet</td>
                <td className="px-2 py-2 text-right">—</td>
                <td className="px-2 py-2 text-right">{formatINR(notTagged)}</td>
                <td className="px-4 py-2 text-right text-muted">tag below</td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="border-t border-line px-4 py-2 text-[12px] text-muted">
          Saraspur in includes online (PayU) orders: {formatINR(onlinePaise)} from {online[0]?.n ?? 0} orders, at order total. PayU pays this out after its fee, so the bank will show a little less.
        </p>
      </section>

      <section className="rounded-2xl bg-surface p-4">
        <h2 className="font-display text-[18px] uppercase">Spends with no account · {untagged.length}</h2>
        <p className="mb-2 text-sm text-muted">Entered before accounts were named, or without one. Tap where the money came from.</p>
        {untagged.length === 0 ? (
          <p className="text-sm text-muted">Everything in this range is tagged.</p>
        ) : (
          <ul className="flex flex-col">
            {untagged.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-2 text-sm last:border-0">
                <span className="w-14 flex-none text-muted">{d(u.day)}</span>
                <span className="min-w-0 flex-1">
                  {u.what}
                  <span className="block text-[12px] text-muted">{[u.who, u.kind === "payment" ? "vendor bill" : "expense", u.mode].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="font-semibold">{formatINR(Number(u.paise))}</span>
                <TagPaidFrom kind={u.kind} id={u.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
