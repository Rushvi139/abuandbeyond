import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const COOKIE = "ab_guest";
const MAX_AGE = 60 * 60 * 24 * 400; // ~13 months

const sign = (id: string) => createHmac("sha256", process.env.SESSION_SECRET ?? "").update(id).digest("base64url");

/**
 * Guests never set a password: ordering once on a device is what remembers them,
 * exactly like leaving a phone number at the counter. The cookie carries the
 * customer id plus an HMAC so it can't be swapped for someone else's.
 */
export async function rememberCustomer(customerId: string) {
  (await cookies()).set(COOKIE, `${customerId}.${sign(customerId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function forgetCustomer() {
  (await cookies()).delete(COOKIE);
}

export async function currentCustomerId(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [id, mac] = raw.split(".");
  if (!id || !mac) return null;
  const expected = sign(id);
  if (mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  return id;
}

export type GuestProfile = {
  id: string;
  name: string | null;
  phone: string;
  orders: number;
  spentPaise: number;
  since: string;
};

export async function currentCustomer(): Promise<GuestProfile | null> {
  const id = await currentCustomerId();
  if (!id) return null;
  const [row] = await db()<GuestProfile[]>`
    select c.id, c.name, c.phone, c.created_at as since,
      (select count(*)::int from orders o where o.customer_id = c.id and o.status not in ('pending_payment','payment_failed')) as orders,
      coalesce((select sum(o.total_paise) from orders o where o.customer_id = c.id and o.status not in ('pending_payment','payment_failed','cancelled')), 0)::bigint as "spentPaise"
    from customers c where c.id = ${id}`;
  return row ?? null;
}

export type PastOrder = {
  id: string;
  code: string;
  number: number;
  status: string;
  placedAt: string;
  totalPaise: number;
  items: { itemId: string | null; name: string; qty: number; optionIds: string[]; addonIds: string[]; note: string | null }[];
};

export async function pastOrders(customerId: string, limit = 20): Promise<PastOrder[]> {
  return db()<PastOrder[]>`
    select o.id, o.order_code as code, o.order_number as number, o.status,
      coalesce(o.paid_at, o.created_at) as "placedAt", o.total_paise as "totalPaise",
      coalesce((
        select json_agg(json_build_object(
          'itemId', oi.menu_item_id, 'name', oi.name_snapshot, 'qty', oi.quantity, 'note', oi.note,
          'optionIds', coalesce((select json_agg(oo.option_id) from order_item_options oo where oo.order_item_id = oi.id), '[]'::json),
          'addonIds', coalesce((select json_agg(oa.addon_id) from order_item_addons oa where oa.order_item_id = oi.id), '[]'::json)
        ) order by oi.name_snapshot)
        from order_items oi where oi.order_id = o.id), '[]'::json) as items
    from orders o
    where o.customer_id = ${customerId} and o.status not in ('pending_payment','payment_failed')
    order by o.order_number desc limit ${limit}`;
}
