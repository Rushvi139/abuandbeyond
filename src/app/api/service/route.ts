import { NextResponse } from "next/server";
import { getKitchenOverrideUntil } from "@/lib/orders/override-actions";

export const dynamic = "force-dynamic";

/**
 * Whether the kitchen has been forced open, for guest screens that are
 * cached. Regular hours are worked out on the guest's own device; this only
 * adds the one thing it can't know.
 */
export async function GET() {
  const until = await getKitchenOverrideUntil();
  return NextResponse.json({ forcedOpen: until !== null, until: until?.toISOString() ?? null }, { headers: { "Cache-Control": "no-store" } });
}
