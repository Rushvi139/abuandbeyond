import { CheckoutScreen } from "@/components/store/checkout-screen";
import { payuConfigured } from "@/lib/payments/payu";
import { codAllowed } from "@/lib/orders/cod";
import { getUpiId, getKitchenOverride } from "@/lib/orders/override-actions";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { creditPartnerBySlug } from "@/lib/partners/queries";
import { SOURCE_COOKIE, isSlug } from "@/lib/partners/source";
import { getFreeDrink } from "@/lib/orders/free-drink";

export const metadata = { title: "Your order — Abu & Beyond" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ src?: string }> }) {
  const { src: fromUrl } = await searchParams;
  // The QR's ?src= rides in on the menu page; by checkout it is in the cookie.
  const fromCookie = (await cookies()).get(SOURCE_COOKIE)?.value;
  const src = isSlug(fromUrl) ? fromUrl : isSlug(fromCookie) ? fromCookie : undefined;
  let fee = 0;
  try {
    const [row] = await db()<{ value: number }[]>`select value from settings where key = 'delivery_fee_paise'`;
    fee = Number(row?.value) || 0;
  } catch {}
  const [upiId, kitchenOverride, freeDrink, partner] = await Promise.all([getUpiId(), getKitchenOverride(), getFreeDrink(), creditPartnerBySlug(src)]);
  return <CheckoutScreen deliveryFeePaise={fee} sourceRef={src} paymentsOn={payuConfigured()} codOn={await codAllowed()} upiId={upiId} kitchenOverride={kitchenOverride} freeDrink={freeDrink} onAccount={partner?.name ?? null} />;
}
