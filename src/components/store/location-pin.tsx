"use client";

import { useState } from "react";

export type Pin = { lat: number; lng: number; accuracy: number } | null;

/**
 * Mount Abu addresses are landmarks, not street numbers, so a pin saves the
 * rider a phone call. Entirely optional, and we say plainly what it is for.
 */
export function LocationPin({ value, onChange }: { value: Pin; onChange: (p: Pin) => void }) {
  const [state, setState] = useState<"idle" | "asking" | "denied" | "unavailable">("idle");

  function ask() {
    if (!("geolocation" in navigator)) return setState("unavailable");
    setState("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) });
        setState("idle");
      },
      (err) => setState(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-hill/10 px-4 py-3 text-[15px]">
        <span className="flex-1">
          <b className="font-semibold">Location shared</b>
          <span className="block text-[13px] text-muted">Accurate to about {value.accuracy} m. Your rider will see this pin.</span>
        </span>
        <button type="button" onClick={() => onChange(null)} className="text-sm font-semibold text-muted underline-offset-2 hover:underline">
          Remove
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={ask}
        disabled={state === "asking"}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-line text-[15px] font-semibold disabled:opacity-60"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        {state === "asking" ? "Finding you…" : "Share my exact location"}
      </button>
      <p className="mt-1.5 text-[13px] text-muted">
        {state === "denied"
          ? "Your phone blocked location. No problem — the address above is enough, we'll call if we're lost."
          : state === "unavailable"
            ? "Couldn't get a location. The address above is enough."
            : "Optional. It only helps the rider find the gate."}
      </p>
    </div>
  );
}
