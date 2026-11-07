import { CheckoutScreen } from "@/components/store/checkout-screen";
import { db } from "@/lib/db";

export const metadata = { title: "Your order — Abu & Beyond" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ src?: string }> }) {
  const { src } = await searchParams;
  let fee = 0;
  try {
    const [row] = await db()<{ value: number }[]>`select value from settings where key = 'delivery_fee_paise'`;
    fee = Number(row?.value) || 0;
  } catch {}
  return <CheckoutScreen deliveryFeePaise={fee} sourceRef={src} />;
}
