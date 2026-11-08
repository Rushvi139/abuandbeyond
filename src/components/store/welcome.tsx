"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { LeopardIntro, SETTLED_MS } from "./leopard-intro";

// Copy lives here so it can be tuned without touching the animation.
const COPY = {
  eyebrow: "A note from the kitchen",
  headline: ["For friends.", "For family.", "For you."],
  body: "We built Abu & Beyond with everything we have: our home, our taste buds, and a lot of late nights. Every dish is made with passion for the people we love. Tonight, that's you.",
  sign: "With love, from the hills of Abu.",
  cta: "Let's eat",
};

/**
 * Entrance: the leopard walks in, climbs the logo patch and settles on it with its
 * legs hanging over the edge; then the welcome card slides up. Plays on every visit
 * (the owner wants returning guests to see it too) and is always skippable.
 */
export function Welcome() {
  const [phase, setPhase] = useState<"intro" | "card" | "leaving" | "hidden">("intro");
  const [reduced, setReduced] = useState(false);
  const [rects, setRects] = useState<{ logo: DOMRect; stage: DOMRect } | null>(null);
  const logoRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const r = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(r);
    const t = setTimeout(() => setPhase((p) => (p === "intro" ? "card" : p)), r ? 400 : SETTLED_MS);
    return () => clearTimeout(t);
  }, []);

  const measure = useCallback(() => {
    const logo = logoRef.current, stage = stageRef.current;
    if (!logo || !stage) return;
    setRects({ logo: logo.getBoundingClientRect(), stage: stage.getBoundingClientRect() });
  }, []);
  useLayoutEffect(() => {
    if (phase === "hidden") return;
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [phase, measure]);

  function close() {
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

      {/* stage: full screen; the logo sits a little below centre and the leopard lands on it */}
      <div ref={stageRef} className={`absolute inset-0 transition-transform duration-700 ease-out ${showCard ? "-translate-y-[22vh] md:-translate-y-[12vh]" : ""}`}>
        <Image
          ref={logoRef}
          src="/brand/patch-primary.png"
          alt="Abu &amp; Beyond"
          width={300}
          height={204}
          priority
          onLoad={measure}
          className="absolute left-1/2 top-[52%] w-[min(300px,72vw)] -translate-x-1/2"
        />
        <LeopardIntro logo={rects?.logo ?? null} stage={rects?.stage ?? null} reducedMotion={reduced} />
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
