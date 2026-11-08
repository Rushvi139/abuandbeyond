"use client";

import { useEffect, useState } from "react";

/**
 * The bhalu from the sticker sheet, sitting with one of our rolls and happily
 * tucking in. Rendered film, keyed onto transparency: WebM where alpha works,
 * animated WebP on Safari and iOS, a still where motion is unwelcome.
 */
export function HappyBear({ size = 190, className = "" }: { size?: number; className?: string }) {
  const [mode, setMode] = useState<"still" | "video" | "image">("still");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ua = navigator.userAgent;
    const webkit = /iPad|iPhone|iPod/.test(ua) || (/Safari/.test(ua) && !/Chrome|Chromium|CriOS|Android|Edg/.test(ua));
    setMode(webkit ? "image" : "video");
  }, []);

  const common = "h-full w-full object-contain drop-shadow-[0_6px_10px_rgba(20,20,20,0.18)]";
  return (
    <div className="relative inline-block" style={{ width: size, height: size * 1.1 }} aria-hidden="true">
      <span className="ab-bear-note ab-bear-note-1 absolute -top-2 right-1 font-display text-[22px] text-clay">♪</span>
      <span className="ab-bear-note ab-bear-note-2 absolute -top-4 left-3 font-display text-[18px] text-hill">♫</span>
      {mode === "video" ? (
        <video src="/brand/bear-eating.webm" poster="/brand/bear-eating-still.webp" autoPlay muted loop playsInline preload="auto" className={`${common} ${className}`} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mode === "image" ? "/brand/bear-eating.webp" : "/brand/bear-eating-still.webp"} alt="" className={`${common} ${className}`} />
      )}
    </div>
  );
}
