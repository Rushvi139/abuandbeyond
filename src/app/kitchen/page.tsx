import Image from "next/image";
import { OrderCard } from "@/components/admin/order-card";
import { StaffLive } from "@/components/admin/live";
import { requireRole } from "@/lib/auth";
import { getLiveOrders } from "@/lib/orders/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kitchen — Abu & Beyond" };

const STATIONS: Record<string, string> = { pizza_oven: "Pizza & Oven", wok_momos: "Wok & Momos", grill_rolls: "Grill & Rolls", fryer: "Fryer", cold_drinks: "Cold & Drinks" };

export default async function KitchenPage({ searchParams }: { searchParams: Promise<{ station?: string }> }) {
  const staff = await requireRole(["owner", "manager", "kitchen"], "/kitchen");
  const { station } = await searchParams;
  const all = await getLiveOrders(["paid", "accepted", "preparing", "ready"]);
  const orders = station ? all.filter((o) => o.lines.some((l) => l.stationId === station)) : all;
  const fresh = all.filter((o) => o.status === "paid").length;

  return (
    <div className="min-h-dvh bg-night p-4 text-reversed">
      <StaffLive newCount={fresh} chime />
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <Image src="/brand/patch-mono-white.png" alt="Abu & Beyond" width={66} height={45} />
        <h1 className="font-display text-[28px] uppercase">Kitchen</h1>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${fresh ? "bg-acid text-ink" : "bg-paper/15"}`}>{fresh} new</span>
        <nav className="ml-auto flex gap-1.5 overflow-x-auto">
          <a href="/kitchen" className={`h-9 flex-none rounded-full px-3 text-sm leading-9 ${!station ? "bg-paper text-ink font-semibold" : "bg-paper/15"}`}>All</a>
          {Object.entries(STATIONS).map(([id, name]) => (
            <a key={id} href={`/kitchen?station=${id}`} className={`h-9 flex-none rounded-full px-3 text-sm leading-9 ${station === id ? "bg-paper text-ink font-semibold" : "bg-paper/15"}`}>{name}</a>
          ))}
        </nav>
      </header>
      {orders.length === 0 ? (
        <p className="py-20 text-center font-display text-[28px] uppercase text-kraft">Nothing on the pass. Leopards sleep.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {orders.map((o) => <OrderCard key={o.id} order={o} role={staff.role} dark />)}
        </div>
      )}
    </div>
  );
}
