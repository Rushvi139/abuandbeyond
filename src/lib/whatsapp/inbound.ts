import "server-only";
import { db } from "@/lib/db";
import { hoursLine } from "@/lib/hours";
import { STATUS_LABEL, type OrderStatus } from "@/lib/orders/status";
import { rateLimit } from "@/lib/rate-limit";
import { intentOf, type InboundMessage, type Receipt } from "@/lib/whatsapp/intent";
import { queueMessage } from "@/lib/whatsapp/outbox";

const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://abuandbeyond.in";

type Latest = { number: number; code: string; status: OrderStatus; lines: string[] };

/** The guest's most recent real order. Demos and unpaid carts are not "their order". */
async function latestOrder(customerId: string): Promise<Latest | null> {
  const [o] = await db()<{ id: string; number: number; code: string; status: OrderStatus }[]>`
    select id, order_number as number, order_code as code, status from orders
    where customer_id = ${customerId} and is_demo = false and status not in ('pending_payment','payment_failed')
    order by created_at desc limit 1`;
  if (!o) return null;
  const lines = await db()<{ q: number; n: string }[]>`
    select quantity as q, name_snapshot as n from order_items where order_id = ${o.id} order by id`;
  return { ...o, lines: lines.map((l) => `${l.q}× ${l.n}`) };
}

function reply(intent: ReturnType<typeof intentOf>, last: Latest | null): string {
  const menu = `${site()}/`;
  switch (intent) {
    case "stop":
      return "Done. We won't send order updates to this number. Send START any time to turn them back on.";
    case "start":
      return "Welcome back. You'll get order updates here again.";
    case "track":
      if (last) return `Order #${last.number} is ${STATUS_LABEL[last.status].toLowerCase()}.\nFollow it live: ${site()}/o/${last.code}`;
      return `We can't see an order for this number yet. Order here: ${menu}`;
    case "reorder":
      if (last) return `Last time you had ${last.lines.join(", ")}.\nOrder it again: ${menu}`;
      return `Order here: ${menu}`;
    default:
      return `Hi, this is Abu & Beyond. Menu and ordering: ${menu}\nWe deliver ${hoursLine()}.\nReply TRACK for your latest order.`;
  }
}

/**
 * One guest message in, at most one reply queued.
 *
 * The reply goes through the same outbox as everything else, so it is sent
 * by the dispatcher and a failure retries. Free text is allowed because the
 * guest messaged us inside the last 24 hours.
 */
export async function handleInbound(m: InboundMessage): Promise<void> {
  const phone = "+" + m.from.replace(/\D/g, "");
  const sql = db();

  // Meta retries until it gets a 200; the unique id makes a repeat a no-op.
  const stored = await sql`
    insert into whatsapp_messages (phone, direction, kind, body, provider_message_id, status)
    values (${phone}, 'in', 'inbound', ${m.text || null}, ${m.id}, 'received')
    on conflict do nothing returning id`;
  if (stored.length === 0) return;

  const [cust] = await sql<{ id: string }[]>`select id from customers where phone = ${phone}`;
  const intent = intentOf(m.text);

  if (cust && intent === "stop") await sql`update customers set whatsapp_opt_in = false where id = ${cust.id}`;
  if (cust && intent === "start") await sql`update customers set whatsapp_opt_in = true where id = ${cust.id}`;

  // A guest sending ten messages, or two numbers talking to each other, must
  // not turn into ten replies. The opt-out confirmation is always sent.
  if (intent !== "stop" && !rateLimit(`wa:reply:${phone}`, 5, 10 * 60 * 1000).ok) return;

  const last = cust ? await latestOrder(cust.id) : null;
  const body = reply(intent, last);
  await queueMessage({
    orderId: null,
    customerId: cust?.id ?? null,
    toPhone: phone,
    kind: "reply",
    template: null,
    payload: { body },
  });
}

/** Delivery receipts: move our own sent row on to delivered / read / failed. */
export async function applyReceipts(receipts: Receipt[]): Promise<void> {
  const sql = db();
  for (const r of receipts) {
    // Never move backwards: a late "sent" must not undo "read".
    await sql`
      update whatsapp_messages set
        status = ${r.status},
        error = coalesce(${r.error}, error)
      where provider_message_id = ${r.id} and direction = 'out'
        and (${r.status} = 'failed'
          or array_position(array['queued','sent','delivered','read'], status) < array_position(array['queued','sent','delivered','read'], ${r.status}))`;
  }
}
