"use client";

import { useEffect, useState } from "react";
import { serviceState, serviceWindows } from "@/lib/hours";

/**
 * The hours, then whether we are open right now underneath them.
 *
 * The status is rendered on the client and re-checked every minute: the page
 * is cached by the browser, and a badge that said "Open now" because it was
 * rendered at 2:58pm is worse than no badge at all. The hours themselves are
 * fixed, so they render immediately and never flicker.
 */
export function ServiceBadge({ align = "right" }: { align?: "left" | "right" }) {
  const [state, setState] = useState<ReturnType<typeof serviceState> | null>(null);

  useEffect(() => {
    const tick = () => setState(serviceState());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const windows = serviceWindows();

  return (
    <div className={`flex flex-col gap-1 ${align === "right" ? "items-end text-right" : "items-start text-left"}`}>
      <dl className="text-[12px] leading-tight text-muted">
        {windows.map((w) => (
          <div key={w.label} className="flex gap-1.5 whitespace-nowrap">
            <dt className="font-semibold text-ink">{w.label}:</dt>
            <dd>{w.when}</dd>
          </div>
        ))}
      </dl>

      {state && (
        <span
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            state.open ? "bg-success/15 text-success" : "bg-ink/10 text-ink"
          }`}
        >
          <span className={`h-1.5 w-1.5 flex-none rounded-full ${state.open ? "bg-success" : "bg-muted"}`} aria-hidden="true" />
          {state.open ? `Open till ${state.closesAt}` : `Closed · opens ${state.opensAt}`}
        </span>
      )}
    </div>
  );
}
