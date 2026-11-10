/**
 * When the kitchen is actually cooking.
 *
 * The evening shift runs past midnight, which is the part that goes wrong:
 * 01:30 is inside "19:00–02:00" even though 1 is less than 19. Everything here
 * works in minutes from midnight and treats a window whose end is before its
 * start as crossing into the next day.
 *
 * Times are Asia/Kolkata whatever the server's own clock is set to.
 */
export const SERVICE: { from: string; to: string }[] = [
  { from: "12:00", to: "15:00" },
  { from: "19:00", to: "02:00" },
];

/** Set false to keep taking orders while the kitchen is shut (pre-orders). */
export const REFUSE_ORDERS_WHEN_CLOSED = true;

const DAY = 24 * 60;
const mins = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Minutes past midnight, in Kolkata, for any Date. */
export function kolkataMinutes(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return (h % 24) * 60 + m;
}

/** "19:00" → "7:00 pm" */
export function pretty(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour} ${suffix}` : `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** "12 pm – 3 pm · 7 pm – 2 am" */
export const hoursLine = () => SERVICE.map((w) => `${pretty(w.from)} – ${pretty(w.to)}`).join(" · ");

export type ServiceState = {
  open: boolean;
  /** When we next open, as "7 pm". Null while open. */
  opensAt: string | null;
  /** When the current window ends, as "2 am". Null while closed. */
  closesAt: string | null;
};

export function serviceState(now: Date = new Date()): ServiceState {
  const t = kolkataMinutes(now);

  for (const w of SERVICE) {
    const from = mins(w.from);
    const to = mins(w.to);
    const inside = to > from ? t >= from && t < to : t >= from || t < to;
    if (inside) return { open: true, opensAt: null, closesAt: pretty(w.to) };
  }

  // Closed: find the next opening, wrapping to tomorrow if they are all behind us.
  const starts = SERVICE.map((w) => mins(w.from)).sort((a, b) => a - b);
  const next = starts.find((s) => s > t) ?? starts[0] + DAY;
  const at = SERVICE.find((w) => mins(w.from) === next % DAY)!;
  return { open: false, opensAt: pretty(at.from), closesAt: null };
}
