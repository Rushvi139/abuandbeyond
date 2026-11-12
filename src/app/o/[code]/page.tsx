import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HappyBear } from "@/components/store/happy-bear";
import { LiveStatus } from "@/components/store/live-status";
import { RidgeRun } from "@/components/store/ridge-run";
import { formatINR } from "@/lib/pricing";
import { getOrderByCode } from "@/lib/orders/queries";
import { CUSTOMER_STEPS, STATUS_LABEL, stepIndex } from "@/lib/orders/status";
import { ResumePayment } from "@/components/store/resume-payment";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const order = await getOrderByCode(code);
  if (!order) notFound();
  const [social] = await db()<{ value: { whatsapp?: string | null } }[]>`select value from settings where key = 'social_links'`;
  const wa = social?.value?.whatsapp ? `https://wa.me/${social.value.whatsapp.replace(/\D/g, "")}` : null;

  const waOn = Boolean(process.env.WHATSAPP_ACCESS_TOKEN);
  const idx = stepIndex(order.status);
  const done = order.status === "delivered";
  const dead = order.status === "cancelled" || order.status === "payment_failed" || order.status === "pending_payment";
  // An online order whose payment didn't finish (or failed) can be paid
  // again: each try is a new PayU attempt on the same order, so the guest
  // never has to build the basket again.
  const resumable =
    (order.status === "pending_payment" || order.status === "payment_failed") &&
    order.paymentMode === "online" &&
    Boolean(order.gatewayOrderId);
  const eta = order.prepMinutes ? order.prepMinutes + 15 : null;
  const t = (s: string) => new Date(s).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-paper pb-28">
      <LiveStatus code={code} />
      <div className={`rounded-b-[28px] px-5 pb-7 pt-6 ${dead ? "bg-ink text-reversed" : "bg-clay"}`}>
        <div className="flex items-center justify-between">
          {/* "Paid" on a pay-on-delivery order is a lie the guest will notice
              at the door, so say what they actually owe until they have
              handed it over. */}
          <span className="text-[11px] font-bold uppercase tracking-[0.15em]">
            {dead
              ? STATUS_LABEL[order.status]
              : order.paymentMode === "on_delivery" && !order.collectedAt
                ? `Pay ${formatINR(order.totalPaise, { decimals: true })} at the door`
                : `Paid · ${formatINR(order.totalPaise, { decimals: true })}`}
          </span>
          <Image src="/brand/ampersand-seal-acid.png" alt="" width={44} height={44} />
        </div>
        <h1 className="mt-2 font-display text-[46px] uppercase leading-[0.98]">
          Order #{order.number}
          <br />
          <span className={dead ? "text-acid" : "text-paper"}>{done ? "delivered." : dead ? "on hold." : "is in."}</span>
        </h1>
        <p className="mt-2 text-[15px] font-medium">
          {done
            ? "Hope it hit the spot. See you up here again."
            : resumable
              ? "Your food isn't ordered yet — the payment wasn't finished. Everything is still here, so you can pick up where you left off."
              : dead
                ? "Payment didn't complete. Order again from the menu, or message us."
                : waOn
                  ? "Confirmation sent to your WhatsApp. Updates land there too."
                  : "Keep this page open; it updates live as your food moves."}
        </p>
      </div>

      {resumable && <ResumePayment code={order.code} amountPaise={order.totalPaise} />}

      {!dead && (
        <section className="mx-5 mt-5 rounded-[18px] bg-surface p-4">
          <div className="flex items-center gap-3">
            <HappyBear size={120} className="-my-2 -ml-1 flex-none" />
            <div className="flex flex-col">
              <span className="text-base font-bold">{done ? "Enjoy!" : "Arriving in about"}</span>
              <span className="font-display text-[26px]">{done ? "" : eta ? `${eta} MIN` : "30–40 MIN"}</span>
              <span className="text-xs text-muted">{done ? (waOn ? "Rate us from the WhatsApp link" : "Thanks for ordering") : "Kitchen confirms the time once it accepts"}</span>
            </div>
          </div>
          <ol className="mt-4 flex flex-col">
            {CUSTOMER_STEPS.map((s, i) => {
              const sIdx = stepIndex(s.status);
              const state = idx > sIdx || done ? "done" : idx === sIdx || (s.status === "preparing" && order.status === "ready") ? "now" : "next";
              const ev = order.events.find((e) => e.to === s.status);
              const last = i === CUSTOMER_STEPS.length - 1;
              return (
                <li key={s.status} className="flex min-h-[46px] gap-3">
                  <div className="flex w-[22px] flex-none flex-col items-center self-stretch">
                    <span className={`flex h-[22px] w-[22px] items-center justify-center rounded-full text-xs font-bold text-reversed ${state === "done" ? "bg-success" : state === "now" ? "bg-clay ring-[5px] ring-acid" : "border-2 border-line bg-surface"}`}>{state === "done" ? "✓" : ""}</span>
                    {!last && <span className={`my-0.5 w-0.5 flex-1 ${state === "done" ? "bg-success" : "bg-line"}`} />}
                  </div>
                  <div className="flex flex-col gap-0.5 pt-0.5">
                    <span className={`text-[15px] ${state === "next" ? "font-medium text-muted" : state === "now" ? "font-bold" : "font-semibold"}`}>
                      {s.status === "paid" && order.paymentMode === "on_delivery" ? "Order placed" : s.label}
                    </span>
                    <span className="text-xs text-muted">{ev ? t(ev.at) : s.sub}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className="mx-5 mt-4 rounded-[18px] bg-surface p-4 text-sm">
        {order.lines.map((l) => (
          <div key={l.id} className="flex justify-between py-1">
            <span>{l.qty} × {l.name}{l.options.length ? ` (${l.options.join(", ")})` : ""}</span>
            <span>{formatINR(l.linePaise)}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-line pt-2 font-bold"><span>{order.paymentMode === "on_delivery" ? (order.collectedAt ? "Paid on delivery" : "Pay on delivery") : order.gstPaise > 0 ? "Paid incl. GST" : "Paid"}</span><span>{formatINR(order.totalPaise, { decimals: true })}</span></div>
        {order.paymentMode === "on_delivery" && !order.collectedAt && (
          <p className="mt-2 rounded-xl bg-acid/40 px-3 py-2 text-[13px] font-semibold">
            Please keep {formatINR(order.totalPaise, { decimals: true })} ready — cash or UPI to the rider.
          </p>
        )}
        {order.scheduledFor && (
          <p className="mt-2 rounded-xl bg-hill/15 px-3 py-2 text-[13px] font-semibold">
            Scheduled for {new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(order.scheduledFor))}
          </p>
        )}
        <p className="mt-2 text-xs text-muted">Delivering to {[order.propertyName, order.roomOrLandmark].filter(Boolean).join(", ") || order.stayType}</p>
      </section>

      {/* Only while they are actually waiting. Once it is delivered or dead,
          the page should be about the order, not a game. */}
      {!done && !dead && (
        <div className="mx-5">
          <RidgeRun />
        </div>
      )}

      <div className="mx-5 mt-4 grid grid-cols-2 gap-2.5">
        {wa ? (
          <a href={wa} className="flex h-[52px] items-center justify-center gap-2 rounded-[14px] bg-ink text-sm font-semibold text-reversed">Chat with us</a>
        ) : (
          <Link href="/" className="flex h-[52px] items-center justify-center rounded-[14px] bg-ink text-sm font-semibold text-reversed">Back to menu</Link>
        )}
        <Link href="/wall" className="flex h-[52px] items-center justify-center rounded-[14px] border-[1.5px] border-ink text-sm font-semibold">The wall</Link>
      </div>
    </div>
  );
}
