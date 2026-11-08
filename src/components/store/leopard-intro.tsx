"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The leopard entrance, keyed out of the rendered film in `public/brand/leopard/`.
 *
 * The film was shot against a black slab standing in for the logo patch, so these
 * numbers map the film's slab onto whatever size the real logo renders at.
 * Everything is in source pixels of the 710x448 frame.
 */
const FILM = { w: 710, h: 448, slabLeft: 89, slabTop: 238, slabWidth: 687 };

export const WALK_MS = 2400;      // leopard crosses the frame and starts climbing
export const SETTLED_MS = 4900;   // down, legs hanging, film's idle tail begins
export const CARD_MS = 5200;      // welcome card slides up over a still image

/** Safari and iOS ignore the alpha channel in VP9 WebM, so those get the animated WebP. */
function prefersImageSequence() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Safari/.test(ua) && !/Chrome|Chromium|CriOS|Android|Edg/.test(ua));
}

/**
 * Sits inside the scene, positioned against the logo's own box. The scene scales
 * as a whole, so the leopard and the logo can never drift apart.
 */
export function LeopardIntro({ logoWidth, reducedMotion = false }: { logoWidth: number; reducedMotion?: boolean }) {
  const [useImage, setUseImage] = useState(false);
  const [resting, setResting] = useState(reducedMotion);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => setUseImage(prefersImageSequence()), []);
  useEffect(() => {
    if (reducedMotion) return setResting(true);
    setResting(false);
    const t = setTimeout(() => setResting(true), SETTLED_MS);
    return () => clearTimeout(t);
  }, [reducedMotion]);

  if (!logoWidth) return null;

  const k = logoWidth / FILM.slabWidth;
  const width = FILM.w * k;
  const style = {
    left: `${-FILM.slabLeft * k}px`,
    top: `${-FILM.slabTop * k}px`,
    width: `${width}px`,
    // far enough left to clear the screen edge before it starts walking
    ["--leo-from" as string]: `${-(width * 0.95 + 24)}px`,
  };

  return (
    <div
      className="pointer-events-none absolute will-change-transform"
      style={{ ...style, animation: reducedMotion ? undefined : `leo-walk-in ${WALK_MS}ms linear both` }}
      aria-hidden="true"
    >
      {!resting &&
        (useImage ? (
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
        ))}
      {resting && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/brand/leopard/rest.webp" alt="" width={FILM.w} height={FILM.h} className="w-full animate-[leo-breathe_4s_ease-in-out_infinite]" />
      )}
    </div>
  );
}
