"use client";

import { useTransition } from "react";
import { setKitchenOverride } from "@/lib/orders/override-actions";

/** Switches itself off at the next regular shift (max 6 hours) — see override-actions. */
export function OverrideToggle({ on, serviceOpen, until = null }: { on: boolean; serviceOpen: boolean; until?: string | null }) {
  const [pending, startTransition] = useTransition();

  // Only show when kitchen is naturally closed, or when override is active
  if (serviceOpen && !on) return null;

  function toggle() {
    startTransition(async () => {
      await setKitchenOverride(!on);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold transition-colors disabled:opacity-50 ${
        on
          ? "bg-acid text-ink"
          : "bg-paper/15 text-reversed hover:bg-paper/25"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${on ? "bg-ink" : "bg-kraft"}`} />
      {on ? `Kitchen forced open${until ? ` · until ${until}` : ""} — tap to close` : "Kitchen closed — tap to open"}
    </button>
  );
}
