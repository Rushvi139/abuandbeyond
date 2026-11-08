import type { OrderView } from "@/lib/orders/queries";

/**
 * One tap to navigate the whole round. Google Maps takes the kitchen as origin,
 * every stop as a waypoint in the order they are listed, and the last stop as
 * the destination — so the rider gets turn-by-turn without typing an address.
 *
 * A stop with a shared pin routes by coordinates; everything else routes by
 * "<property>, <landmark>, Mount Abu", which Maps resolves well enough here.
 */
const stopQuery = (o: OrderView) =>
  o.lat != null && o.lng != null
    ? `${o.lat},${o.lng}`
    : [o.propertyName, o.roomOrLandmark, "Mount Abu, Rajasthan"].filter(Boolean).join(", ");

export function runUrl(kitchen: string, stops: OrderView[]) {
  if (stops.length === 0) return null;
  const points = stops.map(stopQuery);
  const destination = points[points.length - 1];
  const waypoints = points.slice(0, -1);
  const params = new URLSearchParams({
    api: "1",
    origin: kitchen,
    destination,
    travelmode: "two-wheeler",
  });
  if (waypoints.length) params.set("waypoints", waypoints.join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function RunMap({ kitchen, stops }: { kitchen: string; stops: OrderView[] }) {
  const url = runUrl(kitchen, stops);
  if (!url) return null;
  const pinned = stops.filter((s) => s.lat != null && s.lng != null).length;

  return (
    <div className="rounded-2xl bg-ink p-3 text-reversed">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="font-display text-[20px] uppercase leading-none">
            {stops.length} stop{stops.length === 1 ? "" : "s"} on this run
          </p>
          <p className="mt-1 text-[13px] opacity-70">
            {pinned} with an exact pin{pinned < stops.length ? `, ${stops.length - pinned} by address` : ""}
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
              #{o.number} · {[o.propertyName, o.roomOrLandmark].filter(Boolean).join(", ") || o.stayType}
            </span>
            {o.lat != null && o.lng != null && <span className="opacity-60">pinned</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
