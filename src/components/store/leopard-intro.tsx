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
  const [useImage, setUseImage] = useState<boolean | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [resting, setResting] = useState(reducedMotion);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => setUseImage(prefersImageSequence()), []);

  /*
   * The animated WebP plays once (loop = 1). iPhone Safari keeps the decoded
   * image in memory, so on a second visit the same URL comes back already
   * finished and the leopard slides in frozen on its last frame. A fresh
   * object URL for each entrance makes Safari decode it again from frame
   * one, while `fetch` still serves the bytes from the HTTP cache — no
   * second download.
   */
  useEffect(() => {
    if (!useImage || reducedMotion) return;
    let url: string | null = null;
    let live = true;
    const fallback = setTimeout(() => live && setImageSrc((s) => s ?? `/brand/leopard/walk-settle.webp?play=${Date.now()}`), 2500);
    fetch("/brand/leopard/walk-settle.webp")
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => {
        if (!live) return;
        url = URL.createObjectURL(b);
        setImageSrc((s) => s ?? url);
      })
      .catch(() => live && setImageSrc(`/brand/leopard/walk-settle.webp?play=${Date.now()}`));
    return () => {
      live = false;
      clearTimeout(fallback);
      if (url) URL.revokeObjectURL(url);
    };
  }, [useImage, reducedMotion]);

  // The walk starts when the film can actually play: at once for the video,
  // once the fresh image is ready on Safari.
  const ready = reducedMotion || useImage === false || (useImage === true && imageSrc !== null);
  useEffect(() => {
    if (reducedMotion) return setResting(true);
    if (!ready) return;
    setResting(false);
    const t = setTimeout(() => setResting(true), SETTLED_MS);
    return () => clearTimeout(t);
  }, [reducedMotion, ready]);

  if (!logoWidth || !ready) return null;

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
          <img src={imageSrc ?? "/brand/leopard/walk-settle.webp"} alt="" width={FILM.w} height={FILM.h} className="w-full" />
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
