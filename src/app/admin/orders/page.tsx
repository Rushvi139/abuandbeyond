import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLiveOrders, getRecentOrders } from "@/lib/orders/queries";
import { LIVE } from "@/lib/orders/status";
import { OrdersTable } from "@/components/admin/orders-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "All orders — Abu & Beyond" };

export default async function OrdersPage() {
  const staff = await requireRole(["owner", "manager"], "/admin");
  const [live, recent, riders] = await Promise.all([
    getLiveOrders(LIVE),
    getRecentOrders(300),
    db()<{ id: string; name: string }[]>`select id, full_name as name from staff_users where role = 'rider' and active order by full_name`,
  ]);

  // Merge: live first (deduped), then recent that aren't already live
  const liveIds = new Set(live.map((o) => o.id));
  const all = [...live, ...recent.filter((o) => !liveIds.has(o.id))];

  return <OrdersTable orders={all} riders={riders} role={staff.role} />;
}
