"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { claimKot } from "@/lib/orders/kot";

const KEY = "ab_kot_autoprint";

/** Prints one ticket in a hidden iframe, then cleans it up. */
export function printKot(orderId: string) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0";
  frame.src = `/kitchen/kot/${orderId}?auto=1`;
  // The ticket prints itself on load; give the dialog time to be dismissed or
  // the spooler time to take it before the frame goes away.
  frame.onload = () => setTimeout(() => frame.remove(), 60_000);
  document.body.appendChild(frame);
}

/**
 * Watches the orders on the pass and prints each new one once.
 *
 * Off by default, and remembered per device: a kitchen has one printer but
 * often several screens, and a toggle that defaulted to on would have every
 * tablet in the building firing at the same roll. Which device prints is a
 * decision for whoever is standing next to the printer.
 *
 * The guard against double printing is server-side (`claimKot`), not this
 * component's memory — a refresh, a second tab, or a tablet waking up must not
 * reprint a ticket that already came out.
 */
export function AutoPrint({ orderIds }: { orderIds: string[] }) {
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      setOn(localStorage.getItem(KEY) === "1");
    } catch {
      /* private window, or storage blocked: stay off */
    }
    setReady(true);
  }, []);

  const toggle = useCallback(() => {
    setOn((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(KEY, next ? "1" : "0");
      } catch {
        /* the toggle still works for this session */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!ready || !on) return;
    let cancelled = false;
    (async () => {
      for (const id of orderIds) {
        if (cancelled || seen.current.has(id)) continue;
        seen.current.add(id); // claim locally first, so a re-render can't double-fire
        try {
          const { mine } = await claimKot(id);
          if (mine && !cancelled) printKot(id);
        } catch {
          seen.current.delete(id); // a failed claim should be retried on the next tick
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderIds, on, ready]);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      title={on ? "This screen prints each new ticket" : "Tickets print only when you tap Print"}
      className={`h-9 flex-none rounded-full px-3 text-sm font-semibold ${on ? "bg-success text-reversed" : "bg-paper/15 text-reversed"}`}
    >
      {on ? "Auto-print on" : "Auto-print off"}
    </button>
  );
}

/** Print, or re-print, one ticket by hand. */
export function PrintButton({ orderId, printed }: { orderId: string; printed: boolean }) {
  return (
    <button
      type="button"
      onClick={() => printKot(orderId)}
      className="h-8 rounded-lg bg-paper/15 px-2.5 text-xs font-semibold"
    >
      {printed ? "Re-print KOT" : "Print KOT"}
    </button>
  );
}
