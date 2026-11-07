"use client";

import { useEffect, useRef } from "react";

/**
 * A procedurally animated silhouette leopard: ONE figure whose spine, four limbs (front: two
 * segments; hind: femur, tibia, metatarsal), neck, head and seven-segment tail are posed every
 * frame from a small set of pose parameters, and whose torso outline is re-drawn each frame
 * from the spine. It walks in from the right along the logo's top edge with a lateral-sequence
 * feline gait (LH, LF, RH, RF), slows, settles, sits down, then idles (breathing, tail sway,
 * small head turns). Nothing is swapped between frames.
 *
 * Rig space: faces left (−x is forward), ground at y = 0, ~1 unit per CSS px at scale 1.
 */

type V = { x: number; y: number };
const d2r = (d: number) => (d * Math.PI) / 180;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

// standing skeleton
const S0: V = { x: -56, y: -94 }; // shoulder
const H0: V = { x: 64, y: -90 }; // hip
const HUM = 40, RAD = 42; // front leg
const FEM = 44, TIB = 40, MET = 34; // hind leg
const TAIL_N = 7, TAIL_L = 17;

type Pose = {
  hip: V;
  front: [number, number][]; // [shoulder angle (fwd +), carpus bend (back +)] for near, far
  hind: [number, number, number][]; // [femur (fwd +), tibia rel (back −), metatarsal rel (fwd +)]
  head: number; // degrees, nose up −
  tail: number[]; // world angles, 0 = back (right), 90 = down
  breath: number;
  bob: number;
};

function walkPose(phase: number, s: number): Pose {
  const amp = clamp(s, 0.35, 1);
  const off = { LF: 0.25, RF: 0.75, LH: 0.0, RH: 0.5 };
  const F = (o: number): [number, number] => {
    const p = 2 * Math.PI * (phase + o);
    const swing = Math.max(0, Math.cos(p));
    return [20 * amp * Math.sin(p), 48 * swing * amp];
  };
  const Hn = (o: number): [number, number, number] => {
    const p = 2 * Math.PI * (phase + o);
    const swing = Math.max(0, Math.cos(p));
    return [30 + 24 * amp * Math.sin(p), -62 - 34 * swing * amp, 30 + 26 * swing * amp];
  };
  const tail = Array.from({ length: TAIL_N }, (_, i) => -34 + i * 7 + 8 * Math.sin(2 * Math.PI * phase * 0.9 - i * 0.55));
  return {
    hip: { x: H0.x, y: H0.y + 2 * Math.sin(4 * Math.PI * phase) * s },
    front: [F(off.LF), F(off.RF)],
    hind: [Hn(off.LH), Hn(off.RH)],
    head: 2 * Math.sin(4 * Math.PI * phase + 0.5) * s,
    tail,
    breath: 0,
    bob: 1.6 * Math.sin(4 * Math.PI * phase) * s,
  };
}

const STAND: Pose = {
  hip: { ...H0 },
  front: [[2, 0], [-2, 0]],
  hind: [[30, -62, 30], [28, -60, 30]],
  head: 0,
  tail: [-34, -27, -20, -13, -6, 1, 8],
  breath: 0,
  bob: 0,
};

function sitPose(t: number): Pose {
  const sway = Math.sin(t * 1.0);
  return {
    hip: { x: 46, y: -16 },
    front: [[3, 0], [-3, 0]],
    hind: [[82, -162, 100], [78, -158, 98]],
    head: -16 + 2.5 * Math.sin(t * 0.4),
    tail: [66, 92, 118, 146, 168, 176 + 4 * sway, 184 + 8 * sway],
    breath: 0.5 + 0.5 * Math.sin(t * 1.25),
    bob: 0,
  };
}

function blend(a: Pose, b: Pose, t: number): Pose {
  return {
    hip: { x: lerp(a.hip.x, b.hip.x, t), y: lerp(a.hip.y, b.hip.y, t) },
    front: a.front.map((l, i) => [lerp(l[0], b.front[i][0], t), lerp(l[1], b.front[i][1], t)]),
    hind: a.hind.map((l, i) => [lerp(l[0], b.hind[i][0], t), lerp(l[1], b.hind[i][1], t), lerp(l[2], b.hind[i][2], t)]),
    head: lerp(a.head, b.head, t),
    tail: a.tail.map((s, i) => lerp(s, b.tail[i], t)),
    breath: lerp(a.breath, b.breath, t),
    bob: lerp(a.bob, b.bob, t),
  };
}

/** Catmull-Rom closed curve → SVG path. */
function smoothClosed(pts: V[]): string {
  const n = pts.length;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d + " Z";
}

/** Tapered limb segment as a polygon between two joints. */
function segPoints(a: V, b: V, w1: number, w2: number): string {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  return [
    `${a.x + nx * w1 / 2},${a.y + ny * w1 / 2}`,
    `${b.x + nx * w2 / 2},${b.y + ny * w2 / 2}`,
    `${b.x - nx * w2 / 2},${b.y - ny * w2 / 2}`,
    `${a.x - nx * w1 / 2},${a.y - ny * w1 / 2}`,
  ].join(" ");
}

// point along the spine frame: t along shoulder→hip, off = up (+) / down (−)
function spinePt(S: V, H: V, t: number, off: number): V {
  const dx = H.x - S.x, dy = H.y - S.y, L = Math.hypot(dx, dy);
  const ux = dx / L, uy = dy / L, nx = uy, ny = -ux;
  return { x: S.x + ux * t * L + nx * off, y: S.y + uy * t * L + ny * off };
}

type Props = {
  target: { x: number; groundY: number; scale: number };
  width: number;
  onSeated?: () => void;
  reducedMotion?: boolean;
};

export function Leopard({ target, width, onSeated, reducedMotion }: Props) {
  const root = useRef<SVGGElement>(null);
  const torso = useRef<SVGPathElement>(null);
  const headG = useRef<SVGGElement>(null);
  const spots = useRef<(SVGEllipseElement | null)[]>([]);
  const limbPolys = useRef<(SVGPolygonElement | null)[]>([]); // 2 per front leg, 3 per hind leg: order below
  const joints = useRef<(SVGCircleElement | null)[]>([]);
  const paws = useRef<(SVGEllipseElement | null)[]>([]);
  const tailPolys = useRef<(SVGPolygonElement | null)[]>([]);
  const seated = useRef(false);

  useEffect(() => {
    const startX = width + 170;
    const dist = startX - target.x;
    const SPEED = 120 * target.scale;
    const walkDur = (dist / SPEED) * 1.12;
    const SETTLE = 0.45, SIT = 1.2;
    let phase = 0, t0: number | null = null, lastT = 0, raf = 0;

    const draw = (x: number, p: Pose) => {
      root.current?.setAttribute("transform", `translate(${x} ${target.groundY}) scale(${target.scale})`);
      const S: V = { x: S0.x, y: S0.y + p.bob };
      const H = p.hip;
      const br = p.breath * 2.5;
      // torso outline from the spine frame
      const pts = [
        spinePt(S, H, -0.2, 10), spinePt(S, H, 0.25, 24 + br), spinePt(S, H, 0.8, 22 + br), spinePt(S, H, 1.17, 10),
        spinePt(S, H, 1.3, -14), spinePt(S, H, 1.12, -40), spinePt(S, H, 0.55, -48 - br), spinePt(S, H, -0.05, -54 - br),
        spinePt(S, H, -0.3, -38), spinePt(S, H, -0.32, -10),
      ];
      torso.current?.setAttribute("d", smoothClosed(pts));
      [[0.2, 2], [0.5, 10], [0.85, 0], [0.4, -22], [0.95, -22], [0.08, -26]].forEach(([t, o], i) => {
        const q = spinePt(S, H, t, o);
        spots.current[i]?.setAttribute("cx", q.x.toFixed(1));
        spots.current[i]?.setAttribute("cy", q.y.toFixed(1));
      });
      // head: neck base sits near the withers; direction follows the spine tilt + head angle
      const nb = spinePt(S, H, -0.26, -2);
      const tilt = (Math.atan2(H.y - S.y, H.x - S.x) * 180) / Math.PI;
      headG.current?.setAttribute("transform", `translate(${nb.x.toFixed(1)} ${nb.y.toFixed(1)}) rotate(${(tilt * 0.6 + p.head).toFixed(2)})`);

      // limbs — FK from joints; angles measured from straight down, forward (−x) positive
      const dir = (deg: number): V => ({ x: -Math.sin(d2r(deg)), y: Math.cos(d2r(deg)) });
      let k = 0, j = 0, pw = 0;
      const put = (a: V, b: V, w1: number, w2: number) => { limbPolys.current[k++]?.setAttribute("points", segPoints(a, b, w1, w2)); };
      const joint = (c: V, r: number) => { const e = joints.current[j++]; e?.setAttribute("cx", c.x.toFixed(1)); e?.setAttribute("cy", c.y.toFixed(1)); e?.setAttribute("r", String(r)); };
      const paw = (c: V) => { const e = paws.current[pw++]; e?.setAttribute("cx", (c.x - 3).toFixed(1)); e?.setAttribute("cy", (c.y + 1).toFixed(1)); };
      // order must match the JSX: far hind, far front, near hind, near front
      const hind = (hip: V, [a, b, c]: number[]) => {
        const knee = { x: hip.x + dir(a).x * FEM, y: hip.y + dir(a).y * FEM };
        const hock = { x: knee.x + dir(a + b).x * TIB, y: knee.y + dir(a + b).y * TIB };
        const foot = { x: hock.x + dir(a + b + c).x * MET, y: hock.y + dir(a + b + c).y * MET };
        put(hip, knee, 34, 20); put(knee, hock, 19, 13); put(hock, foot, 12, 11);
        joint(hip, 17); joint(knee, 10); joint(hock, 6.5); paw(foot);
      };
      const front = (sh: V, [a, b]: number[]) => {
        const elbow = { x: sh.x + dir(a).x * HUM, y: sh.y + dir(a).y * HUM };
        const foot = { x: elbow.x + dir(a - b).x * RAD, y: elbow.y + dir(a - b).y * RAD };
        put(sh, elbow, 24, 15); put(elbow, foot, 15, 11);
        joint(sh, 12); joint(elbow, 7.5); paw(foot);
      };
      const hipJ: V = { x: H.x + 2, y: H.y + 6 }, shJ: V = { x: S.x - 2, y: S.y + 8 };
      hind(hipJ, p.hind[1]); front(shJ, p.front[1]); hind(hipJ, p.hind[0]); front(shJ, p.front[0]);

      // tail
      let tp = spinePt(S, H, 1.26, -8);
      p.tail.forEach((ang, i) => {
        const nx = tp.x + TAIL_L * Math.cos(d2r(ang)), ny = tp.y + TAIL_L * Math.sin(d2r(ang));
        tailPolys.current[i]?.setAttribute("points", segPoints(tp, { x: nx, y: ny }, 13 - i * 1.2, 12 - i * 1.25));
        tp = { x: nx, y: ny };
      });
    };

    if (reducedMotion) {
      draw(target.x, sitPose(0));
      seated.current = true;
      onSeated?.();
      return;
    }

    const frame = (now: number) => {
      if (t0 === null) t0 = now;
      const t = (now - t0) / 1000;
      const dt = lastT ? Math.min(0.05, t - lastT) : 0;
      lastT = t;
      if (t < walkDur) {
        const u = t / walkDur;
        const eased = 1 - Math.pow(1 - u, 2.4);
        const x = startX - dist * eased;
        const v = (2.4 * Math.pow(1 - u, 1.4) * dist) / walkDur; // px/s
        const s = clamp(v / SPEED, 0, 1);
        phase += dt * 1.5 * Math.max(s, 0.12);
        draw(x, walkPose(phase, Math.max(s, 0.28)));
      } else if (t < walkDur + SETTLE) {
        const k = easeInOut((t - walkDur) / SETTLE);
        draw(target.x, blend(walkPose(phase, 0.28), STAND, k));
      } else if (t < walkDur + SETTLE + SIT) {
        const k = easeInOut((t - walkDur - SETTLE) / SIT);
        draw(target.x, blend(STAND, sitPose(0), k));
      } else {
        if (!seated.current) { seated.current = true; onSeated?.(); }
        draw(target.x, sitPose(t - walkDur - SETTLE - SIT));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [target.x, target.groundY, target.scale, width, onSeated, reducedMotion]);

  const ink = "#141414", bone = "#F3EFE6";
  const limb = (n: number, far: boolean) =>
    Array.from({ length: n }, (_, i) => <polygon key={i} ref={(el) => { limbPolys.current[limbPolys.current.length] = el; }} fill={ink} opacity={far ? 0.9 : 1} />);

  // refs are pushed in render order; render order = far hind(3), far front(2), near hind(3), near front(2)
  limbPolys.current = []; joints.current = []; paws.current = [];
  const jointEls = (n: number, far: boolean) => Array.from({ length: n }, (_, i) => <circle key={i} ref={(el) => { joints.current[joints.current.length] = el; }} fill={ink} opacity={far ? 0.9 : 1} />);
  const pawEl = (far: boolean) => <ellipse ref={(el) => { paws.current[paws.current.length] = el; }} rx="12" ry="6" fill={ink} opacity={far ? 0.9 : 1} />;

  return (
    <g ref={root} aria-hidden="true">
      {/* far legs */}
      {limb(3, true)}{jointEls(3, true)}{pawEl(true)}
      {limb(2, true)}{jointEls(2, true)}{pawEl(true)}
      {/* tail */}
      {Array.from({ length: TAIL_N }, (_, i) => <polygon key={i} ref={(el) => { tailPolys.current[i] = el; }} fill={ink} />)}
      {/* torso */}
      <path ref={torso} fill={ink} />
      <g fill="none" stroke={bone} strokeWidth="2.2" opacity="0.85">
        {Array.from({ length: 6 }, (_, i) => <ellipse key={i} ref={(el) => { spots.current[i] = el; }} rx={i % 2 ? 4.5 : 5.5} ry={i % 2 ? 3.5 : 4} />)}
      </g>
      {/* neck + head, drawn facing left with the neck base at the origin */}
      <g ref={headG}>
        <path
          d="M 6 -4 C -4 -22, -22 -44, -46 -56 C -62 -64, -84 -60, -92 -46 C -98 -34, -94 -22, -82 -18 C -70 -14, -56 -16, -44 -10 C -30 -2, -16 10, -4 24 C 2 30, 10 24, 12 14 Z"
          fill={ink}
        />
        <path d="M -40 -56 C -42 -66, -36 -76, -30 -74 C -24 -70, -26 -58, -32 -52 Z" fill={ink} />
        <path d="M -62 -60 C -68 -70, -78 -76, -82 -70 C -84 -64, -76 -56, -66 -54 Z" fill={ink} />
        <circle cx="-76" cy="-40" r="2.8" fill={bone} />
      </g>
      {/* near legs */}
      {limb(3, false)}{jointEls(3, false)}{pawEl(false)}
      {limb(2, false)}{jointEls(2, false)}{pawEl(false)}
    </g>
  );
}
