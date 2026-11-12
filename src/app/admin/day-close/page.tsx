import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { BUSINESS_DAY_STARTS_AT_HOUR, currentBusinessDay, dayClose } from "@/lib/admin/day-close";
import { formatINR } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Day close — Abu & Beyond" };

const CEILING = 33; // food + packaging as % of net sales (project goal)

const shift = (day: string, by: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
};

/**
 * One screen to close the night: what came in, what it should have cost the
 * kitchen, what's running low. Owner only, like the rest of the books.
 */
export default async function DayClosePage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  await requireRole(["owner"], "/admin/day-close");
  const sp = await searchParams;
  const today = currentBusinessDay();
  const day = sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) && sp.day <= today ? sp.day : today;
  const c = await dayClose(day);

  const label = new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const avg = c.orders ? Math.round(c.netPaise / c.orders) : 0;
  const costPaise = c.foodPaise + c.packagingPaise;
  const costPct = c.netPaise ? Math.round((costPaise / c.netPaise) * 1000) / 10 : null;
  const over = costPct !== null && costPct > CEILING;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/accounts" className="text-sm font-semibold text-muted underline-offset-2 hover:underline">← Accounts</Link>
          <h1 className="mt-1 font-display text-[32px] uppercase">Day close</h1>
          <p className="text-sm text-muted">
            {label}
            {day === today && " · tonight so far"} · runs {BUSINESS_DAY_STARTS_AT_HOUR} AM to {BUSINESS_DAY_STARTS_AT_HOUR} AM, so late-night orders count with the evening they were cooked in
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/day-close?day=${shift(day, -1)}`} className="h-10 rounded-xl border-[1.5px] border-ink px-3 text-sm font-semibold leading-10">← Previous</Link>
          {day < today && (
            <Link href={`/admin/day-close?day=${shift(day, 1)}`} className="h-10 rounded-xl border-[1.5px] border-ink px-3 text-sm font-semibold leading-10">Next →</Link>
          )}
          <form>
            <input type="date" name="day" defaultValue={day} max={today} className="h-10 rounded-xl border-[1.5px] border-line bg-paper px-2.5 text-sm" />
            <button type="submit" className="ml-1 h-10 rounded-xl bg-ink px-3 text-sm font-semibold text-reversed">Go</button>
          </form>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Orders" value={String(c.orders)} sub={`${c.itemsSold} items`} />
        <Stat label="Net sales" value={formatINR(c.netPaise)} sub="food after discounts, before GST" />
        <Stat label="Average order" value={formatINR(avg)} sub="net, per order" />
        <Stat
          label="Food + packaging"
          value={costPct === null ? "—" : `${costPct}%`}
          sub={`${formatINR(costPaise)} · ceiling ${CEILING}%`}
          tone={costPct === null ? "" : over ? "bad" : "good"}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-surface p-4">
          <h2 className="mb-2 font-display text-[18px] uppercase">Money in</h2>
          <Rows
            rows={[
              ["Net sales", formatINR(c.netPaise)],
              ["Discounts given", c.discountPaise ? `− ${formatINR(c.discountPaise)}` : "—"],
              ["GST collected (5%, owed to govt)", formatINR(c.gstPaise)],
              ["Delivery fees", c.deliveryPaise ? formatINR(c.deliveryPaise) : "—"],
              ["Total paid by guests", formatINR(c.grossPaise), true],
              ["of which online (PayU)", formatINR(c.onlinePaise)],
              ["of which pay on delivery", formatINR(c.cashPaise)],
              ["Pay on delivery not yet collected", c.cashUncollectedPaise ? formatINR(c.cashUncollectedPaise) : "—", false, c.cashUncollectedPaise > 0],
            ]}
          />
          {(c.cancelled.count > 0 || c.abandoned > 0) && (
            <p className="mt-3 text-[13px] text-muted">
              {c.cancelled.count > 0 && `${c.cancelled.count} cancelled (${formatINR(c.cancelled.paise)}, not counted above). `}
              {c.abandoned > 0 && `${c.abandoned} reached payment and didn't finish.`}
            </p>
          )}
        </div>

        <div className="rounded-2xl bg-surface p-4">
          <h2 className="mb-2 font-display text-[18px] uppercase">What it should have cost</h2>
          <Rows
            rows={[
              ["Ingredients (by recipe, incl. kitchen loading)", formatINR(c.foodPaise)],
              ["Packaging", formatINR(c.packagingPaise)],
              ["Food + packaging", formatINR(costPaise), true],
              ["Gross margin", c.netPaise ? `${formatINR(c.netPaise - costPaise)} · ${Math.round(((c.netPaise - costPaise) / c.netPaise) * 100)}%` : "—", true],
            ]}
          />
          <p className="mt-3 text-[13px] text-muted">
            From the recipe book at today&apos;s ingredient rates: what the dishes sold should have used. Actual market spend is in vendor bills and expenses.
          </p>
          {c.uncostedQty > 0 && (
            <p className="mt-2 rounded-xl bg-acid/30 px-3 py-2 text-[13px] font-semibold">
              {c.uncostedQty} item{c.uncostedQty === 1 ? "" : "s"} sold had no recipe, so they count as costing nothing — the % above is too low.{" "}
              <Link href="/admin/recipes" className="underline">Fill in recipes</Link>
            </p>
          )}
        </div>

        <div className="rounded-2xl bg-surface p-4">
          <h2 className="mb-2 font-display text-[18px] uppercase">Top dishes</h2>
          {c.topDishes.length === 0 ? (
            <p className="text-sm text-muted">Nothing sold yet.</p>
          ) : (
            <Rows rows={c.topDishes.map((t) => [`${t.qty} × ${t.name}`, formatINR(t.netPaise)] as Row)} />
          )}
        </div>

        <div className="rounded-2xl bg-surface p-4">
          <h2 className="mb-2 font-display text-[18px] uppercase">Running low</h2>
          {c.lowStock.length === 0 ? (
            <p className="text-sm text-muted">Nothing at or below its reorder level. (Only ingredients with a reorder level set are checked.)</p>
          ) : (
            <Rows rows={c.lowStock.map((s) => [s.name, `${s.onHand.toLocaleString("en-IN")} ${s.unit} (reorder at ${s.reorder.toLocaleString("en-IN")})`, false, true] as Row)} />
          )}
          <Link href="/admin/stock" className="mt-3 inline-block text-sm font-semibold underline-offset-2 hover:underline">Inventory →</Link>
        </div>

        <div className="rounded-2xl bg-surface p-4 lg:col-span-2">
          <h2 className="mb-2 font-display text-[18px] uppercase">Money out the same day</h2>
          <Rows
            rows={[
              ["Expenses recorded", formatINR(c.spentPaise.expenses)],
              ["Vendor bills dated today", formatINR(c.spentPaise.bills)],
            ]}
          />
          <Link href="/admin/accounts" className="mt-3 inline-block text-sm font-semibold underline-offset-2 hover:underline">Full ledger →</Link>
        </div>
      </section>
    </div>
  );
}

type Row = [string, string, boolean?, boolean?];

function Rows({ rows }: { rows: Row[] }) {
  return (
    <dl className="flex flex-col">
      {rows.map(([k, v, strong, warn]) => (
        <div key={k} className={`flex items-baseline justify-between gap-3 border-b border-line py-1.5 text-sm last:border-0 ${strong ? "font-bold" : ""}`}>
          <dt className={warn ? "text-error" : ""}>{k}</dt>
          <dd className={`text-right ${warn ? "font-semibold text-error" : ""}`}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Stat({ label, value, sub, tone = "" }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className={`rounded-xl bg-surface px-3 py-2 ${tone === "bad" ? "ring-1 ring-error" : ""}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`font-display text-[22px] ${tone === "bad" ? "text-error" : tone === "good" ? "text-success" : ""}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  );
}
