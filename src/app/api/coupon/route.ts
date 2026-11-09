import { z } from "zod";
import { checkCoupon } from "@/lib/orders/coupons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  code: z.string().trim().max(40),
  subtotalPaise: z.number().int().min(0).max(100_000_000),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/).optional().or(z.literal("")),
});

/**
 * Previews what a code is worth, so the customer sees the discount before
 * paying. Nothing here is trusted later: the order is priced and the coupon
 * re-checked server-side when it is actually created.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, reason: "Enter a code." }, { status: 400 });
  const { code, subtotalPaise, phone } = parsed.data;

  const result = await checkCoupon(code, subtotalPaise, phone ? `+91${phone}` : null);
  return Response.json(
    result.ok
      ? { ok: true, code: result.coupon.code, discountPaise: result.discountPaise, description: result.coupon.description }
      : { ok: false, reason: result.reason },
  );
}
