import "server-only";

/**
 * WhatsApp Cloud API.
 *
 * There is no way to automate a normal WhatsApp account. The libraries that
 * drive whatsapp-web break Meta's terms and get numbers banned, and the number
 * at risk is the one printed on our packaging and on every page of the site.
 * So: the official Cloud API, or a human pressing send.
 *
 * The rule that shapes everything here: a business may only send free-form
 * text inside 24 hours of the guest's last message. Outside that window it
 * must be a template Meta approved in advance. A guest who just ordered has
 * not messaged us, so every order update is a template send.
 */
const VERSION = "v23.0";

const token = () => process.env.WHATSAPP_ACCESS_TOKEN ?? "";
const phoneId = () => process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";

export function whatsappConfigured() {
  return Boolean(token() && phoneId());
}

export type SendResult = { id: string };

/** Meta's error shape, the parts worth acting on. */
type MetaError = { error?: { message?: string; code?: number; error_subcode?: number; type?: string } };

export class WhatsAppError extends Error {
  readonly retryable: boolean;
  readonly code?: number;
  constructor(message: string, opts: { retryable: boolean; code?: number }) {
    super(message);
    this.retryable = opts.retryable;
    this.code = opts.code;
  }
}

/**
 * Whether trying again could work. A bad token or a rejected template will
 * fail identically forever, and retrying those just burns the queue; a rate
 * limit or a 5xx is worth another go.
 */
function retryable(status: number, code?: number) {
  if (status >= 500) return true;
  if (status === 429) return true;
  // 131026 "message undeliverable", 131047 "re-engagement required": the
  // number may simply not be on WhatsApp. Not worth hammering.
  if (code === 131026 || code === 131047 || code === 131051) return false;
  // 130429 / 80007 are throughput limits.
  if (code === 130429 || code === 80007) return true;
  return false;
}

async function post(body: unknown): Promise<SendResult> {
  if (!whatsappConfigured()) throw new WhatsAppError("WhatsApp is not configured", { retryable: false });

  let res: Response;
  try {
    res = await fetch(`https://graph.facebook.com/${VERSION}/${phoneId()}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (e) {
    // Couldn't reach Meta at all — always worth another attempt.
    throw new WhatsAppError(e instanceof Error ? e.message : "network error", { retryable: true });
  }

  const json = (await res.json().catch(() => ({}))) as MetaError & { messages?: { id: string }[] };
  if (!res.ok) {
    const code = json.error?.code;
    throw new WhatsAppError(json.error?.message ?? `Meta returned ${res.status}`, { retryable: retryable(res.status, code), code });
  }
  const id = json.messages?.[0]?.id;
  if (!id) throw new WhatsAppError("Meta accepted the call but returned no message id", { retryable: false });
  return { id };
}

/** E.164 without the +, which is what Meta wants in `to`. */
export const waNumber = (phone: string) => phone.replace(/\D/g, "");

export type TemplateComponent =
  | { type: "body"; parameters: { type: "text"; text: string }[] }
  | { type: "button"; sub_type: "url"; index: "0"; parameters: { type: "text"; text: string }[] };

/** A business-initiated message. Must name a template Meta has approved. */
export function sendTemplate(args: { to: string; template: string; language?: string; components?: TemplateComponent[] }) {
  return post({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: waNumber(args.to),
    type: "template",
    template: {
      name: args.template,
      language: { code: args.language ?? "en" },
      ...(args.components?.length ? { components: args.components } : {}),
    },
  });
}

/**
 * Free-form text. Only legal inside 24 hours of the guest's last inbound
 * message — use it for replies, never to start a conversation.
 */
export function sendText(args: { to: string; body: string; previewUrl?: boolean }) {
  return post({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: waNumber(args.to),
    type: "text",
    text: { body: args.body, preview_url: args.previewUrl ?? true },
  });
}
