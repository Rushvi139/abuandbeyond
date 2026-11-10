// Deliberately not `server-only`: this file holds no secret and no database
// access, just the wording we registered with Meta, and `npm run wa:templates`
// needs to read it from a plain Node script.
import { LEGAL } from "@/lib/legal";

/**
 * The message templates, as they must be submitted to Meta.
 *
 * They live in code so the thing we send and the thing Meta approved are one
 * definition rather than two that drift. `npm run wa:templates` prints them
 * for pasting into WhatsApp Manager.
 *
 * All four are **utility**: they are about a transaction the guest has
 * already made. Submitting an order update as marketing gets it rejected and
 * costs more per message, so the category matters.
 *
 * A template body uses {{1}}, {{2}}… positionally. Meta rejects a template
 * whose body starts or ends with a variable, or has two in a row, so each one
 * below keeps words around them.
 */
export type TemplateDef = {
  /** The name registered with Meta. Lower snake case; it is an identifier. */
  name: string;
  category: "UTILITY";
  language: "en";
  body: string;
  /** What each {{n}} means, in order — for the submission form and for us. */
  variables: string[];
  /** A dynamic URL button, if the template has one. */
  button?: { text: string; urlBase: string };
  example: string[];
};

/** Meta needs a fixed base on a dynamic button; only the tail may vary. */
export const REVIEW_BASE = "https://g.page/r/";

const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://abuandbeyond.in";

export const TEMPLATES: Record<string, TemplateDef> = {
  order_confirmed: {
    name: "order_confirmed",
    category: "UTILITY",
    language: "en",
    body:
      "Thanks {{1}}, your Abu & Beyond order #{{2}} is confirmed for {{3}}. " +
      "We'll message you when it leaves the kitchen. Track it any time on the link below.",
    variables: ["guest first name", "order number", "amount or delivery time"],
    button: { text: "Track my order", urlBase: `${site()}/o/` },
    example: ["Rahul", "1042", "₹598"],
  },

  order_on_the_way: {
    name: "order_on_the_way",
    category: "UTILITY",
    language: "en",
    body:
      "Order #{{1}} is on its way to {{2}}. Our rider will call on arrival. " +
      "Tap below to follow it.",
    variables: ["order number", "where we are delivering"],
    button: { text: "Track my order", urlBase: `${site()}/o/` },
    example: ["1042", "Hotel Hillock, room 12"],
  },

  /**
   * The one that pays for itself. Count and recency of Google reviews move
   * local ranking more than anything on the site, and the moment the food
   * arrives is the only moment a guest will actually tap through.
   */
  order_delivered: {
    name: "order_delivered",
    category: "UTILITY",
    language: "en",
    body:
      "Order #{{1}} is delivered — hope it hit the spot. If it did, a quick " +
      "Google review genuinely helps a new kitchen like ours. Thank you from {{2}}.",
    variables: ["order number", "the kitchen's name"],
    button: { text: "Leave a review", urlBase: REVIEW_BASE },
    example: ["1042", LEGAL.tradeName],
  },

  /** Pay-on-delivery: tell them the amount before the rider is at the door. */
  collect_at_door: {
    name: "collect_at_door",
    category: "UTILITY",
    language: "en",
    body:
      "Order #{{1}} is on its way. Please keep {{2}} ready — our rider takes " +
      "cash or UPI at the door.",
    variables: ["order number", "amount to pay"],
    example: ["1042", "₹598"],
  },
};

/** What to paste into WhatsApp Manager, one template per block. */
export function templateSubmissionText(): string {
  return Object.values(TEMPLATES)
    .map((t) => {
      const lines = [
        `Name:      ${t.name}`,
        `Category:  ${t.category}`,
        `Language:  English (${t.language})`,
        "",
        "Body:",
        t.body,
        "",
        `Variables: ${t.variables.map((v, i) => `{{${i + 1}}} = ${v}`).join("  ·  ")}`,
        `Sample:    ${t.example.map((e, i) => `{{${i + 1}}} = ${e}`).join("  ·  ")}`,
      ];
      if (t.button) {
        lines.push("", `Button:    Visit website · dynamic · "${t.button.text}"`);
        lines.push(`           URL ${t.button.urlBase}{{1}}`);
      }
      return lines.join("\n");
    })
    .join(`\n\n${"-".repeat(64)}\n\n`);
}
