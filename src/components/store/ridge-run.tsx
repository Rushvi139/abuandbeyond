"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Something to do while the food is on its way.
 *
 * One tap to flap, granite stacks to get through — the plateau is full of
 * them, so the setting does the work and nothing here is borrowed.
 *
 * Deliberately tiny and self-contained: one canvas, no library, no network,
 * nothing saved anywhere but a best score in this browser. It sits below the
 * live order status and must never get in the way of it, so it is collapsed
 * until tapped and it stops its own loop the moment it is closed or the tab
 * is hidden — a phone in a pocket should not render 60 frames a second while
 * dinner is on its way.
 */
const W = 320;
const H = 400;

const GRAVITY = 1250; // px/s²
const FLAP = -360; // px/s, straight up
const SPEED = 104; // px/s the rocks travel
const GAP = 146; // the hole to fly through
const SPACING = 212; // px between stacks
const ROCK_W = 40;
const CLIMB = 92; // how far the next gap may sit from the last
const R = 13; // bear radius
const MIN_GAP_Y = GAP / 2 + 26; // keeps a gap off the very top and floor

const INK = "#141414";
const BONE = "#f3efe6";
const HILL = "#1f3a33";
const KRAFT = "#d9c39c";
const CLAY = "#ff4d14";
const ACID = "#ffd400";

type Stack = { x: number; gapY: number; passed: boolean };

/** The skyline, as [fraction across, height above the floor]. Guru Shikhar is the tall one. */
const RIDGE: [number, number][] = [
  [0.08, 30], [0.17, 19], [0.28, 46], [0.36, 27],
  [0.5, 68], [0.61, 31], [0.72, 52], [0.84, 24], [0.94, 38], [1, 20],
];

export function RidgeRun() {
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [over, setOver] = useState(false);
  const [started, setStarted] = useState(false);

  const canvas = useRef<HTMLCanvasElement | null>(null);
  const y = useRef(H / 2);
  const vy = useRef(0);
  const stacks = useRef<Stack[]>([]);
  const raf = useRef<number | null>(null);
  const last = useRef(0);
  const live = useRef({ score: 0, started: false });
  const tilt = useRef(0);

  const reset = useCallback(() => {
    y.current = H / 2;
    vy.current = 0;
    tilt.current = 0;
    stacks.current = [];
    live.current = { score: 0, started: false };
    last.current = 0;
    setScore(0);
    setOver(false);
    setStarted(false);
  }, []);

  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem("ab_ridgerun_best") ?? 0) || 0);
    } catch {
      /* storage blocked — the game just doesn't remember a best */
    }
  }, []);

  const flap = useCallback(() => {
    if (over) return;
    if (!live.current.started) {
      live.current.started = true;
      setStarted(true);
    }
    vy.current = FLAP;
  }, [over]);

  useEffect(() => {
    if (!open || over) return;
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = W * dpr;
    c.height = H * dpr;
    ctx.scale(dpr, dpr);

    const bearX = 84;

    /** One granite stack: a slab with a cap, top and bottom of the gap. */
    const rocks = (s: Stack) => {
      const x = s.x - ROCK_W / 2;
      ctx.fillStyle = HILL;
      ctx.fillRect(x, 0, ROCK_W, s.gapY - GAP / 2);
      ctx.fillRect(x, s.gapY + GAP / 2, ROCK_W, H - (s.gapY + GAP / 2));
      // Caps, so the gap edge reads clearly at a glance.
      ctx.fillStyle = KRAFT;
      ctx.fillRect(x - 4, s.gapY - GAP / 2 - 11, ROCK_W + 8, 11);
      ctx.fillRect(x - 4, s.gapY + GAP / 2, ROCK_W + 8, 11);
    };

    /** The bhalu, nose first. */
    const bear = (cy: number, angle: number) => {
      ctx.save();
      ctx.translate(bearX, cy);
      ctx.rotate(angle);
      // Bear and rocks are both near-black, so he carries a bone outline or
      // he disappears into one at the worst moment.
      ctx.strokeStyle = BONE;
      ctx.lineWidth = 2.5;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(-5, -10, 5.5, 0, Math.PI * 2); // ears
      ctx.arc(7, -11, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2); // head
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = KRAFT;
      ctx.beginPath();
      ctx.ellipse(8, 4, 7, 5.5, 0, 0, Math.PI * 2); // muzzle
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(12, 3, 2, 0, Math.PI * 2); // nose
      ctx.fill();
      ctx.fillStyle = BONE;
      ctx.beginPath();
      ctx.arc(4, -4, 2.2, 0, Math.PI * 2); // eye
      ctx.fill();
      ctx.restore();
    };

    const step = (now: number) => {
      const dt = last.current ? Math.min((now - last.current) / 1000, 0.05) : 0;
      last.current = now;

      // Nothing moves until the first tap, so the rules are obvious before
      // anything can go wrong.
      if (live.current.started) {
        vy.current += GRAVITY * dt;
        y.current += vy.current * dt;
        for (const s of stacks.current) s.x -= SPEED * dt;

        const tail = stacks.current[stacks.current.length - 1];
        const furthest = tail ? tail.x : bearX + 150;
        if (furthest < W + SPACING - 60) {
          // The next gap stays within reach of the last one. Random anywhere
          // means an unavoidable dive now and then, which reads as the game
          // cheating rather than the player missing.
          const from = tail ? tail.gapY : H / 2;
          const lo = Math.max(MIN_GAP_Y, from - CLIMB);
          const hi = Math.min(H - MIN_GAP_Y, from + CLIMB);
          stacks.current.push({ x: furthest + SPACING, gapY: lo + Math.random() * (hi - lo), passed: false });
        }
        stacks.current = stacks.current.filter((s) => s.x > -60);
      }

      tilt.current = Math.max(-0.5, Math.min(1.1, (vy.current / 620) * 1.2));

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = BONE;
      ctx.fillRect(0, 0, W, H);

      // The ridge from the logo, far behind everything. Uneven on purpose —
      // the one on the patch is hand-drawn and lopsided, and a tidy row of
      // triangles would read as a different hill altogether.
      ctx.fillStyle = "rgba(31,58,51,0.10)";
      ctx.beginPath();
      ctx.moveTo(0, H);
      ctx.lineTo(0, H - 22);
      for (const [fx, fy] of RIDGE) ctx.lineTo(fx * W, H - fy);
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();

      for (const s of stacks.current) rocks(s);

      // The sky is a ceiling, not a hazard: dying for flapping too eagerly
      // feels like a cheat. The ground and the rocks are what count.
      if (y.current - R < 0) {
        y.current = R;
        vy.current = 0;
      }
      // Collision and scoring, after the move so what is drawn is what hit.
      let dead = y.current + R > H;
      for (const s of stacks.current) {
        const withinX = Math.abs(s.x - bearX) < ROCK_W / 2 + R;
        if (withinX && (y.current - R < s.gapY - GAP / 2 || y.current + R > s.gapY + GAP / 2)) dead = true;
        if (!s.passed && s.x + ROCK_W / 2 < bearX - R) {
          s.passed = true;
          live.current.score += 1;
          setScore(live.current.score);
        }
      }

      bear(Math.max(R, Math.min(H - R, y.current)), tilt.current);

      if (dead) {
        setOver(true);
        setBest((b) => {
          const next = Math.max(b, live.current.score);
          try {
            localStorage.setItem("ab_ridgerun_best", String(next));
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
      if (document.hidden) {
        if (raf.current) cancelAnimationFrame(raf.current);
      } else {
        // Back from a locked screen: forget the gap, or the bear falls the
        // whole time the phone was in a pocket.
        last.current = 0;
        raf.current = requestAnimationFrame(step);
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [open, over]);

  // Space and arrow-up flap too, so it is playable without a touchscreen.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        flap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flap]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-[18px] bg-acid py-3.5 text-[16px] font-bold text-ink shadow-[0_2px_0_0_rgba(20,20,20,0.9)]"
      >
        <span aria-hidden="true">🐻</span>
        Play while you wait
        {best > 0 && <span className="text-[13px] font-semibold opacity-70">best {best}</span>}
      </button>
    );
  }

  return (
    <section className="mt-4 overflow-hidden rounded-[18px] bg-surface">
      <header className="flex items-center gap-3 px-4 py-2.5">
        <span className="font-display text-[18px] uppercase">Over the ridge</span>
        <span className="ml-auto font-display text-[20px]">{score}</span>
        {best > 0 && <span className="text-[12px] text-muted">best {best}</span>}
        <button type="button" onClick={() => setOpen(false)} className="text-sm font-semibold text-muted">
          Close
        </button>
      </header>

      <div className="relative">
        <canvas
          ref={canvas}
          style={{ width: "100%", height: "auto", aspectRatio: `${W} / ${H}`, touchAction: "none" }}
          onPointerDown={(e) => {
            e.preventDefault();
            flap();
          }}
          aria-label="Tap to make the bear flap, and fly through the gaps in the rocks."
        />

        {!started && !over && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-ink">
            <p className="font-display text-[26px] uppercase" style={{ color: CLAY }}>
              Tap to flap
            </p>
            <p className="text-sm font-semibold">Through the gaps, not the rocks.</p>
          </div>
        )}

        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/80 text-reversed">
            <p className="font-display text-[30px] uppercase">
              {score} <span style={{ color: ACID }}>through</span>
            </p>
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

      <p className="px-4 py-2 text-[12px] text-muted">Tap anywhere on the game to flap. Space works too.</p>
    </section>
  );
}
