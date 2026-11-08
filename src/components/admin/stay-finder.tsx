"use client";

import { useMemo, useState } from "react";

export type StayRow = {
  id: string;
  name: string;
  zone: string | null;
  km: number | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  address: string | null;
  note: string | null;
  partner: boolean;
};

/** One decimal, always. Crow-flies distance to the metre is false precision. */
const km = (n: number | null) => (n == null ? null : `${n.toFixed(1)} km`);

const dirUrl = (s: StayRow) =>
  `https://www.google.com/maps/dir/?api=1&travelmode=two-wheeler&destination=${encodeURIComponent(
    s.lat != null && s.lng != null
      ? `${s.lat},${s.lng}`
      : `${s.name}, Mount Abu, Rajasthan`,
  )}`;

/** Fold accents and punctuation so "Hotel Hilltone" matches "hilltone". */
const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * A rider on a bike, one hand, bad light. Type three letters of the hotel name,
 * get the distance and a Directions button. No map tiles, no pinch-zoom.
 */
export function StayFinder({ stays }: { stays: StayRow[] }) {
  const [q, setQ] = useState("");
  const [zone, setZone] = useState<string | null>(null);

  const index = useMemo(
    () =>
      stays.map((s) => ({
        s,
        hay: fold(`${s.name} ${s.zone ?? ""} ${s.address ?? ""}`),
      })),
    [stays],
  );
  const zones = useMemo(
    () =>
      [
        ...new Set(stays.map((s) => s.zone).filter((z): z is string => !!z)),
      ].sort(),
    [stays],
  );

  const results = useMemo(() => {
    const terms = fold(q).split(" ").filter(Boolean);
    return index
      .filter(
        ({ s, hay }) =>
          (!zone || s.zone === zone) && terms.every((t) => hay.includes(t)),
      )
      .map(({ s }) => s)
      .sort((a, b) => (a.km ?? 99) - (b.km ?? 99))
      .slice(0, 60);
  }, [index, q, zone]);

  return (
    <div className="flex flex-col gap-3">
      {/* Sticky, because the list runs to a few hundred rows and the rider is
          scrolling one-handed. */}
      <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-2 bg-paper px-4 pb-2 pt-1">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Hotel, villa or landmark"
          autoComplete="off"
          enterKeyHint="search"
          className="h-12 w-full rounded-2xl border-[1.5px] border-line bg-surface px-4 text-[17px] outline-none focus:border-ink"
        />
        {zones.length > 1 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setZone(null)}
              className={`h-9 flex-none rounded-full px-3.5 text-[13px] font-semibold ${zone === null ? "bg-ink text-reversed" : "bg-surface"}`}
            >
              All
            </button>
            {zones.map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setZone(z === zone ? null : z)}
                className={`h-9 flex-none rounded-full px-3.5 text-[13px] font-semibold ${z === zone ? "bg-ink text-reversed" : "bg-surface"}`}
              >
                {z}
              </button>
            ))}
          </div>
        )}
      </div>

      {results.length === 0 ? (
        <p className="rounded-2xl bg-surface p-6 text-center text-muted">
          {q
            ? `Nothing matching "${q}". Try a shorter spelling, or ring the kitchen.`
            : "No stays loaded yet."}
        </p>
      ) : (
        results.map((s) => (
          <article
            key={s.id}
            className="flex items-center gap-3 rounded-2xl bg-surface p-3.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-bold leading-tight">
                {s.name}
                {s.partner && (
                  <span className="ml-1.5 align-middle rounded-full bg-acid px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink">
                    QR
                  </span>
                )}
              </p>
              <p className="mt-0.5 truncate text-[13px] text-muted">
                {[s.zone, km(s.km), s.address].filter(Boolean).join(" · ")}
              </p>
              {s.note && (
                <p className="mt-1 text-[13px] font-medium text-hill">
                  {s.note}
                </p>
              )}
            </div>
            {s.phone && (
              <a
                href={`tel:${s.phone}`}
                aria-label={`Call ${s.name}`}
                className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-paper"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
                </svg>
              </a>
            )}
            <a
              href={dirUrl(s)}
              target="_blank"
              rel="noreferrer"
              className="h-11 flex-none rounded-xl bg-ink px-3.5 text-[13px] font-bold leading-[2.75rem] text-reversed"
            >
              Go
            </a>
          </article>
        ))
      )}
      {results.length === 60 && (
        <p className="text-center text-[13px] text-muted">
          Showing the 60 nearest. Type more to narrow it.
        </p>
      )}
    </div>
  );
}
