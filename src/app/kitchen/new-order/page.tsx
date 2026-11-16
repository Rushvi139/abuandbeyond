import Link from "next/link";
import { Pos } from "@/components/admin/pos";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMenu } from "@/lib/menu/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "New order — Kitchen" };

/** The same billing screen as /admin/pos, for kitchen staff (who can't open the back office). */
export default async function KitchenNewOrder() {
  await requireRole(["owner", "manager", "kitchen"], "/kitchen/new-order");
  const [menu, fee] = await Promise.all([
    getMenu(),
    db()<{ value: number }[]>`select value from settings where key = 'delivery_fee_paise'`,
  ]);
  return (
    <div className="min-h-dvh bg-paper p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[30px] uppercase leading-none">New order</h1>
          <p className="mt-1 text-sm text-muted">Phone, walk-in or WhatsApp orders. Same prices and KOT as the website.</p>
        </div>
        <Link href="/kitchen" className="h-10 rounded-xl border-[1.5px] border-ink px-3 text-sm font-semibold leading-10">← Kitchen screen</Link>
      </div>
      <Pos menu={menu} deliveryFeePaise={Number(fee[0]?.value) || 0} />
    </div>
  );
}
