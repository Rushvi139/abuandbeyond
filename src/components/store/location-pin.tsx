"use client";

import { useRef, useState } from "react";

export type Pin = { lat: number; lng: number; accuracy: number } | null;

/** Good enough to ride straight to. Matches PRECISE_M in lib/orders/nav.ts. */
const PRECISE_M = 150;
/** Stop listening once the phone is this sure. */
const GREAT_M = 30;
/** Give the GPS this long to settle; the first fix indoors is often a guess. */
const LISTEN_MS = 8000;

/**
 * Mount Abu addresses are landmarks, not street numbers, so a pin saves the
 * rider a phone call — but only a precise one. A phone's first answer indoors
 * is often from the mobile tower, a kilometre or more off, so this listens
 * for a few seconds, keeps the best fix, and says plainly when it is rough.
 * A rough pin is still sent; the rider's Navigate prefers the hotel picked
 * above in that case (see lib/orders/nav.ts).
 */
export function LocationPin({ value, onChange }: { value: Pin; onChange: (p: Pin) => void }) {
  const [state, setState] = useState<"idle" | "asking" | "denied" | "unavailable">("idle");
  const watch = useRef<number | null>(null);

  function stop() {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
  }

  function ask() {
    if (!("geolocation" in navigator)) return setState("unavailable");
    setState("asking");
    let best: Pin = null;
    const finish = () => {
      stop();
      if (best) {
        onChange(best);
        setState("idle");
      } else setState("unavailable");
    };
    const timer = setTimeout(finish, LISTEN_MS);
    watch.current = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) };
        if (!best || p.accuracy < best.accuracy) best = p;
        if (p.accuracy <= GREAT_M) {
          clearTimeout(timer);
          finish();
        }
      },
      (err) => {
        clearTimeout(timer);
        stop();
        if (best) {
          onChange(best);
          setState("idle");
        } else setState(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: true, timeout: LISTEN_MS, maximumAge: 0 },
    );
  }

  if (value) {
    const rough = value.accuracy > PRECISE_M;
    return (
      <div className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-[15px] ${rough ? "bg-acid/25" : "bg-hill/10"}`}>
        <span className="flex-1">
          <b className="font-semibold">{rough ? "Rough location only" : "Location shared"}</b>
          <span className="block text-[13px] text-muted">
            {rough
              ? `Your phone could only place you within about ${value.accuracy.toLocaleString("en-IN")} m. Pick your hotel from the list above, or try again near a window.`
              : `Accurate to about ${value.accuracy} m. Your rider will navigate to this pin.`}
          </span>
        </span>
        <span className="flex flex-col items-end gap-1">
          {rough && (
            <button type="button" onClick={() => { onChange(null); setTimeout(ask, 0); }} className="text-sm font-semibold underline-offset-2 hover:underline">
              Try again
            </button>
          )}
          <button type="button" onClick={() => onChange(null)} className="text-sm font-semibold text-muted underline-offset-2 hover:underline">
            Remove
          </button>
        </span>
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
        {state === "asking" ? "Finding you… hold still a few seconds" : "Share my exact location"}
      </button>
      <p className="mt-1.5 text-[13px] text-muted">
        {state === "denied"
          ? "Your phone blocked location. No problem — pick your hotel above, we'll call if we're lost."
          : state === "unavailable"
            ? "Couldn't get a location. Picking your hotel above is enough."
            : "Optional. Only share it if you're at the place we're delivering to."}
      </p>
    </div>
  );
}
