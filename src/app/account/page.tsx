import Link from "next/link";
import { Reorder } from "@/components/store/reorder";
import { SignInByPhone, SignOut } from "@/components/store/account-forms";
import { currentCustomer, pastOrders } from "@/lib/customers/session";
import { formatINR } from "@/lib/pricing";
import { StoreNav } from "@/components/store/store-nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "My account · Abu & Beyond" };

const STATUS: Record<string, string> = {
  paid: "Confirmed", accepted: "In the kitchen", preparing: "In the kitchen", ready: "Ready",
  out_for_delivery: "On the way", delivered: "Delivered", cancelled: "Cancelled", refunded: "Refunded",
};

export default async function AccountPage() {
  const me = await currentCustomer();
  const orders = me ? await pastOrders(me.id) : [];

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-paper pb-28">
      <header className="px-5 pt-5">
        <h1 className="font-display text-[34px] uppercase leading-none tracking-tight">My account</h1>
      </header>

      {!me ? (
        <div className="px-5">
          <p className="mt-4 text-[15px] text-muted">
            We don&apos;t ask you to make a password. Order once and this phone remembers you — or find your orders with the number you used.
          </p>
          <div className="mt-5 rounded-2xl bg-surface p-4">
            <SignInByPhone />
          </div>
          <Link href="/" className="mt-5 flex h-14 items-center justify-center rounded-2xl bg-clay text-base font-bold text-ink">
            See the menu
          </Link>
        </div>
      ) : (
        <>
          <section className="mx-5 mt-4 rounded-2xl bg-surface p-4">
            <p className="font-display text-[26px] uppercase leading-none">{me.name ?? "Guest"}</p>
            <p className="mt-1.5 text-[15px] text-muted">+91 {me.phone.replace(/^\+91/, "")}</p>
            <div className="mt-3 flex gap-5 text-sm">
              <span><b className="font-display text-[18px]">{me.orders}</b> order{me.orders === 1 ? "" : "s"}</span>
              <span><b className="font-display text-[18px]">{formatINR(me.spentPaise)}</b> with us</span>
            </div>
            <SignOut />
          </section>

          <section className="px-5">
            <h2 className="mb-2 mt-6 font-display text-[20px] uppercase tracking-wide">Order history</h2>
            {orders.length === 0 && <p className="rounded-2xl bg-surface p-5 text-center text-sm text-muted">No orders yet. The first one is on its way, we hope.</p>}
            <div className="flex flex-col gap-3">
              {orders.map((o) => (
                <article key={o.id} className="rounded-2xl bg-surface p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link href={`/o/${o.code}`} className="font-semibold underline-offset-2 hover:underline">#{o.number}</Link>
                    <span className="text-xs uppercase tracking-wide text-muted">{STATUS[o.status] ?? o.status.replace(/_/g, " ")}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {new Date(o.placedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                  </p>
                  <p className="mt-2 text-[15px]">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="font-bold">{formatINR(o.totalPaise)}</span>
                    <Reorder items={o.items} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
      <StoreNav active="account" />
    </div>
  );
}
