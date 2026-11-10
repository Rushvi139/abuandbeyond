import Image from "next/image";
import Link from "next/link";
import { OrderCard } from "@/components/admin/order-card";
import { StaffLive } from "@/components/admin/live";
import { Batching } from "@/components/admin/batching";
import { AutoPrint } from "@/components/kitchen/auto-print";
import { requireRole } from "@/lib/auth";
import { getLiveOrders } from "@/lib/orders/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kitchen — Abu & Beyond" };

const STATIONS: Record<string, string> = { pizza_oven: "Pizza & Oven", wok_momos: "Wok & Momos", grill_rolls: "Grill & Rolls", fryer: "Fryer", cold_drinks: "Cold & Drinks" };

export default async function KitchenPage({ searchParams }: { searchParams: Promise<{ station?: string }> }) {
  const staff = await requireRole(["owner", "manager", "kitchen"], "/kitchen");
  const { station } = await searchParams;
  const all = await getLiveOrders(["paid", "accepted", "preparing", "ready"]);
  const filtered = station ? all.filter((o) => o.lines.some((l) => l.stationId === station)) : all;

  // A 10pm order must not sit on the pass at 7pm — somebody would cook it.
  // It joins the queue when there is just enough time to make it, and until
  // then waits in its own section with the time on it.
  const DUE_WITHIN_MS = 45 * 60_000;
  const dueNow = (o: { scheduledFor: string | null }) =>
    !o.scheduledFor || new Date(o.scheduledFor).getTime() - Date.now() <= DUE_WITHIN_MS;

  const orders = filtered.filter(dueNow);
  const later = filtered
    .filter((o) => !dueNow(o))
    .sort((a, b) => new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime());
  const fresh = all.filter((o) => o.status === "paid" && dueNow(o)).length;

  return (
    <div className="min-h-dvh bg-night p-4 text-reversed">
      <StaffLive newCount={fresh} chime />
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <Image src="/brand/patch-mono-white.png" alt="Abu & Beyond" width={66} height={47} />
        <h1 className="font-display text-[28px] uppercase">Kitchen</h1>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${fresh ? "bg-acid text-ink" : "bg-paper/15"}`}>{fresh} new</span>
        <AutoPrint orderIds={all.filter((o) => o.status === "paid" && dueNow(o)).map((o) => o.id)} />
        <nav className="ml-auto flex gap-1.5 overflow-x-auto">
          <Link href="/kitchen" className={`h-9 flex-none rounded-full px-3 text-sm leading-9 ${!station ? "bg-paper text-ink font-semibold" : "bg-paper/15"}`}>All</Link>
          {Object.entries(STATIONS).map(([id, name]) => (
            <Link key={id} href={`/kitchen?station=${id}`} className={`h-9 flex-none rounded-full px-3 text-sm leading-9 ${station === id ? "bg-paper text-ink font-semibold" : "bg-paper/15"}`}>{name}</Link>
          ))}
        </nav>
      </header>
      {/* Only what is due. Batching a scheduled order with the live queue
          tells the kitchen to cook the 9pm pizza now, which is the exact
          mistake holding it back was meant to prevent. */}
      <Batching orders={orders} />
      {orders.length === 0 ? (
        <p className="py-20 text-center font-display text-[28px] uppercase text-kraft">
          {later.length > 0 ? "Nothing to cook yet. Scheduled orders below." : "Nothing on the pass. Leopards sleep."}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {orders.map((o) => <OrderCard key={o.id} order={o} role={staff.role} dark />)}
        </div>
      )}

      {later.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 font-display text-[20px] uppercase text-hill">
            Scheduled · {later.length} coming later
          </h2>
          <p className="mb-3 text-sm text-kraft">
            Don&apos;t start these yet. Each one moves onto the pass, and prints, 45 minutes before its delivery time.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {later.map((o) => <OrderCard key={o.id} order={o} role={staff.role} dark />)}
          </div>
        </section>
      )}
    </div>
  );
}
