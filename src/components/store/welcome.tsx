"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const SEEN_KEY = "ab_welcomed_v1";

// Copy lives here so it can be tuned without touching the animation.
const COPY = {
  eyebrow: "A note from the kitchen",
  headline: ["For friends.", "For family.", "For you."],
  body: "We built Abu & Beyond with everything we have: our home, our taste buds, and a lot of late nights. Every dish is made with passion for the people we love. Tonight, that's you.",
  sign: "With love, from the hills of Abu.",
  cta: "Let's eat",
};

/**
 * First-visit entrance: a leopard climbs down from the top of the screen and sits on the patch logo,
 * then a short welcome card slides up. Shown once per device; skippable; static when the visitor
 * prefers reduced motion.
 */
export function Welcome() {
  const [phase, setPhase] = useState<"hidden" | "drop" | "card" | "leaving">("hidden");

  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {}
    if (seen) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPhase("drop");
    const t = setTimeout(() => setPhase("card"), reduced ? 50 : 2200);
    return () => clearTimeout(t);
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-paper px-5 transition-opacity duration-400 ${phase === "leaving" ? "opacity-0" : "opacity-100"}`}
    >
      <button type="button" onClick={close} className="absolute right-4 top-4 h-11 rounded-full px-4 text-sm font-semibold text-muted">
        Skip
      </button>

      {/* stage: leopard + logo */}
      <div className={`relative flex w-[280px] flex-col items-center transition-transform duration-500 ${showCard ? "-translate-y-24 scale-90" : ""}`}>
        <Image
          src="/brand/stickers/leopard.png"
          alt=""
          width={164}
          height={144}
          priority
          className="ab-leopard relative z-10 -mb-7 ml-16 drop-shadow-[0_6px_10px_rgba(20,20,20,0.18)]"
        />
        <Image src="/brand/patch-primary.png" alt="Abu & Beyond" width={260} height={177} priority className="relative" />
        <div className="ab-paws pointer-events-none absolute -top-40 right-2 flex flex-col items-end gap-6" aria-hidden="true">
          <Paw className="rotate-12" />
          <Paw className="mr-5 -rotate-6" />
          <Paw className="rotate-3" />
        </div>
      </div>

      {/* welcome card */}
      <div
        className={`absolute inset-x-4 bottom-6 mx-auto max-w-md rounded-3xl bg-surface p-6 shadow-[0_-8px_40px_rgba(20,20,20,0.12)] transition-all duration-500 ${showCard ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"}`}
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
        <button
          type="button"
          onClick={close}
          className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl bg-clay text-base font-bold text-ink"
        >
          {COPY.cta}
        </button>
      </div>
    </div>
  );
}

function Paw({ className = "" }: { className?: string }) {
  return <Image src="/brand/stickers/paw.png" alt="" width={22} height={32} className={`opacity-70 ${className}`} />;
}
