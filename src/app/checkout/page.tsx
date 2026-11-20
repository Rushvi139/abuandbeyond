import { CheckoutScreen } from "@/components/store/checkout-screen";
import { payuConfigured } from "@/lib/payments/payu";
import { codAllowed } from "@/lib/orders/cod";
import { getUpiId, getKitchenOverride } from "@/lib/orders/override-actions";
import { db } from "@/lib/db";
import { getFreeDrink } from "@/lib/orders/free-drink";

export const metadata = { title: "Your order — Abu & Beyond" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ src?: string }> }) {
  const { src } = await searchParams;
  let fee = 0;
  try {
    const [row] = await db()<{ value: number }[]>`select value from settings where key = 'delivery_fee_paise'`;
    fee = Number(row?.value) || 0;
  } catch {}
  const [upiId, kitchenOverride, freeDrink] = await Promise.all([getUpiId(), getKitchenOverride(), getFreeDrink()]);
  return <CheckoutScreen deliveryFeePaise={fee} sourceRef={src} paymentsOn={payuConfigured()} codOn={await codAllowed()} upiId={upiId} kitchenOverride={kitchenOverride} freeDrink={freeDrink} />;
}
