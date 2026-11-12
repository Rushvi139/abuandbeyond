import type { OrderView } from "@/lib/orders/queries";
import { navTarget, roundUrl } from "@/lib/orders/nav";

/**
 * One tap to navigate the whole round: every stop as a waypoint in the order
 * listed, the last one the destination. No origin is given, so Maps starts
 * from wherever the rider is standing — the kitchen's typed address was
 * a guess Maps could place wrongly.
 *
 * Each stop goes by the same rule as the single Navigate button
 * (`lib/orders/nav.ts`): precise pin, then the hotel's Google place, then a
 * rough pin, then the typed address.
 */
export function runUrl(stops: OrderView[]) {
  return roundUrl(stops);
}

export function RunMap({ stops }: { stops: OrderView[] }) {
  const url = runUrl(stops);
  if (!url) return null;
  const targets = stops.map(navTarget);
  const exact = targets.filter((t) => t.kind !== "text").length;

  return (
    <div className="rounded-2xl bg-ink p-3 text-reversed">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="font-display text-[20px] uppercase leading-none">
            {stops.length} stop{stops.length === 1 ? "" : "s"} on this run
          </p>
          <p className="mt-1 text-[13px] opacity-70">
            {exact} with an exact location{exact < stops.length ? `, ${stops.length - exact} by typed address` : ""}
          </p>
        </div>
        <a href={url} target="_blank" rel="noreferrer" className="h-11 flex-none rounded-xl bg-acid px-4 text-sm font-bold leading-[2.75rem] text-ink">
          Start the run
        </a>
      </div>
      <ol className="mt-3 flex flex-col gap-1 text-[13px]">
        {stops.map((o, i) => (
          <li key={o.id} className="flex gap-2">
            <span className="font-bold opacity-60">{i + 1}.</span>
            <span className="flex-1">
              #{o.number} · {[o.stay?.name ?? o.propertyName, o.roomOrLandmark].filter(Boolean).join(", ") || o.stayType}
            </span>
            {targets[i].label && <span className="opacity-60">{targets[i].label}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
