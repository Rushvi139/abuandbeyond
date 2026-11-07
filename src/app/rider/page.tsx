import Image from "next/image";
import { OrderCard } from "@/components/admin/order-card";
import { StaffLive } from "@/components/admin/live";
import { requireRole } from "@/lib/auth";
import { getLiveOrders } from "@/lib/orders/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Deliveries — Abu & Beyond" };

export default async function RiderPage() {
  const staff = await requireRole(["owner", "manager", "rider"], "/rider");
  const all = await getLiveOrders(["preparing", "ready", "out_for_delivery"]);
  const mine = staff.role === "rider" ? all.filter((o) => !o.rider || o.rider.id === staff.id) : all;
  const ready = mine.filter((o) => o.status === "ready" || o.status === "out_for_delivery");
  const soon = mine.filter((o) => o.status === "preparing");

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-paper p-4">
      <StaffLive newCount={ready.length} chime />
      <header className="mb-4 flex items-center gap-3">
        <Image src="/brand/patch-primary.png" alt="Abu & Beyond" width={66} height={45} />
        <h1 className="font-display text-[28px] uppercase">Deliveries</h1>
      </header>
      <div className="flex flex-col gap-3">
        {ready.map((o) => <OrderCard key={o.id} order={o} role={staff.role} compact />)}
        {ready.length === 0 && <p className="rounded-2xl bg-surface p-6 text-center text-muted">Nothing to pick up right now.</p>}
        {soon.length > 0 && (
          <>
            <h2 className="mt-2 font-display text-[18px] uppercase text-muted">Cooking now</h2>
            {soon.map((o) => (
              <div key={o.id} className="rounded-2xl bg-surface px-4 py-3 text-sm"><span className="font-display text-[20px]">#{o.number}</span> · {[o.propertyName, o.roomOrLandmark].filter(Boolean).join(", ") || o.stayType}</div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
