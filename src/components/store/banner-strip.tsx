"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  linkUrl: string | null;
  imagePath: string | null;
  tone: "clay" | "acid" | "hill" | "ink" | "kraft";
  ctaLabel?: string | null;
};

const TONE: Record<Banner["tone"], { card: string; accent: string; cta: string }> = {
  clay: { card: "bg-clay text-ink", accent: "text-reversed", cta: "bg-ink text-reversed" },
  acid: { card: "bg-acid text-ink", accent: "text-clay", cta: "bg-ink text-reversed" },
  hill: { card: "bg-hill text-reversed", accent: "text-acid", cta: "bg-acid text-ink" },
  ink: { card: "bg-ink text-reversed", accent: "text-acid", cta: "bg-clay text-ink" },
  kraft: { card: "bg-kraft text-ink", accent: "text-clay", cta: "bg-ink text-reversed" },
};

/** A brand sticker sits on the right as art; any other image fills the card as a photo. */
const isSticker = (p: string) => p.startsWith("/brand/stickers/");
const EVERY_MS = 4500;

/**
 * Offers across the top of the menu. One card at a time, sliding on by itself
 * every few seconds; a swipe or a touch takes over and the slides stop until
 * the guest leaves it alone for a few seconds. With reduced motion it jumps
 * instead of sliding.
 */
const RESUME_MS = 6000;

export function BannerStrip({ banners }: { banners: Banner[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const held = useRef(false);
  const release = useRef<number | undefined>(undefined);

  const go = useCallback((i: number) => {
    const el = track.current;
    if (!el) return;
    const card = el.children[i] as HTMLElement | undefined;
    // Reduced motion still advances, as a jump instead of a slide.
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (card) el.scrollTo({ left: card.offsetLeft - el.offsetLeft, behavior: still ? "auto" : "smooth" });
  }, []);

  // Which card is showing, from where the track has scrolled to.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => {
      const w = (el.children[0] as HTMLElement | undefined)?.offsetWidth ?? el.clientWidth;
      setIndex(Math.max(0, Math.min(banners.length - 1, Math.round(el.scrollLeft / (w + 12)))));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [banners.length]);

  useEffect(() => {
    if (banners.length < 2) return;
    const t = window.setInterval(() => {
      if (held.current || document.hidden) return;
      setIndex((i) => {
        const next = (i + 1) % banners.length;
        go(next);
        return next;
      });
    }, EVERY_MS);
    return () => window.clearInterval(t);
  }, [banners.length, go]);

  if (!banners.length) return null;
  // A touch pauses the slides; they pick up again once the guest lets go
  // and leaves the cards alone for a few seconds.
  const hold = () => {
    held.current = true;
    window.clearTimeout(release.current);
    release.current = window.setTimeout(() => {
      held.current = false;
    }, RESUME_MS);
  };

  return (
    <div className="mt-4" aria-roledescription="carousel" aria-label="Offers">
      <div
        ref={track}
        onPointerDown={hold}
        onMouseEnter={hold}
        onMouseLeave={() => (held.current = false)}
        onFocus={hold}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {banners.map((b, i) => {
          const t = TONE[b.tone] ?? TONE.clay;
          const photo = b.imagePath && !isSticker(b.imagePath) ? b.imagePath : null;
          const art = b.imagePath && isSticker(b.imagePath) ? b.imagePath : null;
          const card = (
            <div className={`relative flex h-[164px] w-full overflow-hidden rounded-[22px] ${photo ? "bg-ink text-reversed" : t.card}`}>
              {photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
              )}
              {photo && <div className="absolute inset-0 bg-gradient-to-r from-ink/85 via-ink/55 to-transparent" />}
              {art && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={art} alt="" className="absolute -bottom-3 -right-3 h-[138px] w-[138px] rotate-[-6deg] object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.25)]" />
              )}
              <div className={`relative flex flex-col justify-center gap-1.5 py-4 pl-5 ${art ? "pr-[112px]" : "pr-5"}`}>
                <span className="font-display text-[23px] uppercase leading-[0.92]">{b.title}</span>
                {b.subtitle && <span className={`font-display text-[17px] uppercase leading-[0.95] ${photo ? "text-acid" : t.accent}`}>{b.subtitle}</span>}
                {b.ctaLabel && <span className={`mt-1.5 inline-flex h-8 w-fit items-center rounded-full px-3.5 text-[12px] font-bold ${photo ? "bg-clay text-ink" : t.cta}`}>{b.ctaLabel} →</span>}
              </div>
            </div>
          );
          const label = `${i + 1} of ${banners.length}`;
          const wrap = "w-[calc(100%-8px)] max-w-[420px] flex-none snap-center";
          if (!b.linkUrl) return <div key={b.id} className={wrap} role="group" aria-roledescription="slide" aria-label={label}>{card}</div>;
          return b.linkUrl.startsWith("/") || b.linkUrl.startsWith("#") ? (
            <Link key={b.id} href={b.linkUrl} className={wrap} aria-label={`${b.title}. ${label}`}>{card}</Link>
          ) : (
            <a key={b.id} href={b.linkUrl} target="_blank" rel="noreferrer" className={wrap} aria-label={`${b.title}. ${label}`}>{card}</a>
          );
        })}
      </div>
      {banners.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              aria-label={`Show offer ${i + 1}`}
              aria-current={i === index}
              onClick={() => {
                hold();
                setIndex(i);
                go(i);
              }}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-ink" : "w-1.5 bg-line"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
