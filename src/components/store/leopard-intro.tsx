"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The leopard entrance, keyed out of the rendered film in `public/brand/leopard/`.
 *
 * The film was shot against a black slab standing in for the logo patch, so these
 * numbers map the film's slab onto whatever size the real logo renders at:
 * everything is expressed in source pixels of the 710x448 frame.
 */
const FILM = { w: 710, h: 448, slabLeft: 89, slabTop: 238, slabWidth: 687 };
export const INTRO_MS = 6000;          // length of the film
export const SETTLED_MS = 5200;        // leopard is down and resting by here

/** Safari/iOS ignores the alpha channel in VP9 WebM, so those get the animated WebP. */
function prefersImageSequence() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Safari/.test(ua) && !/Chrome|Chromium|CriOS|Android|Edg/.test(ua));
}

type Box = { left: number; top: number; width: number };

export function LeopardIntro({ logo, stage, reducedMotion = false }: { logo: DOMRect | null; stage: DOMRect | null; reducedMotion?: boolean }) {
  const [useImage, setUseImage] = useState(false);
  const [resting, setResting] = useState(reducedMotion);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => setUseImage(prefersImageSequence()), []);
  useEffect(() => {
    if (reducedMotion) return;
    setResting(false);
    const t = setTimeout(() => setResting(true), INTRO_MS - 120);
    return () => clearTimeout(t);
  }, [reducedMotion]);

  if (!logo || !stage) return null;

  // scale the film so its slab is exactly the width of the real logo patch
  const k = logo.width / FILM.slabWidth;
  const box: Box = {
    left: logo.left - stage.left - FILM.slabLeft * k,
    top: logo.top - stage.top - FILM.slabTop * k,
    width: FILM.w * k,
  };
  const style = { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px` };
  // it starts at the film's left edge, so walk the whole frame in from off-screen first
  const walkIn = Math.max(0, box.left + box.width * 0.1);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute"
        style={{ ...style, animation: reducedMotion ? undefined : `leo-walk-in 2.2s linear both`, ["--leo-from" as string]: `${-walkIn}px` }}
      >
        {!reducedMotion && !resting && (
          useImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/brand/leopard/walk-settle.webp" alt="" width={FILM.w} height={FILM.h} className="w-full" />
          ) : (
            <video
              ref={videoRef}
              src="/brand/leopard/walk-settle.webm"
              poster="/brand/leopard/first.webp"
              autoPlay
              muted
              playsInline
              preload="auto"
              className="w-full"
            />
          )
        )}
        {(resting || reducedMotion) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/brand/leopard/rest.webp" alt="" width={FILM.w} height={FILM.h} className="w-full animate-[leo-breathe_4s_ease-in-out_infinite]" />
        )}
      </div>
    </div>
  );
}
