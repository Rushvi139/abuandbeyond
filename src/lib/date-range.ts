/**
 * Date ranges for the back office, as plain YYYY-MM-DD strings in IST.
 *
 * Every list and report takes `?from=&to=` (inclusive) instead of a month,
 * with presets for the ranges people actually ask for. A bad or missing
 * value falls back to the preset, so a link can never break a page.
 */
export type Range = { from: string; to: string; preset: Preset | null };
export type Preset = "today" | "yesterday" | "week" | "month" | "last-month" | "30d";

export const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "30d", label: "Last 30 days" },
];

const isDate = (s?: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

export const istToday = (now = new Date()) => now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

export function presetRange(p: Preset, today = istToday()): { from: string; to: string } {
  switch (p) {
    case "today":
      return { from: today, to: today };
    case "yesterday":
      return { from: addDays(today, -1), to: addDays(today, -1) };
    case "week": {
      const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
      return { from: addDays(today, -dow), to: today };
    }
    case "month":
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case "last-month": {
      const firstThis = `${today.slice(0, 7)}-01`;
      const lastPrev = addDays(firstThis, -1);
      return { from: `${lastPrev.slice(0, 7)}-01`, to: lastPrev };
    }
    case "30d":
      return { from: addDays(today, -29), to: today };
  }
}

/** Reads `?range=` or `?from=&to=` from search params; `fallback` when neither is usable. */
export function readRange(sp: { range?: string; from?: string; to?: string }, fallback: Preset = "today", today = istToday()): Range {
  if (isDate(sp.from) || isDate(sp.to)) {
    let from = isDate(sp.from) ? sp.from! : sp.to!;
    let to = isDate(sp.to) ? sp.to! : sp.from!;
    if (from > to) [from, to] = [to, from];
    const match = PRESETS.find((p) => {
      const r = presetRange(p.key, today);
      return r.from === from && r.to === to;
    });
    return { from, to, preset: match?.key ?? null };
  }
  const preset = PRESETS.some((p) => p.key === sp.range) ? (sp.range as Preset) : fallback;
  return { ...presetRange(preset, today), preset };
}

export function rangeLabel(r: { from: string; to: string }) {
  const f = (s: string, withYear = false) =>
    new Date(`${s}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" });
  return r.from === r.to ? f(r.from, true) : `${f(r.from)} – ${f(r.to, true)}`;
}

export const nextDay = (d: string) => addDays(d, 1);
