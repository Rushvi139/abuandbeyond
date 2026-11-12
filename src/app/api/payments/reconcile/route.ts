import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payuConfigured } from "@/lib/payments/payu";
import { settleOrder } from "@/lib/payments/payu-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Catches payments nobody told us about.
 *
 * Two things normally mark an order paid: the webhook, and the check we run
 * when the guest lands back on the site. Both can miss. The webhook can fail
 * to arrive — wrong URL, our container restarting, PayU retrying into a
 * 500 — and the return check never runs at all if the guest pays and closes
 * the tab, or loses signal coming back up the hill. Mount Abu makes that
 * last one ordinary rather than rare.
 *
 * When both miss, PayU has the money and the kitchen never sees the
 * order. This asks PayU about every order still sitting unpaid and
 * settles it either way.
 *
 * Called every couple of minutes by the `reconcile` service in
 * docker-compose. Safe to call by hand, and safe to call twice: markPaid is
 * idempotent on the gateway payment id.
 */
const MIN_AGE_MINUTES = 3; // let the normal paths have their turn first
const MAX_AGE_HOURS = 24; // older than this, a card payment can't still land
const BATCH = 25; // PayU is rate limited; a backlog drains over a few runs

function authorised(req: Request): boolean {
  const expected = process.env.INTERNAL_SECRET || process.env.SESSION_SECRET || "";
  if (!expected) return false;
  const given = req.headers.get("x-internal-secret") ?? "";
  // Length-safe compare; these are short strings and both sides are ours.
  return given.length === expected.length && given === expected;
}

export async function POST(req: Request) {
  if (!authorised(req)) return NextResponse.json({ ok: false }, { status: 403 });
  if (!payuConfigured()) return NextResponse.json({ ok: true, skipped: "payments not configured" });

  const sql = db();
  const stuck = await sql<{ id: string; code: string; totalPaise: number }[]>`
    select id, order_code as code, total_paise as "totalPaise"
    from orders
    where status = 'pending_payment'
      and not is_demo
      and exists (select 1 from payment_attempts a where a.order_id = orders.id)
      and created_at < now() - ${`${MIN_AGE_MINUTES} minutes`}::interval
      and created_at > now() - ${`${MAX_AGE_HOURS} hours`}::interval
    order by created_at
    limit ${BATCH}`;

  let paid = 0;
  let failed = 0;
  let stillPending = 0;
  const problems: string[] = [];

  for (const o of stuck) {
    try {
      // Every attempt on the order is checked in one call; only a final
      // answer on all of them closes it as failed.
      const r = await settleOrder(o.id, "reconcile");
      if (r === "paid") paid += 1;
      else if (r === "failed") failed += 1;
      else stillPending += 1;
    } catch (e) {
      // One bad order must not stop the sweep: the next one might be a
      // payment sitting unclaimed.
      problems.push(`${o.code}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  if (paid > 0 || problems.length > 0) {
    console.log(`[reconcile] checked ${stuck.length}, recovered ${paid}, closed ${failed}`, problems);
  }
  return NextResponse.json({ ok: true, checked: stuck.length, paid, failed, stillPending, problems });
}
