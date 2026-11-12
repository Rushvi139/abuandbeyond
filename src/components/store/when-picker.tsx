"use client";

import { useEffect, useMemo, useState } from "react";
import { serviceState, upcomingSlots, type Slot } from "@/lib/hours";

/**
 * Now, or a slot.
 *
 * Slots are generated on the client so they are relative to the guest's own
 * clock rather than a cached render — but the server checks the chosen time
 * again before taking any money, because a slot offered ten minutes ago may
 * no longer have the lead time the kitchen needs.
 *
 * When the kitchen is shut this is the only way to order, so it opens on the
 * slot list rather than on "as soon as possible".
 */
export function WhenPicker({ value, onChange, forcedOpen = false }: { value: string; onChange: (iso: string) => void; forcedOpen?: boolean }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    // Re-generate every minute so a slot can't go stale while someone types
    // their address.
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const open = forcedOpen || (now ? serviceState(now).open : true);
  const slots = useMemo(() => (now ? upcomingSlots(now) : []), [now]);

  // Once the kitchen shuts, "as soon as possible" is not on offer, so move
  // any such choice onto the first real slot rather than leaving a dead one.
  useEffect(() => {
    if (!now || open || value || slots.length === 0) return;
    onChange(slots[0].value);
  }, [now, open, value, slots, onChange]);

  if (!now) return null;

  const grouped = slots.reduce<Record<string, Slot[]>>((acc, s) => {
    (acc[s.day] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-semibold uppercase tracking-wide text-muted">When should it arrive?</span>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange("")}
          disabled={!open}
          aria-pressed={value === "" && open}
          className={`h-11 flex-1 rounded-xl text-[14px] font-semibold disabled:opacity-40 ${
            value === "" && open ? "border-2 border-ink bg-ink text-reversed" : "border-[1.5px] border-line bg-surface"
          }`}
        >
          {open ? "As soon as possible" : "Closed right now"}
        </button>
      </div>

      {slots.length === 0 ? (
        <p className="text-[13px] text-muted">No delivery slots left today. Please try again tomorrow.</p>
      ) : (
        Object.entries(grouped).map(([day, list]) => (
          <div key={day}>
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">{day}</span>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {list.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => onChange(s.value)}
                  aria-pressed={value === s.value}
                  className={`h-11 flex-none whitespace-nowrap rounded-xl px-4 text-[14px] font-semibold ${
                    value === s.value ? "border-2 border-ink bg-ink text-reversed" : "border-[1.5px] border-line bg-surface"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ))
      )}

      {value && (
        <p className="text-[13px] text-hill">
          We&apos;ll have it there around <b>{slots.find((s) => s.value === value)?.label ?? "the time you picked"}</b>. The
          kitchen starts cooking closer to then, so it arrives hot.
        </p>
      )}
    </div>
  );
}
