import "server-only";
import { db } from "@/lib/db";
import { clockLabel } from "@/lib/hours";
import { formatINR } from "@/lib/pricing";
import { REVIEW_BASE, TEMPLATES } from "@/lib/whatsapp/templates";
import { queueMessage } from "@/lib/whatsapp/outbox";

/**
 * Which order events are worth a guest's attention.
 *
 * Three, deliberately. A message per status change would be five or six
 * notifications for one dinner, which is how a business gets muted — and on
 * WhatsApp, muted means the delivered message asking for a review is never
 * seen either.
 */
type OrderRow = {
  id: string;
  number: number;
  code: string;
  totalPaise: number;
  paymentMode: string;
  collectedAt: string | null;
  isDemo: boolean;
  scheduledFor: string | null;
  propertyName: string | null;
  roomOrLandmark: string | null;
  stayType: string;
  customerId: string;
  name: string | null;
  phone: string;
  optIn: boolean;
};

async function load(orderId: string): Promise<OrderRow | null> {
  const [row] = await db()<OrderRow[]>`
    select o.id, o.order_number as "number", o.order_code as code, o.total_paise as "totalPaise",
      o.payment_mode as "paymentMode", o.collected_at as "collectedAt", o.is_demo as "isDemo",
      o.scheduled_for as "scheduledFor", o.property_name as "propertyName",
      o.room_or_landmark as "roomOrLandmark", o.stay_type as "stayType",
      c.id as "customerId", c.name, c.phone, c.whatsapp_opt_in as "optIn"
    from orders o join customers c on c.id = o.customer_id
    where o.id = ${orderId}`;
  return row ?? null;
}

const firstName = (n: string | null) => (n?.trim().split(/\s+/)[0] || "there").slice(0, 40);
const whereTo = (o: OrderRow) => [o.propertyName, o.roomOrLandmark].filter(Boolean).join(", ") || o.stayType;

/** The review link the owner set in /admin, if there is one. */
async function reviewLink(): Promise<string | null> {
  try {
    const [row] = await db()<{ value: { google_review?: string | null } }[]>`select value from settings where key = 'social_links'`;
    return row?.value?.google_review?.trim() || null;
  } catch {
    return null;
  }
}

/** Meta wants only the bit after the button's fixed URL prefix. */
const urlButton = (suffix: string) => ({ type: "button" as const, sub_type: "url" as const, index: "0" as const, parameters: [{ type: "text" as const, text: suffix }] });
const body = (...texts: string[]) => ({ type: "body" as const, parameters: texts.map((text) => ({ type: "text" as const, text })) });

/**
 * Queues whatever this status change deserves.
 *
 * Called from `transition`, after the status is committed. A demo order or a
 * guest who opted out gets nothing; everything else is written to the outbox
 * and delivered by the dispatcher.
 */
export async function notifyOrderStatus(orderId: string, to: string): Promise<void> {
  const kinds: Record<string, string> = { paid: "order_confirmed", out_for_delivery: "order_on_the_way", delivered: "order_delivered" };
  const kind = kinds[to];
  if (!kind) return;

  const o = await load(orderId);
  if (!o) return;
  // Demos walk the whole flow on purpose; they must never reach a real phone.
  if (o.isDemo || !o.optIn) return;

  const common = { orderId: o.id, customerId: o.customerId, toPhone: o.phone };

  if (kind === "order_confirmed") {
    const when = o.scheduledFor ? `delivery at ${clockLabel(new Date(o.scheduledFor))}` : formatINR(o.totalPaise, { decimals: true });
    await queueMessage({
      ...common,
      kind,
      template: TEMPLATES.order_confirmed.name,
      payload: { components: [body(firstName(o.name), String(o.number), when), urlButton(o.code)] },
    });
    return;
  }

  if (kind === "order_on_the_way") {
    await queueMessage({
      ...common,
      kind,
      template: TEMPLATES.order_on_the_way.name,
      payload: { components: [body(String(o.number), whereTo(o))] },
    });
    // Pay on delivery and not yet collected: say the amount before the rider
    // is at the door, so nobody is hunting for cash on the step.
    if (o.paymentMode === "on_delivery" && !o.collectedAt) {
      await queueMessage({
        ...common,
        kind: "collect_at_door",
        template: TEMPLATES.collect_at_door.name,
        payload: { components: [body(String(o.number), formatINR(o.totalPaise, { decimals: true }))] },
      });
    }
    return;
  }

  // Delivered: the review ask. Only when there is somewhere to send them.
  const link = await reviewLink();
  // The registered button is https://g.page/r/{{1}}; a link on another host
  // cannot be sent through it, so skip rather than send a broken message.
  if (!link || !link.startsWith(REVIEW_BASE)) return;
  await queueMessage({
    ...common,
    kind,
    template: TEMPLATES.order_delivered.name,
    payload: { components: [body(String(o.number), "Abu & Beyond"), urlButton(link.slice(REVIEW_BASE.length))] },
  });
}
