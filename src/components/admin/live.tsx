"use client";

import { useEffect, useRef } from "react";
import { useLiveRefresh } from "@/hooks/use-live";

/** Live refresh for staff screens; optional chime when the count of new (paid) orders rises. */
export function StaffLive({ newCount = 0, chime = false }: { newCount?: number; chime?: boolean }) {
  useLiveRefresh("/api/events/staff");
  const prev = useRef(newCount);
  useEffect(() => {
    if (chime && newCount > prev.current) {
      try {
        const ctx = new AudioContext();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "triangle";
        o.frequency.setValueAtTime(880, ctx.currentTime);
        o.frequency.setValueAtTime(1175, ctx.currentTime + 0.15);
        g.gain.setValueAtTime(0.25, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        o.connect(g).connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.6);
      } catch {}
    }
    prev.current = newCount;
  }, [newCount, chime]);
  return null;
}
