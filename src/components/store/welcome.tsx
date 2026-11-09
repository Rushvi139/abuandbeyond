"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CARD_MS, LeopardIntro, WALK_MS } from "./leopard-intro";

// Copy lives here so it can be tuned without touching the animation.
const COPY = {
  eyebrow: "A note from the kitchen",
  headline: ["For friends.", "For family.", "For you."],
  body: "We built Abu & Beyond with everything we have: our home, our taste buds, and a lot of late nights. Every dish is made with passion for the people we love. Tonight, that's you.",
  sign: "With love, from the hills of Abu.",
  cta: "Let's eat",
};

/**
 * Module-level, so it survives client-side navigation but not a reload. That is
 * exactly the rule we want: the entrance plays on a fresh arrival or a refresh,
 * and never again when someone taps back to the menu from Help or Account.
 */
let playedThisLoad = false;

export function Welcome() {
  const [phase, setPhase] = useState<"intro" | "card" | "leaving" | "hidden">(() => (playedThisLoad ? "hidden" : "intro"));
  const [reduced, setReduced] = useState(false);
  const [logoWidth, setLogoWidth] = useState(0);
  const logoRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (playedThisLoad) return;
    playedThisLoad = true;
    const r = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(r);
    const t = setTimeout(() => setPhase((p) => (p === "intro" ? "card" : p)), r ? 400 : CARD_MS);
    return () => clearTimeout(t);
  }, []);

  // the leopard is placed against the logo's own box, so all we need is its width
  const measure = useCallback(() => setLogoWidth(logoRef.current?.offsetWidth ?? 0), []);
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

      {/* the scene holds logo and leopard together and pulls in as the leopard arrives */}
      <div className={`absolute inset-0 flex items-center justify-center transition-transform duration-700 ease-out will-change-transform ${showCard ? "-translate-y-[20vh] md:-translate-y-[10vh]" : ""}`}>
        <div
          className="relative will-change-transform"
          style={{ animation: reduced ? undefined : `leo-scene-in ${WALK_MS + 400}ms cubic-bezier(0.22, 0.61, 0.36, 1) both` }}
        >
          <Image
            ref={logoRef}
            src="/brand/patch-primary.png"
            alt="Abu &amp; Beyond"
            width={300}
            height={214}
            priority
            onLoad={measure}
            className="block w-[min(300px,72vw)]"
          />
          <LeopardIntro logoWidth={logoWidth} reducedMotion={reduced} />
        </div>
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
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[12px] text-muted">
          <Link href="/contact" onClick={close} className="font-semibold text-ink underline-offset-2 hover:underline">Contact</Link>
          <span aria-hidden="true">·</span>
          <Link href="/terms" onClick={close} className="underline-offset-2 hover:underline">Terms</Link>
          <span aria-hidden="true">·</span>
          <Link href="/privacy" onClick={close} className="underline-offset-2 hover:underline">Privacy</Link>
          <span aria-hidden="true">·</span>
          <Link href="/refunds" onClick={close} className="underline-offset-2 hover:underline">Refunds</Link>
        </div>
      </div>
    </div>
  );
}
