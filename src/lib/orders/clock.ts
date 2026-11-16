/**
 * The time figure shown on an order, which used to be "minutes since paid"
 * for every order forever — so a delivered order from last week read 3500m.
 *
 *  - live and due now: minutes waiting (amber at 10, red at 20)
 *  - scheduled for later: when it's due ("due 1:30 AM")
 *  - delivered: how long it took, paid to delivered ("took 38m")
 *  - anything else: nothing
 */
const LIVE = new Set(["paid", "accepted", "preparing", "ready", "out_for_delivery"]);

export type OrderClock = { text: string; tone: "ok" | "warn" | "late" | "muted"; minutes: number | null };

type Input = { status: string; paidAt: string | null; createdAt: string; deliveredAt: string | null; scheduledFor: string | null };

const mins = (from: string, to: number) => Math.max(0, Math.round((to - new Date(from).getTime()) / 60000));
const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).toUpperCase();

export function orderClock(o: Input, now = Date.now()): OrderClock {
  if (LIVE.has(o.status)) {
    if (o.scheduledFor && new Date(o.scheduledFor).getTime() - now > 45 * 60_000) {
      return { text: `due ${clock(o.scheduledFor)}`, tone: "muted", minutes: null };
    }
    // A scheduled order counts from when it became due-ish, not from when it was booked.
    const start = o.scheduledFor ? new Date(new Date(o.scheduledFor).getTime() - 45 * 60_000).toISOString() : (o.paidAt ?? o.createdAt);
    const m = mins(start, now);
    return { text: `${m}m`, tone: m >= 20 ? "late" : m >= 10 ? "warn" : "ok", minutes: m };
  }
  if (o.status === "delivered" && o.deliveredAt) {
    const m = Math.max(0, Math.round((new Date(o.deliveredAt).getTime() - new Date(o.paidAt ?? o.createdAt).getTime()) / 60000));
    return { text: `took ${m}m`, tone: "muted", minutes: m };
  }
  return { text: "—", tone: "muted", minutes: null };
}
