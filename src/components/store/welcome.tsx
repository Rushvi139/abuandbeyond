"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Leopard } from "./leopard";

const SEEN_KEY = "ab_welcomed_v3";

// Copy lives here so it can be tuned without touching the animation.
const COPY = {
  eyebrow: "A note from the kitchen",
  headline: ["For friends.", "For family.", "For you."],
  body: "We built Abu & Beyond with everything we have: our home, our taste buds, and a lot of late nights. Every dish is made with passion for the people we love. Tonight, that's you.",
  sign: "With love, from the hills of Abu.",
  cta: "Let's eat",
};

/**
 * First-visit entrance: a leopard walks in from the right along the top edge of the logo,
 * slows, and sits down on it; then the welcome card slides up. Shown once per device; skippable.
 */
export function Welcome() {
  const [phase, setPhase] = useState<"hidden" | "walk" | "card" | "leaving">("hidden");
  const [reduced, setReduced] = useState(false);
  const [geom, setGeom] = useState<{ x: number; groundY: number; scale: number; width: number } | null>(null);
  const logoRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {}
    if (seen) return;
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setPhase("walk");
  }, []);

  // measure where the logo sits so the leopard can walk on its top edge
  const measure = useCallback(() => {
    const logo = logoRef.current, stage = stageRef.current;
    if (!logo || !stage) return;
    const s = stage.getBoundingClientRect(), l = logo.getBoundingClientRect();
    const scale = Math.max(0.55, Math.min(1.1, l.width / 300));
    setGeom({ x: l.left - s.left + l.width * 0.56, groundY: l.top - s.top + 3, scale, width: s.width });
  }, []);
  useLayoutEffect(() => {
    if (phase === "hidden") return;
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [phase, measure]);

  const onSeated = useCallback(() => setTimeout(() => setPhase((p) => (p === "walk" ? "card" : p)), 500), []);

  function close() {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
    setPhase("leaving");
    setTimeout(() => setPhase("hidden"), 450);
  }

  if (phase === "hidden") return null;
  const showCard = phase === "card" || phase === "leaving";

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="welcome-title" className={`fixed inset-0 z-50 overflow-hidden bg-paper transition-opacity duration-400 ${phase === "leaving" ? "opacity-0" : "opacity-100"}`}>
      <button type="button" onClick={close} className="absolute right-4 top-4 z-20 h-11 rounded-full px-4 text-sm font-semibold text-muted">
        Skip
      </button>

      {/* stage: full screen; the logo sits a little below centre and the leopard walks on its top edge */}
      <div ref={stageRef} className={`absolute inset-0 transition-transform duration-700 ease-out ${showCard ? "-translate-y-[22vh] md:-translate-y-[12vh]" : ""}`}>
        <Image
          ref={logoRef}
          src="/brand/patch-primary.png"
          alt="Abu & Beyond"
          width={300}
          height={204}
          priority
          onLoad={measure}
          className="absolute left-1/2 top-[52%] w-[min(300px,72vw)] -translate-x-1/2"
        />
        {geom && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
            <Leopard target={geom} width={geom.width} onSeated={onSeated} reducedMotion={reduced} />
          </svg>
        )}
      </div>

      <div className={`absolute inset-x-4 bottom-6 z-10 mx-auto max-w-md rounded-3xl bg-surface p-6 shadow-[0_-8px_40px_rgba(20,20,20,0.12)] transition-all duration-500 ${showCard ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-12 opacity-0"}`}>
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-hill">{COPY.eyebrow}</p>
        <h2 id="welcome-title" className="mt-2 font-display text-[38px] uppercase leading-[0.95] tracking-tight">
          {COPY.headline[0]}
          <br />
          {COPY.headline[1]}
          <br />
          <span className="text-clay">{COPY.headline[2]}</span>
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed">{COPY.body}</p>
        <p className="mt-2 text-sm text-muted">{COPY.sign}</p>
        <button type="button" onClick={close} className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl bg-clay text-base font-bold text-ink">
          {COPY.cta}
        </button>
      </div>
    </div>
  );
}
