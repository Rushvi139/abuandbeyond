"use client";

import { useEffect, useState } from "react";
import { hoursLine, serviceState } from "@/lib/hours";

/**
 * Open or shut, and the hours either way.
 *
 * Rendered on the client and re-checked every minute: the page is cached by
 * the browser, and a badge that said "Open" because it was rendered at 2:58pm
 * is worse than no badge at all.
 */
export function ServiceBadge({ compact }: { compact?: boolean }) {
  const [state, setState] = useState<ReturnType<typeof serviceState> | null>(null);

  useEffect(() => {
    const tick = () => setState(serviceState());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // Nothing until the client has checked, so the server never renders a
  // status that is already stale by the time anyone reads it.
  if (!state) return <span className="text-[11px] text-muted">{hoursLine()}</span>;

  return (
    <span className={`inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 ${compact ? "text-[11px]" : "text-[12px]"}`}>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
          state.open ? "bg-success/15 text-success" : "bg-ink/10 text-ink"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${state.open ? "bg-success" : "bg-muted"}`} aria-hidden="true" />
        {state.open ? "Open now" : "Closed"}
      </span>
      <span className="text-muted">
        {state.open ? `until ${state.closesAt} · ` : `opens ${state.opensAt} · `}
        {hoursLine()}
      </span>
    </span>
  );
}
