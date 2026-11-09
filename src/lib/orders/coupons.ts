import "server-only";
import type { Sql } from "postgres";
import { db } from "@/lib/db";

export type Coupon = {
  id: string;
  code: string;
  description: string | null;
  kind: "percent" | "flat";
  percent: number | null;
  valuePaise: number | null;
  maxDiscountPaise: number | null;
  minOrderPaise: number;
  startsOn: string | null;
  endsOn: string | null;
  maxRedemptions: number | null;
  perCustomerLimit: number;
  firstOrderOnly: boolean;
  active: boolean;
};

export type CouponCheck =
  | { ok: true; coupon: Coupon; discountPaise: number }
  | { ok: false; reason: string };

/** Orders that actually hold a coupon slot. An abandoned checkout or a failed
 *  payment must not burn one, so those statuses are excluded here and the same
 *  rule is used for every count. */
const LIVE = ["pending_payment", "payment_failed", "cancelled"];

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/**
 * What a code is worth on this bill, or why it isn't worth anything.
 *
 * Deliberately returns a reason the customer can act on — "add ₹120 more" —
 * rather than a flat no, except where saying more would leak how the coupon
 * works to someone guessing codes.
 */
export async function checkCoupon(
  code: string,
  subtotalPaise: number,
  customerPhone: string | null,
  sql: Sql = db(),
): Promise<CouponCheck> {
  const trimmed = code.trim();
  if (!trimmed) return { ok: false, reason: "Enter a code." };

  const [c] = await sql<Coupon[]>`
    select id, code, description, kind, percent, value_paise as "valuePaise",
      max_discount_paise as "maxDiscountPaise", min_order_paise as "minOrderPaise",
      starts_on::text as "startsOn", ends_on::text as "endsOn",
      max_redemptions as "maxRedemptions", per_customer_limit as "perCustomerLimit",
      first_order_only as "firstOrderOnly", active
    from coupons where upper(code) = upper(${trimmed})`;

  // One message for "no such code" and for "switched off", so the form can't
  // be used to discover which codes exist.
  if (!c || !c.active) return { ok: false, reason: "That code isn't valid." };

  const day = today();
  if (c.startsOn && day < c.startsOn) return { ok: false, reason: "That code isn't active yet." };
  if (c.endsOn && day > c.endsOn) return { ok: false, reason: "That code has expired." };

  if (subtotalPaise < Number(c.minOrderPaise)) {
    const short = (Number(c.minOrderPaise) - subtotalPaise) / 100;
    return { ok: false, reason: `Add ₹${short.toLocaleString("en-IN")} more to use this code.` };
  }

  if (c.maxRedemptions != null) {
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from coupon_redemptions r
      join orders o on o.id = r.order_id
      where r.coupon_id = ${c.id} and o.status <> all(${LIVE})`;
    if (n >= c.maxRedemptions) return { ok: false, reason: "That code has been fully claimed." };
  }

  if (customerPhone) {
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from coupon_redemptions r
      join orders o on o.id = r.order_id
      join customers cu on cu.id = r.customer_id
      where r.coupon_id = ${c.id} and cu.phone = ${customerPhone} and o.status <> all(${LIVE})`;
    if (n >= c.perCustomerLimit) {
      return { ok: false, reason: n === 1 ? "You've already used this code." : "You've used this code the maximum number of times." };
    }

    if (c.firstOrderOnly) {
      const [{ n: past }] = await sql<{ n: number }[]>`
        select count(*)::int as n from orders o join customers cu on cu.id = o.customer_id
        where cu.phone = ${customerPhone} and not o.is_demo and o.status <> all(${LIVE})`;
      if (past > 0) return { ok: false, reason: "That code is for a first order only." };
    }
  }

  return { ok: true, coupon: c, discountPaise: discountFor(c, subtotalPaise) };
}

/**
 * The discount itself. Never more than the bill — a flat ₹200 off a ₹150 order
 * takes ₹150, not ₹200, or the total goes negative and the gateway rejects it.
 */
export function discountFor(c: Coupon, subtotalPaise: number): number {
  const raw =
    c.kind === "percent"
      ? Math.round((subtotalPaise * (c.percent ?? 0)) / 100)
      : Number(c.valuePaise ?? 0);
  const capped = c.maxDiscountPaise != null ? Math.min(raw, Number(c.maxDiscountPaise)) : raw;
  return Math.max(0, Math.min(capped, subtotalPaise));
}

/** How many live orders hold this coupon, for the admin screen. */
export async function redemptionCounts(sql: Sql = db()) {
  return sql<{ couponId: string; used: number; discounted: number }[]>`
    select r.coupon_id as "couponId", count(*)::int as used, sum(r.discount_paise)::bigint as discounted
    from coupon_redemptions r join orders o on o.id = r.order_id
    where o.status <> all(${LIVE})
    group by r.coupon_id`;
}
