import "server-only";
import { db } from "@/lib/db";
import { WhatsAppError, sendTemplate, sendText, whatsappConfigured } from "@/lib/whatsapp/client";
import type { TemplateComponent } from "@/lib/whatsapp/client";

/**
 * The queue between "something happened to an order" and "Meta accepted a
 * message".
 *
 * Nothing is sent from inside a request. Placing an order must not get slower
 * because Meta is slow, and must not fail because Meta is down — and a send
 * that fails needs somewhere to live so it can be tried again. Same shape as
 * the payment reconciler: write it down first, deliver it separately.
 */
export type Queued = {
  orderId: string | null;
  customerId?: string | null;
  toPhone: string;
  kind: string;
  template?: string | null;
  /** Exactly what will be posted, minus the recipient. */
  payload: { components?: TemplateComponent[]; body?: string };
};

/**
 * Writes one message to the outbox.
 *
 * Never throws: a notification is not worth failing an order over. The unique
 * index on (order_id, kind) means a retried transition or a webhook arriving
 * twice cannot message the guest twice — the second insert is simply dropped.
 */
export async function queueMessage(m: Queued): Promise<void> {
  try {
    const sql = db();
    await sql`
      insert into whatsapp_messages (order_id, customer_id, phone, direction, kind, template, body, payload, status)
      values (${m.orderId}, ${m.customerId ?? null}, ${m.toPhone}, 'out', ${m.kind}, ${m.template ?? null},
              ${m.payload.body ?? null}, ${sql.json(m.payload as never)},
              ${whatsappConfigured() ? "queued" : "skipped"})
      on conflict do nothing`;
  } catch (e) {
    console.error("whatsapp: could not queue", m.kind, e);
  }
}

/** Grows the gap between attempts: ~1, 4, 9, 16 minutes, then gives up. */
const MAX_ATTEMPTS = 5;
const backoffMinutes = (attempt: number) => Math.min(attempt * attempt, 30);

type Row = {
  id: string;
  toPhone: string;
  kind: string;
  template: string | null;
  payload: { components?: TemplateComponent[]; body?: string };
  attempts: number;
};

export type DispatchResult = { checked: number; sent: number; failed: number; retrying: number };

/**
 * Sends what is due. Called by the dispatch route on a timer, the same way
 * the payment reconciler runs — one at a time, because Meta throttles and
 * there is no hurry measured in milliseconds.
 */
export async function dispatchQueued(limit = 20): Promise<DispatchResult> {
  const sql = db();
  const out: DispatchResult = { checked: 0, sent: 0, failed: 0, retrying: 0 };
  if (!whatsappConfigured()) return out;

  const due = await sql<Row[]>`
    select id, phone as "toPhone", kind, template, payload, attempts
    from whatsapp_messages
    where status = 'queued' and direction = 'out' and send_after <= now()
    order by send_after
    limit ${limit}`;
  out.checked = due.length;

  for (const m of due) {
    try {
      const res = m.template
        ? await sendTemplate({ to: m.toPhone, template: m.template, components: m.payload.components })
        : await sendText({ to: m.toPhone, body: m.payload.body ?? "" });
      await sql`update whatsapp_messages
        set status = 'sent', sent_at = now(), attempts = attempts + 1,
            provider_message_id = ${res.id}, error = null
        where id = ${m.id}`;
      out.sent += 1;
    } catch (e) {
      const err = e instanceof WhatsAppError ? e : new WhatsAppError(e instanceof Error ? e.message : "failed", { retryable: false });
      const attempts = m.attempts + 1;
      const give_up = !err.retryable || attempts >= MAX_ATTEMPTS;
      await sql`update whatsapp_messages
        set attempts = ${attempts},
            error = ${err.message.slice(0, 300)},
            status = ${give_up ? "failed" : "queued"},
            send_after = ${give_up ? null : sql`now() + ${`${backoffMinutes(attempts)} minutes`}::interval`}
        where id = ${m.id}`;
      if (give_up) out.failed += 1;
      else out.retrying += 1;
    }
  }

  if (out.sent || out.failed) console.log(`[whatsapp] checked ${out.checked}, sent ${out.sent}, failed ${out.failed}, retrying ${out.retrying}`);
  return out;
}
