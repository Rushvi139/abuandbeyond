// Pure on purpose: no database, no secrets. What a guest's message means,
// and how a webhook body is checked, can both be tested without either.
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Meta signs the raw request body with the app secret and sends it as
 * `X-Hub-Signature-256: sha256=<hex>`. Anyone can POST to a public URL, so
 * this is the only thing that says the message really came from Meta.
 * It must be computed over the bytes received, not a re-serialised JSON.
 */
export function validSignature(raw: string, header: string | null, secret: string): boolean {
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  const given = Buffer.from(header.slice(7), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export type Intent = "stop" | "start" | "track" | "reorder" | "menu";

/** Order matters: "stop" must win over everything, and "track" over "menu". */
export function intentOf(text: string): Intent {
  const t = text.trim().toLowerCase();
  if (/^(stop|unsubscribe|opt ?out|cancel messages)\b/.test(t)) return "stop";
  if (/^(start|subscribe|opt ?in)\b/.test(t)) return "start";
  if (/\b(track|status|where|eta|how long|late|update)\b/.test(t)) return "track";
  if (/\b(again|reorder|re-order|same|repeat|last order)\b/.test(t)) return "reorder";
  return "menu";
}

export type InboundMessage = { id: string; from: string; text: string; name: string | null };
export type Receipt = { id: string; status: "sent" | "delivered" | "read" | "failed"; error: string | null };

/** The parts of Meta's webhook body worth keeping. Anything unexpected is ignored. */
export function parseWebhook(body: unknown): { messages: InboundMessage[]; receipts: Receipt[] } {
  const out = { messages: [] as InboundMessage[], receipts: [] as Receipt[] };
  const entries = (body as { entry?: unknown[] } | null)?.entry;
  if (!Array.isArray(entries)) return out;
  for (const e of entries) {
    for (const ch of ((e as { changes?: unknown[] })?.changes ?? []) as { value?: Record<string, unknown> }[]) {
      const v = ch?.value ?? {};
      const names = new Map<string, string>();
      for (const c of (v.contacts as { wa_id?: string; profile?: { name?: string } }[] | undefined) ?? []) {
        if (c.wa_id && c.profile?.name) names.set(c.wa_id, c.profile.name);
      }
      for (const m of (v.messages as { id?: string; from?: string; type?: string; text?: { body?: string }; button?: { text?: string } }[] | undefined) ?? []) {
        if (!m.id || !m.from) continue;
        // Images, voice notes and locations are still a message from a guest;
        // they just have no words to read an intent from.
        const text = m.type === "text" ? m.text?.body ?? "" : m.type === "button" ? m.button?.text ?? "" : "";
        out.messages.push({ id: m.id, from: m.from, text: text.slice(0, 1000), name: names.get(m.from) ?? null });
      }
      for (const s of (v.statuses as { id?: string; status?: string; errors?: { title?: string; message?: string }[] }[] | undefined) ?? []) {
        if (!s.id || !["sent", "delivered", "read", "failed"].includes(s.status ?? "")) continue;
        out.receipts.push({ id: s.id, status: s.status as Receipt["status"], error: s.errors?.[0]?.title ?? s.errors?.[0]?.message ?? null });
      }
    }
  }
  return out;
}
