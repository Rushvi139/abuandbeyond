"use client";

import { useEffect, useRef } from "react";
import { useLiveRefresh } from "@/hooks/use-live";

/**
 * Live refresh for staff screens; optional chime when the count of new (paid) orders rises.
 *
 * Browsers block AudioContext until a user gesture — so we create and
 * immediately suspend one on first interaction (the "unlock"), then resume it
 * when we actually want to play. This survives long kitchen shifts where nobody
 * touches the screen between orders.
 */
export function StaffLive({ newCount = 0, chime = false }: { newCount?: number; chime?: boolean }) {
  useLiveRefresh("/api/events/staff");
  const prev = useRef(newCount);
  const ctxRef = useRef<AudioContext | null>(null);

  // Unlock AudioContext on first user interaction so chimes work all shift
  useEffect(() => {
    if (!chime) return;
    function unlock() {
      if (ctxRef.current) return;
      try {
        const ctx = new AudioContext();
        ctxRef.current = ctx;
        // Immediately suspend — just creating it in a gesture handler is enough to unlock it
        ctx.suspend().catch(() => {});
      } catch {}
    }
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [chime]);

  useEffect(() => {
    if (!chime || newCount <= prev.current) {
      prev.current = newCount;
      return;
    }
    prev.current = newCount;

    async function ding() {
      try {
        // Reuse the unlocked context, or create a fresh one (works if the page was just loaded)
        const ctx = ctxRef.current ?? new AudioContext();
        ctxRef.current = ctx;
        if (ctx.state === "suspended") await ctx.resume();

        const now = ctx.currentTime;
        // Two-tone ding: high note then a lower fifth — sounds like a kitchen bell
        const freqs = [1318, 1047]; // E6 then C6
        freqs.forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "sine";
          o.frequency.value = freq;
          const start = now + i * 0.18;
          g.gain.setValueAtTime(0, start);
          g.gain.linearRampToValueAtTime(0.5, start + 0.01);
          g.gain.exponentialRampToValueAtTime(0.001, start + 0.9);
          o.connect(g).connect(ctx.destination);
          o.start(start);
          o.stop(start + 0.9);
        });
      } catch {}
    }

    void ding();
  }, [newCount, chime]);

  return null;
}
