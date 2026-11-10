"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Something to do while the food is on its way.
 *
 * Deliberately tiny and self-contained: one canvas, no library, no network,
 * and nothing saved anywhere. It sits below the live order status and must
 * never get in the way of it — collapsed until tapped, and it stops its own
 * animation loop the moment it is closed or the tab is hidden, so a phone in
 * a pocket isn't rendering 60 frames a second while dinner arrives.
 */
const W = 320;
const H = 400;
const BEAR_W = 56;
const FOODS = ["🌯", "🍕", "🍜", "🌮", "🥤"];

type Drop = { x: number; y: number; vy: number; char: string; bad: boolean };

export function RollCatch() {
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [lives, setLives] = useState(3);
  const [over, setOver] = useState(false);

  const canvas = useRef<HTMLCanvasElement | null>(null);
  const bearX = useRef(W / 2);
  const drops = useRef<Drop[]>([]);
  const raf = useRef<number | null>(null);
  const last = useRef(0);
  const spawn = useRef(0);
  const live = useRef({ score: 0, lives: 3 });

  const reset = useCallback(() => {
    drops.current = [];
    bearX.current = W / 2;
    live.current = { score: 0, lives: 3 };
    setScore(0);
    setLives(3);
    setOver(false);
    spawn.current = 0;
    last.current = 0;
  }, []);

  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem("ab_rollcatch_best") ?? 0) || 0);
    } catch {
      /* storage blocked — the game just doesn't remember a best */
    }
  }, []);

  useEffect(() => {
    if (!open || over) return;
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = W * dpr;
    c.height = H * dpr;
    ctx.scale(dpr, dpr);

    const step = (now: number) => {
      const dt = last.current ? Math.min((now - last.current) / 1000, 0.05) : 0;
      last.current = now;

      // Falls faster as the score climbs, so it stops being trivial.
      const speed = 90 + live.current.score * 4;
      spawn.current -= dt;
      if (spawn.current <= 0) {
        spawn.current = Math.max(0.35, 0.95 - live.current.score * 0.015);
        const bad = Math.random() < 0.18;
        drops.current.push({
          x: 20 + Math.random() * (W - 40),
          y: -24,
          vy: speed * (0.85 + Math.random() * 0.4),
          char: bad ? "🌶️" : FOODS[Math.floor(Math.random() * FOODS.length)],
          bad,
        });
      }

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#f2efe6";
      ctx.fillRect(0, 0, W, H);

      const bearY = H - 46;
      for (const d of drops.current) {
        d.y += d.vy * dt;
        const caught = d.y > bearY - 18 && d.y < bearY + 24 && Math.abs(d.x - bearX.current) < BEAR_W / 2 + 14;
        if (caught) {
          d.y = H + 999;
          if (d.bad) {
            live.current.lives -= 1;
            setLives(live.current.lives);
          } else {
            live.current.score += 1;
            setScore(live.current.score);
          }
        } else if (d.y > H + 30) {
          d.y = H + 999;
          // Only dropping real food costs a life; letting a chilli past is fine.
          if (!d.bad) {
            live.current.lives -= 1;
            setLives(live.current.lives);
          }
        }
      }
      drops.current = drops.current.filter((d) => d.y < H + 100);

      ctx.font = "26px serif";
      ctx.textAlign = "center";
      for (const d of drops.current) ctx.fillText(d.char, d.x, d.y);

      ctx.font = "40px serif";
      ctx.fillText("🐻", bearX.current, bearY + 14);

      if (live.current.lives <= 0) {
        setOver(true);
        setBest((b) => {
          const next = Math.max(b, live.current.score);
          try {
            localStorage.setItem("ab_rollcatch_best", String(next));
          } catch {
            /* fine */
          }
          return next;
        });
        return;
      }
      raf.current = requestAnimationFrame(step);
    };

    raf.current = requestAnimationFrame(step);
    const onHide = () => {
      if (document.hidden && raf.current) cancelAnimationFrame(raf.current);
      else if (!document.hidden) raf.current = requestAnimationFrame(step);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [open, over]);

  const move = (clientX: number) => {
    const rect = canvas.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((clientX - rect.left) / rect.width) * W;
    bearX.current = Math.max(BEAR_W / 2, Math.min(W - BEAR_W / 2, x));
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-[18px] border-[1.5px] border-dashed border-line py-3 text-[15px] font-semibold"
      >
        🐻 Play while you wait
        {best > 0 && <span className="text-[13px] font-normal text-muted">best {best}</span>}
      </button>
    );
  }

  return (
    <section className="mt-4 overflow-hidden rounded-[18px] bg-surface">
      <header className="flex items-center gap-3 px-4 py-2.5">
        <span className="font-display text-[18px] uppercase">Catch the order</span>
        <span className="ml-auto text-sm font-bold">{score}</span>
        <span className="text-sm" aria-label={`${lives} lives left`}>
          {"♥".repeat(Math.max(0, lives))}
          <span className="text-muted">{"♥".repeat(Math.max(0, 3 - lives))}</span>
        </span>
        <button type="button" onClick={() => setOpen(false)} className="text-sm font-semibold text-muted">
          Close
        </button>
      </header>

      <div className="relative">
        <canvas
          ref={canvas}
          style={{ width: "100%", height: "auto", aspectRatio: `${W} / ${H}`, touchAction: "none" }}
          onPointerMove={(e) => move(e.clientX)}
          onPointerDown={(e) => move(e.clientX)}
          aria-label="Move the bear to catch the food. Avoid the chillies."
        />
        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/80 text-reversed">
            <p className="font-display text-[28px] uppercase">{score} caught</p>
            {score >= best && score > 0 && <p className="text-sm">Your best yet.</p>}
            <button
              type="button"
              onClick={reset}
              className="mt-1 h-11 rounded-xl bg-clay px-5 text-[15px] font-bold text-ink"
            >
              Again
            </button>
          </div>
        )}
      </div>

      <p className="px-4 py-2 text-[12px] text-muted">Drag to move. Chillies cost a life, so does dropping food.</p>
    </section>
  );
}
