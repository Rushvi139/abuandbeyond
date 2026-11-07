"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const SEEN_KEY = "ab_welcomed_v2";

// Copy lives here so it can be tuned without touching the animation.
const COPY = {
  eyebrow: "A note from the kitchen",
  headline: ["For friends.", "For family.", "For you."],
  body: "We built Abu & Beyond with everything we have: our home, our taste buds, and a lot of late nights. Every dish is made with passion for the people we love. Tonight, that's you.",
  sign: "With love, from the hills of Abu.",
  cta: "Let's eat",
};

/**
 * First-visit entrance, after the reference reel: the leopard character walks down from the top
 * of the screen, pounces onto the logo, prowls across it, and sits on top. Then the welcome card
 * slides up. Shown once per device; skippable; the leopard is simply seated when the visitor
 * prefers reduced motion.
 *
 * Timeline (ms): walk 0–1500 · pounce 1500–2100 · prowl 2100–3300 · sit 3300 · card 3900
 */
type Phase = "hidden" | "walk" | "pounce" | "prowl" | "sit" | "card" | "leaving";

export function Welcome() {
  const [phase, setPhase] = useState<Phase>("hidden");

  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {}
    if (seen) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setPhase("sit");
      const t = setTimeout(() => setPhase("card"), 300);
      return () => clearTimeout(t);
    }
    setPhase("walk");
    const ts = [
      setTimeout(() => setPhase("pounce"), 1500),
      setTimeout(() => setPhase("prowl"), 2100),
      setTimeout(() => setPhase("sit"), 3300),
      setTimeout(() => setPhase("card"), 3900),
    ];
    return () => ts.forEach(clearTimeout);
  }, []);

  function close() {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
    setPhase("leaving");
    setTimeout(() => setPhase("hidden"), 450);
  }

  if (phase === "hidden") return null;
  const showCard = phase === "card";
  const seated = phase === "sit" || phase === "card" || phase === "leaving";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-paper px-5 transition-opacity duration-400 ${phase === "leaving" ? "opacity-0" : "opacity-100"}`}
    >
      <button type="button" onClick={close} className="absolute right-4 top-4 z-20 h-11 rounded-full px-4 text-sm font-semibold text-muted">
        Skip
      </button>

      {/* stage: 280 wide; the logo sits at the bottom, the leopard moves above it */}
      <div className={`relative h-[420px] w-[300px] transition-transform duration-500 ${showCard ? "-translate-y-20 scale-[0.88]" : ""}`} data-phase={phase}>
        <Image src="/brand/patch-primary.png" alt="Abu & Beyond" width={260} height={177} priority className="absolute bottom-0 left-5" />

        {/* one <img> per pose; CSS on [data-phase] shows and places the right one */}
        <Image src="/brand/stickers/leo-walk.png" alt="" width={108} height={174} priority className="ab-leo ab-leo-walk absolute" />
        <Image src="/brand/stickers/leo-pounce.png" alt="" width={150} height={166} priority className="ab-leo ab-leo-pounce absolute" />
        <Image src="/brand/stickers/leo-prowl.png" alt="" width={128} height={124} priority className="ab-leo ab-leo-prowl absolute" />
        <Image src="/brand/stickers/leo-sit.png" alt="" width={88} height={167} priority className={`ab-leo ab-leo-sit absolute ${seated ? "" : ""}`} />
      </div>

      {/* welcome card */}
      <div
        className={`absolute inset-x-4 bottom-6 z-10 mx-auto max-w-md rounded-3xl bg-surface p-6 shadow-[0_-8px_40px_rgba(20,20,20,0.12)] transition-all duration-500 ${showCard ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-12 opacity-0"}`}
      >
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
