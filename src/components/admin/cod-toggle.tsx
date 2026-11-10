"use client";

import { useTransition } from "react";
import { setCodEnabled } from "@/lib/orders/cod-actions";

/**
 * Cash at the door, on or off.
 *
 * Shown only when the gateway is working — before that it is cash or nothing,
 * so a switch that cannot be switched would only confuse.
 */
export function CodToggle({ on, locked }: { on: boolean; locked: boolean }) {
  const [pending, start] = useTransition();

  if (locked) {
    return (
      <span className="text-xs font-semibold text-muted" title="Online payment isn't live, so cash at the door is the only way to order.">
        Cash at door · on
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => { await setCodEnabled(!on); })}
      className={`h-9 rounded-xl px-3 text-xs font-bold uppercase disabled:opacity-50 ${on ? "bg-success text-reversed" : "border-[1.5px] border-line text-muted"}`}
    >
      Cash at door · {on ? "on" : "off"}
    </button>
  );
}
