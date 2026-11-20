import { db } from "@/lib/db";

/**
 * B2B partners are rows in `properties`: a hotel or business with its own QR
 * link. With billing = 'credit', every order from that link goes on the
 * partner's account (orders.payment_mode = 'credit') and is settled in bulk
 * through a statement.
 *
 * An order is "unbilled" until a statement takes it in; a statement is
 * "outstanding" until it is marked paid.
 */

/** Orders that count on an account: placed and not cancelled. */
const LIVE = ["pending_payment", "payment_failed", "cancelled"];

export type PartnerRow = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  contactPerson: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  billing: "guest" | "credit";
  creditDays: number;
  viewToken: string;
  orders: number;
  unbilledPaise: number;
  unbilledOrders: number;
  outstandingPaise: number;
  overdue: number;
};

export async function listPartners(): Promise<PartnerRow[]> {
  return db()<PartnerRow[]>`select * from (${listPartnersSql()}) x order by x.active desc, (x.billing = 'credit') desc, x.name`;
}

export type PartnerOrder = {
  id: string;
  number: number;
  code: string;
  at: string;
  status: string;
  guest: string | null;
  room: string | null;
  items: string | null;
  totalPaise: number;
  statementNumber: string | null;
};

export type Statement = {
  id: string;
  number: string;
  periodFrom: string;
  periodTo: string;
  orderCount: number;
  amountPaise: number;
  issuedOn: string;
  dueOn: string;
  paidOn: string | null;
  paidFrom: string | null;
  reference: string | null;
  note: string | null;
};

const orderCols = (sql: ReturnType<typeof db>) => sql`
  o.id, o.order_number as number, o.order_code as code, o.created_at as at, o.status, c.name as guest,
  o.room_or_landmark as room, o.total_paise::bigint as "totalPaise", s.number as "statementNumber",
  (select string_agg(oi.quantity || '× ' || oi.name_snapshot, ', ' order by oi.name_snapshot) from order_items oi where oi.order_id = o.id) as items`;

export async function partnerById(id: string) {
  const [p] = await db()<PartnerRow[]>`select * from (${listPartnersSql()}) x where x.id = ${id}`;
  return p ?? null;
}

export async function partnerByToken(token: string) {
  if (!/^[a-f0-9]{24,64}$/.test(token)) return null;
  const [p] = await db()<PartnerRow[]>`select * from (${listPartnersSql()}) x where x."viewToken" = ${token} and x.active`;
  return p ?? null;
}

/** The same select as listPartners, as a fragment to filter on. */
function listPartnersSql() {
  const sql = db();
  return sql`
    select p.id, p.slug, p.name, p.kind, p.contact_person as "contactPerson", p.phone, p.address, p.notes, p.active,
      p.billing, p.credit_days as "creditDays", p.view_token as "viewToken",
      (select count(*) from orders o where o.property_id = p.id and o.status <> all(${LIVE}))::int as orders,
      (select coalesce(sum(o.total_paise), 0) from orders o where o.property_id = p.id and o.payment_mode = 'credit'
         and o.statement_id is null and o.status <> all(${LIVE}))::bigint as "unbilledPaise",
      (select count(*) from orders o where o.property_id = p.id and o.payment_mode = 'credit'
         and o.statement_id is null and o.status <> all(${LIVE}))::int as "unbilledOrders",
      (select coalesce(sum(s.amount_paise), 0) from partner_statements s where s.property_id = p.id and s.paid_on is null)::bigint as "outstandingPaise",
      (select count(*) from partner_statements s where s.property_id = p.id and s.paid_on is null
         and s.due_on < (now() at time zone 'Asia/Kolkata')::date)::int as overdue
    from properties p`;
}

/** A partner's orders, newest first: every order from its link, on account or not. */
export async function partnerOrders(propertyId: string, limit = 200): Promise<PartnerOrder[]> {
  const sql = db();
  return sql<PartnerOrder[]>`
    select ${orderCols(sql)}
    from orders o join customers c on c.id = o.customer_id left join partner_statements s on s.id = o.statement_id
    where o.property_id = ${propertyId} and o.status <> all(${LIVE})
    order by o.created_at desc limit ${limit}`;
}

export async function partnerStatements(propertyId: string): Promise<Statement[]> {
  return db()<Statement[]>`
    select id, number, period_from::text as "periodFrom", period_to::text as "periodTo", order_count as "orderCount",
      amount_paise::bigint as "amountPaise", issued_on::text as "issuedOn", due_on::text as "dueOn", paid_on::text as "paidOn",
      paid_from as "paidFrom", reference, note
    from partner_statements where property_id = ${propertyId} order by issued_on desc, number desc`;
}

export async function statementWithOrders(statementId: string) {
  const sql = db();
  const [st] = await sql<(Statement & { propertyId: string })[]>`
    select id, property_id as "propertyId", number, period_from::text as "periodFrom", period_to::text as "periodTo", order_count as "orderCount",
      amount_paise::bigint as "amountPaise", issued_on::text as "issuedOn", due_on::text as "dueOn", paid_on::text as "paidOn",
      paid_from as "paidFrom", reference, note
    from partner_statements where id = ${statementId}`;
  if (!st) return null;
  const orders = await sql<PartnerOrder[]>`
    select ${orderCols(sql)}
    from orders o join customers c on c.id = o.customer_id left join partner_statements s on s.id = o.statement_id
    where o.statement_id = ${statementId} order by o.created_at`;
  return { statement: st, orders };
}
