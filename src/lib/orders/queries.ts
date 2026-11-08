import "server-only";
import { db } from "@/lib/db";
import type { OrderStatus } from "./status";

export type OrderLine = {
  id: string;
  name: string;
  qty: number;
  unitPaise: number;
  linePaise: number;
  isVeg: boolean;
  stationId: string;
  cuisine: string;
  note: string | null;
  options: string[];
  addons: string[];
};

export type OrderView = {
  id: string;
  number: number;
  isDemo: boolean;
  code: string;
  status: OrderStatus;
  source: string;
  stayType: string;
  propertyName: string | null;
  roomOrLandmark: string | null;
  notes: string | null;
  lat: number | null;
  lng: number | null;
  subtotalPaise: number;
  gstPaise: number;
  deliveryFeePaise: number;
  totalPaise: number;
  prepMinutes: number | null;
  paidAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  gatewayOrderId: string | null;
  customer: { id: string; name: string | null; phone: string };
  rider: { id: string; name: string } | null;
  lines: OrderLine[];
  events: { to: OrderStatus; at: string }[];
};

const base = (sql = db()) => sql`
  select o.id, o.order_number as "number", o.order_code as code, o.status, o.source, o.stay_type as "stayType",
    o.property_name as "propertyName", o.room_or_landmark as "roomOrLandmark", o.notes, o.lat, o.lng, o.is_demo as "isDemo",
    o.subtotal_paise as "subtotalPaise", o.gst_paise as "gstPaise", o.delivery_fee_paise as "deliveryFeePaise", o.total_paise as "totalPaise",
    o.prep_minutes as "prepMinutes", o.paid_at as "paidAt", o.delivered_at as "deliveredAt", o.created_at as "createdAt",
    o.gateway_order_id as "gatewayOrderId",
    json_build_object('id', c.id, 'name', c.name, 'phone', c.phone) as customer,
    case when r.id is null then null else json_build_object('id', r.id, 'name', r.full_name) end as rider,
    coalesce((select json_agg(json_build_object(
        'id', oi.id, 'name', oi.name_snapshot, 'qty', oi.quantity, 'unitPaise', oi.unit_price_paise, 'linePaise', oi.line_total_paise,
        'isVeg', oi.is_veg, 'stationId', oi.station_id, 'cuisine', oi.cuisine, 'note', oi.note,
        'options', coalesce((select json_agg(x.name_snapshot) from order_item_options x where x.order_item_id = oi.id), '[]'::json),
        'addons', coalesce((select json_agg(x.name_snapshot) from order_item_addons x where x.order_item_id = oi.id), '[]'::json)
      ) order by oi.id) from order_items oi where oi.order_id = o.id), '[]'::json) as lines,
    coalesce((select json_agg(json_build_object('to', e.to_status, 'at', e.created_at) order by e.created_at) from order_status_events e where e.order_id = o.id), '[]'::json) as events
  from orders o
  join customers c on c.id = o.customer_id
  left join staff_users r on r.id = o.rider_id`;

export async function getOrderByCode(code: string): Promise<OrderView | null> {
  const sql = db();
  const rows = await sql<OrderView[]>`${base(sql)} where o.order_code = ${code}`;
  return rows[0] ?? null;
}

export async function getOrderById(id: string): Promise<OrderView | null> {
  const sql = db();
  const rows = await sql<OrderView[]>`${base(sql)} where o.id = ${id}`;
  return rows[0] ?? null;
}

/** Live orders for the board / kitchen / rider, oldest first. */
export async function getLiveOrders(statuses: OrderStatus[]): Promise<OrderView[]> {
  const sql = db();
  return sql<OrderView[]>`${base(sql)} where o.status in ${sql(statuses)} order by coalesce(o.paid_at, o.created_at) asc`;
}

export async function getRecentOrders(limit = 50, q?: string): Promise<OrderView[]> {
  const sql = db();
  const like = q ? `%${q}%` : null;
  return sql<OrderView[]>`${base(sql)}
    where o.status not in ('pending_payment')
      and (${like}::text is null or c.phone like ${like} or c.name ilike ${like} or o.order_number::text = ${q ?? ""})
    order by o.created_at desc limit ${limit}`;
}
