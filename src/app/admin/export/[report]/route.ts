import { currentStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { vendorLedger } from "@/lib/admin/accounts-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const csv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = v instanceof Date ? v.toISOString() : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
};
const inr = (p: unknown) => (Number(p) / 100).toFixed(2);

/** CSV downloads for Excel / Google Sheets. /admin/export/<report>?month=YYYY-MM */
export async function GET(req: Request, { params }: { params: Promise<{ report: string }> }) {
  const staff = await currentStaff();
  if (!staff || !["owner", "manager"].includes(staff.role)) return new Response("forbidden", { status: 403 });
  const { report } = await params;
  const month = new URL(req.url).searchParams.get("month");
  const m = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);
  const start = `${m}-01`;
  const sql = db();
  let rows: Record<string, unknown>[] = [];

  if (report === "stock") {
    rows = (await sql`
      select i.name as ingredient, i.procurement_group as "group", i.unit, coalesce(s.on_hand, 0)::float as on_hand, i.reorder_level::float as reorder_level,
        round(case when i.unit = 'pc' then i.rate_paise_per_unit / 100 else i.rate_paise_per_unit * 10 end, 2) as rate_inr_per_kg_l_pc,
        round((coalesce(s.on_hand, 0) * i.rate_paise_per_unit) / 100, 2) as stock_value_inr,
        coalesce(s.is_low, false) as low,
        (select count(*) from recipe_lines r where r.ingredient_id = i.id) as used_in_dishes
      from ingredients i left join stock_on_hand s on s.ingredient_id = i.id where i.active order by i.procurement_group nulls last, i.name`) as Record<string, unknown>[];
  } else if (report === "stock-ledger") {
    rows = (await sql`
      select to_char(m.created_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') as "when", i.name as ingredient, m.kind, m.quantity::float as quantity, i.unit,
        round(case when m.unit_cost_paise is null then null when i.unit = 'pc' then m.unit_cost_paise / 100 else m.unit_cost_paise * 10 end, 2) as unit_cost_inr,
        o.order_number as order_no, m.note, u.full_name as by
      from stock_movements m join ingredients i on i.id = m.ingredient_id left join orders o on o.id = m.order_id left join staff_users u on u.id = m.actor_id
      where m.created_at >= ${start}::date and m.created_at < (${start}::date + interval '1 month') order by m.created_at`) as Record<string, unknown>[];
  } else if (staff.role !== "owner") {
    return new Response("forbidden", { status: 403 });
  } else if (report === "ledger") {
    rows = ((await sql`
      with ex as (select spent_on as day, sum(amount_paise) as expenses from expenses group by 1),
           bi as (select bill_date as day, sum(amount_paise) as bills from vendor_bills group by 1),
           alld as (select day from daily_sales union select day from ex union select day from bi)
      select alld.day::text as day, coalesce(s.orders, 0) as orders, coalesce(s.net_sales_paise, 0) as net, coalesce(s.gst_paise, 0) as gst, coalesce(s.gross_paise, 0) as gross,
        coalesce(bi.bills, 0) as bills, coalesce(ex.expenses, 0) as expenses
      from alld left join daily_sales s on s.day = alld.day left join ex on ex.day = alld.day left join bi on bi.day = alld.day
      where alld.day >= ${start}::date and alld.day < (${start}::date + interval '1 month') order by alld.day`) as Record<string, unknown>[]).map((r) => ({
      day: r.day, orders: r.orders, net_sales_inr: inr(r.net), gst_inr: inr(r.gst), gross_collected_inr: inr(r.gross), vendor_bills_inr: inr(r.bills), expenses_inr: inr(r.expenses),
      left_over_inr: inr(Number(r.net) - Number(r.bills) - Number(r.expenses)),
    }));
  } else if (report === "bills") {
    rows = ((await sql`
      select v.name as vendor, b.bill_number, b.bill_date::text, b.amount_paise, b.gst_paise, b.due_on::text,
        coalesce((select sum(p.amount_paise) from vendor_payments p where p.vendor_bill_id = b.id), 0) as paid_paise,
        (select string_agg(p.paid_on::text || ' ' || coalesce(p.mode, '') || ' ' || coalesce(p.reference, ''), '; ') from vendor_payments p where p.vendor_bill_id = b.id) as payments,
        b.file_path
      from vendor_bills b join vendors v on v.id = b.vendor_id
      where b.bill_date >= ${start}::date and b.bill_date < (${start}::date + interval '1 month') order by b.bill_date`) as Record<string, unknown>[]).map((r) => ({
      vendor: r.vendor, bill_number: r.bill_number, bill_date: r.bill_date, amount_inr: inr(r.amount_paise), gst_inr: inr(r.gst_paise), paid_inr: inr(r.paid_paise),
      due_inr: inr(Number(r.amount_paise) - Number(r.paid_paise)), due_on: r.due_on, payments: r.payments, attachment: r.file_path ? `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/files/${r.file_path}` : "",
    }));
  } else if (report === "expenses") {
    rows = ((await sql`
      select e.spent_on::text, c.name as category, e.description, e.amount_paise, v.name as paid_to, e.mode, e.reference, u.full_name as entered_by, e.file_path
      from expenses e join expense_categories c on c.id = e.category_id left join vendors v on v.id = e.vendor_id left join staff_users u on u.id = e.created_by
      where e.spent_on >= ${start}::date and e.spent_on < (${start}::date + interval '1 month') order by e.spent_on`) as Record<string, unknown>[]).map((r) => ({
      date: r.spent_on, category: r.category, description: r.description, amount_inr: inr(r.amount_paise), paid_to: r.paid_to, mode: r.mode, reference: r.reference, entered_by: r.entered_by,
      attachment: r.file_path ? `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/files/${r.file_path}` : "",
    }));
  } else if (report === "vendors") {
    rows = (await vendorLedger(start)).map((v) => ({
      vendor: v.name,
      billed_inr: inr(v.billedMonth),
      cash_spends_inr: inr(v.expensesMonth),
      paid_inr: inr(v.paidMonth),
      still_owed_inr: inr(v.outstanding),
      open_bills: v.openBills,
      oldest_due: v.oldestDue ?? "",
    }));
  } else if (report === "orders") {
    rows = ((await sql`
      select o.order_number, to_char(o.paid_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') as paid_at, o.status, c.name as customer, c.phone, o.stay_type, o.property_name, o.room_or_landmark,
        o.subtotal_paise, o.gst_paise, o.delivery_fee_paise, o.total_paise, o.source, o.source_ref,
        (select string_agg(oi.quantity || 'x ' || oi.name_snapshot, '; ') from order_items oi where oi.order_id = o.id) as items,
        (select p.gateway_payment_id from payments p where p.order_id = o.id and p.status in ('captured','refunded') limit 1) as gateway_payment_id
      from orders o join customers c on c.id = o.customer_id
      where o.status not in ('pending_payment') and not o.is_demo and o.created_at >= ${start}::date and o.created_at < (${start}::date + interval '1 month') order by o.order_number`) as Record<string, unknown>[]).map((r) => ({
      order_no: r.order_number, paid_at: r.paid_at, status: r.status, customer: r.customer, phone: r.phone, stay: r.stay_type, property: r.property_name, room: r.room_or_landmark,
      items: r.items, net_inr: inr(r.subtotal_paise), gst_inr: inr(r.gst_paise), delivery_inr: inr(r.delivery_fee_paise), total_inr: inr(r.total_paise), source: r.source, qr_source: r.source_ref, payment_id: r.gateway_payment_id,
    }));
  } else {
    return new Response("unknown report", { status: 404 });
  }

  return new Response(csv(rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="abuandbeyond-${report}-${report === "stock" ? new Date().toISOString().slice(0, 10) : m}.csv"` },
  });
}
