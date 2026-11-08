"use client";

import { useState, useTransition } from "react";
import { clearDemoOrders, createDemoOrder } from "@/lib/orders/demo";

/**
 * Walks a fake order through the real pipeline so the kitchen and rider screens
 * can be rehearsed without taking money. Demo orders never touch sales, stock
 * or the exports.
 */
export function DemoControls({ demoCount }: { demoCount: number }) {
  const [busy, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => start(() => void createDemoOrder())}
        className="h-10 rounded-xl border-[1.5px] border-dashed border-ink px-3 text-sm font-semibold disabled:opacity-50"
      >
        {busy ? "Adding…" : "+ Demo order"}
      </button>
      {demoCount > 0 &&
        (confirming ? (
          <span className="flex items-center gap-2 text-sm">
            <span className="text-muted">Delete {demoCount}?</span>
            <button type="button" disabled={busy} onClick={() => start(() => void clearDemoOrders().then(() => setConfirming(false)))} className="h-10 rounded-xl bg-error px-3 text-sm font-semibold text-reversed">
              Yes, clear
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="h-10 px-2 text-sm text-muted">Keep</button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="h-10 rounded-xl px-3 text-sm font-semibold text-muted">
            Clear {demoCount} demo{demoCount === 1 ? "" : "s"}
          </button>
        ))}
    </div>
  );
}
