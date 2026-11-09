import { CouponControls, CouponForm, type CouponRow } from "@/components/admin/coupon-forms";
import { MANAGERS, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { redemptionCounts } from "@/lib/orders/coupons";
import { formatINR } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Coupons — Abu & Beyond" };

const d = (s: string | null) => (s ? new Date(`${s}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }) : null);

export default async function CouponsPage() {
  const staff = await requireRole(MANAGERS, "/admin/coupons");
  const sql = db();
  const [rows, counts] = await Promise.all([
    sql<Omit<CouponRow, "used" | "discounted">[]>`
      select id, code, description, kind, percent, value_paise as "valuePaise",
        max_discount_paise as "maxDiscountPaise", min_order_paise as "minOrderPaise",
        starts_on::text as "startsOn", ends_on::text as "endsOn",
        max_redemptions as "maxRedemptions", per_customer_limit as "perCustomerLimit",
        first_order_only as "firstOrderOnly", active
      from coupons order by active desc, created_at desc`,
    redemptionCounts(sql),
  ]);
  const byId = new Map(counts.map((c) => [c.couponId, c]));
  const coupons: CouponRow[] = rows.map((r) => ({
    ...r,
    minOrderPaise: Number(r.minOrderPaise),
    valuePaise: r.valuePaise == null ? null : Number(r.valuePaise),
    maxDiscountPaise: r.maxDiscountPaise == null ? null : Number(r.maxDiscountPaise),
    used: byId.get(r.id)?.used ?? 0,
    discounted: Number(byId.get(r.id)?.discounted ?? 0),
  }));
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const givenAway = coupons.reduce((n, c) => n + c.discounted, 0);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-[32px] uppercase">Coupons</h1>
        <p className="text-sm text-muted">
          Codes customers type at checkout. The discount comes off before GST, so a ₹100 code costs the kitchen ₹100, not ₹105.
          {givenAway > 0 && <> So far <b className="text-ink">{formatINR(givenAway)}</b> has been given away.</>}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="lg:col-span-1">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">New coupon</h2>
          <CouponForm />
        </section>

        <section className="lg:col-span-2">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
            {coupons.length} code{coupons.length === 1 ? "" : "s"}
          </h2>
          {coupons.length === 0 ? (
            <p className="rounded-2xl bg-surface p-8 text-center text-muted">No coupons yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {coupons.map((c) => {
                const expired = c.endsOn != null && c.endsOn < today;
                const notYet = c.startsOn != null && c.startsOn > today;
                const spent = c.maxRedemptions != null && c.used >= c.maxRedemptions;
                const live = c.active && !expired && !notYet && !spent;
                return (
                  <article key={c.id} className={`grid grid-cols-[1fr_auto] gap-2 rounded-2xl p-3 ${live ? "bg-surface" : "bg-surface opacity-70"}`}>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-baseline gap-2">
                        <span className="font-display text-[20px] uppercase">{c.code}</span>
                        <span className="text-sm font-semibold">
                          {c.kind === "percent" ? `${c.percent}% off` : `${formatINR(c.valuePaise ?? 0)} off`}
                          {c.maxDiscountPaise != null && c.kind === "percent" && ` up to ${formatINR(c.maxDiscountPaise)}`}
                        </span>
                        {!live && (
                          <span className="rounded-full bg-paper px-2 py-0.5 text-[10px] font-bold uppercase">
                            {!c.active ? "off" : expired ? "expired" : notYet ? "not yet" : "fully claimed"}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-[13px] text-muted">
                        {[
                          c.description,
                          c.minOrderPaise > 0 && `min ${formatINR(c.minOrderPaise)}`,
                          c.firstOrderOnly && "first order only",
                          c.perCustomerLimit > 1 ? `${c.perCustomerLimit} per customer` : "once per customer",
                          d(c.startsOn) && d(c.endsOn)
                            ? `${d(c.startsOn)} – ${d(c.endsOn)}`
                            : d(c.endsOn)
                              ? `until ${d(c.endsOn)}`
                              : d(c.startsOn)
                                ? `from ${d(c.startsOn)}`
                                : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="mt-0.5 text-[13px]">
                        <b>{c.used}</b>
                        {c.maxRedemptions != null ? ` of ${c.maxRedemptions}` : ""} used
                        {c.discounted > 0 && <span className="text-muted"> · {formatINR(c.discounted)} given away</span>}
                      </p>
                    </div>
                    <CouponControls coupon={c} canDelete={staff.role === "owner"} />
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
