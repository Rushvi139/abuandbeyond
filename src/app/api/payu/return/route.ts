import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyResponseHash, type PayuResponse } from "@/lib/payments/payu";
import { settleOrder, site } from "@/lib/payments/payu-flow";

export const runtime = "nodejs";

/**
 * Where PayU sends the guest back (both surl and furl), as a form post
 * through their browser.
 *
 * Because it passes through the browser, nothing in it is believed: the
 * txnid only tells us which order to ask about, and `settleOrder` asks PayU
 * itself. The reverse hash is checked too, but only to log tampering — a bad
 * hash still gets the guest back to their order page, it just can't do
 * anything else.
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const r = Object.fromEntries([...(form?.entries() ?? [])].map(([k, v]) => [k, String(v)])) as PayuResponse;
  const txnid = (r.txnid ?? "").slice(0, 40);

  const [a] = txnid
    ? await db()<{ orderId: string; code: string }[]>`
        select a.order_id as "orderId", o.order_code as code
        from payment_attempts a join orders o on o.id = a.order_id where a.txnid = ${txnid}`
    : [];
  const origin = site(req);
  if (!a) return NextResponse.redirect(`${origin}/`, 303);

  if (!verifyResponseHash(r)) console.warn(`[payu return] hash mismatch for ${txnid}`);
  try {
    await settleOrder(a.orderId, "return");
  } catch (e) {
    // The webhook and the reconcile sweep will try again; the guest should
    // still land on their order page rather than an error.
    console.error("[payu return] settle failed", e);
  }
  return NextResponse.redirect(`${origin}/o/${a.code}`, 303);
}
