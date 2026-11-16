import Link from "next/link";
import { Pos } from "@/components/admin/pos";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMenu } from "@/lib/menu/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "New order — Abu & Beyond" };

/**
 * Take an order by hand, from the back office. Kitchen staff use the same
 * screen at /kitchen/new-order, since the back office is owner and manager only.
 */
export default async function PosPage() {
  await requireRole(["owner", "manager"], "/admin/pos");
  const [menu, fee] = await Promise.all([
    getMenu(),
    db()<{ value: number }[]>`select value from settings where key = 'delivery_fee_paise'`,
  ]);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[30px] uppercase leading-none">New order</h1>
          <p className="mt-1 text-sm text-muted">Phone, walk-in or WhatsApp orders. Same prices and KOT as the website.</p>
        </div>
        <Link href="/admin" className="h-10 rounded-xl border-[1.5px] border-ink px-3 text-sm font-semibold leading-10">← Today</Link>
      </div>
      <Pos menu={menu} deliveryFeePaise={Number(fee[0]?.value) || 0} />
    </div>
  );
}
