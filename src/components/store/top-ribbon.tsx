"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type Ribbon = {
  id: string;
  title: string;
  subtitle: string | null;
  linkUrl: string | null;
  ctaLabel: string | null;
  tone: "clay" | "acid" | "hill" | "ink" | "kraft";
  motif: "none" | "lights" | "paws";
};

const TONE: Record<Ribbon["tone"], string> = {
  clay: "bg-clay text-ink",
  acid: "bg-acid text-ink",
  hill: "bg-hill text-reversed",
  ink: "bg-ink text-reversed",
  kraft: "bg-kraft text-ink",
};

const PILL: Record<Ribbon["tone"], string> = {
  clay: "border-ink/35 bg-ink/10",
  acid: "border-ink/35 bg-ink/10",
  hill: "border-bone/40 bg-bone/15",
  ink: "border-bone/40 bg-bone/15",
  kraft: "border-ink/35 bg-ink/10",
};

/**
 * The slim strip across the very top of the store: an offer, a must-try dish,
 * a festival note. Several lines take turns rather than stacking up.
 */
export function TopRibbon({ ribbons }: { ribbons: Ribbon[] }) {
  const [at, setAt] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (ribbons.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setAt((i) => (i + 1) % ribbons.length);
        setFading(false);
      }, 320);
    }, 5200);
    return () => clearInterval(t);
  }, [ribbons.length]);

  if (!ribbons.length) return null;
  const r = ribbons[at] ?? ribbons[0];

  const line = (
    <span className={`flex min-w-0 items-center justify-center gap-2 transition-opacity duration-300 ${fading ? "opacity-0" : "opacity-100"}`}>
      <span className="min-w-0 truncate text-[12px] font-bold uppercase tracking-[0.06em] sm:text-[13px] sm:tracking-[0.08em]">{r.title}</span>
      {r.subtitle && <span className="hidden truncate text-[13px] opacity-80 sm:inline">{r.subtitle}</span>}
      {r.linkUrl && (
        <span className={`flex h-6 flex-none items-center gap-1 rounded-full border px-2 text-[10px] font-bold uppercase tracking-wide sm:px-2.5 sm:text-[11px] ${PILL[r.tone]}`}>
          {r.ctaLabel || "See"}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      )}
    </span>
  );

  const motif = r.motif === "lights" ? "ab-ribbon-lights" : r.motif === "paws" ? "ab-ribbon-paws" : "";

  return (
    <div className={`relative z-30 ${TONE[r.tone]} ${motif}`} role="region" aria-label="Announcements">
      <div className="mx-auto flex h-10 max-w-md items-center justify-center overflow-hidden px-4">
        {r.linkUrl ? (
          r.linkUrl.startsWith("/") || r.linkUrl.startsWith("#") ? (
            <Link href={r.linkUrl} className="flex w-full items-center justify-center">{line}</Link>
          ) : (
            <a href={r.linkUrl} target="_blank" rel="noreferrer" className="flex w-full items-center justify-center">{line}</a>
          )
        ) : (
          line
        )}
      </div>
    </div>
  );
}
