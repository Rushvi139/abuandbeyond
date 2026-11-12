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
export const SERVICE: { label: string; from: string; to: string }[] = [
  { label: "Day", from: "12:00", to: "15:00" },
  { label: "Evening", from: "19:00", to: "02:00" },
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

/** "19:00" → "7 PM", "19:30" → "7:30 PM" */
export function pretty(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour} ${suffix}` : `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** [{ label: "Day", when: "12 PM to 3 PM" }, …] — one line each on screen. */
export const serviceWindows = () =>
  SERVICE.map((w) => ({ label: w.label, when: `${pretty(w.from)} to ${pretty(w.to)}` }));

/** "Day 12 PM to 3 PM · Evening 7 PM to 2 AM", for prose and error messages. */
export const hoursLine = () => serviceWindows().map((w) => `${w.label} ${w.when}`).join(" · ");

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

/**
 * The moment the next regular shift starts, as a real Date. Used to end a
 * "kitchen forced open" by itself once the normal hours take over.
 */
export function nextOpening(now: Date = new Date()): Date {
  const t = kolkataMinutes(now);
  const starts = SERVICE.map((w) => mins(w.from)).sort((a, b) => a - b);
  const next = starts.find((s) => s > t) ?? starts[0] + DAY;
  const d = new Date(now.getTime() + (next - t) * 60_000);
  d.setSeconds(0, 0);
  return d;
}

/** How long before a slot we stop offering it — the kitchen needs the lead. */
export const SLOT_LEAD_MINUTES = 45;
/** Slot granularity. */
const SLOT_STEP = 30;

export type Slot = { value: string; label: string; day: "Today" | "Tomorrow" };

/**
 * The times a guest may actually choose: half-hour slots inside a service
 * window, far enough ahead that the kitchen can cook it, up to a day out.
 *
 * Built by walking forward in half hours and asking `serviceState` whether
 * each instant is inside a window — so the midnight wrap is handled by the
 * one piece of logic that already has tests, rather than by a second copy of
 * the same arithmetic.
 */
export function upcomingSlots(now: Date = new Date(), hoursAhead = 30): Slot[] {
  const first = new Date(now.getTime() + SLOT_LEAD_MINUTES * 60_000);
  // Round up to the next half hour.
  first.setSeconds(0, 0);
  const over = first.getMinutes() % SLOT_STEP;
  if (over) first.setMinutes(first.getMinutes() + (SLOT_STEP - over));

  const today = dayKey(now);
  const out: Slot[] = [];
  for (let i = 0; i <= (hoursAhead * 60) / SLOT_STEP; i++) {
    const t = new Date(first.getTime() + i * SLOT_STEP * 60_000);
    if (!serviceState(t).open) continue;
    out.push({
      value: t.toISOString(),
      label: clockLabel(t),
      day: dayKey(t) === today ? "Today" : "Tomorrow",
    });
  }
  return out;
}

/** Whether an instant is a slot we would have offered. Re-checked server-side. */
export function isBookableSlot(at: Date, now: Date = new Date()): boolean {
  if (Number.isNaN(at.getTime())) return false;
  if (at.getTime() < now.getTime() + (SLOT_LEAD_MINUTES - SLOT_STEP) * 60_000) return false;
  if (at.getTime() > now.getTime() + 36 * 60 * 60_000) return false;
  return serviceState(at).open;
}

/** "9:30 PM" in Kolkata. */
export function clockLabel(at: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true,
  }).format(at).toUpperCase().replace(/\s+/g, " ");
}

/** The Kolkata calendar day, for telling today from tomorrow. */
function dayKey(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(at);
}
