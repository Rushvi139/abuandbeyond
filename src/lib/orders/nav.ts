/**
 * Where Google Maps should send the rider for one order. One rule, used by
 * the single Navigate button and the whole-round link alike.
 *
 * In order of trust:
 *   1. The guest's own GPS pin, when the phone said it was precise (≤ 150 m).
 *   2. The hotel they picked from our Stay Directory — an exact Google place.
 *   3. A rougher GPS pin (≤ 500 m), still better than a typed name.
 *   4. The typed property and landmark, which Maps has to guess at.
 *
 * Pins from before accuracy was recorded (null) are treated as precise,
 * which is how they were treated when they were taken.
 */
export type NavInput = {
  lat: number | null;
  lng: number | null;
  locationAccuracyM?: number | null;
  stay?: { name: string; placeId: string | null; lat: number | null; lng: number | null } | null;
  propertyName: string | null;
  roomOrLandmark: string | null;
};

export type NavTarget =
  | { kind: "pin"; query: string; label: string }
  | { kind: "place"; query: string; placeId: string; label: string }
  | { kind: "text"; query: string; label: string };

const PRECISE_M = 150;
const ROUGH_M = 500;
const TOWN = "Mount Abu, Rajasthan";

const coords = (lat: number, lng: number) => `${lat},${lng}`;

export function navTarget(o: NavInput): NavTarget {
  const hasPin = o.lat != null && o.lng != null;
  const acc = o.locationAccuracyM ?? null;

  if (hasPin && (acc === null || acc <= PRECISE_M)) return { kind: "pin", query: coords(o.lat!, o.lng!), label: "pinned" };
  if (o.stay?.placeId) return { kind: "place", query: `${o.stay.name}, ${TOWN}`, placeId: o.stay.placeId, label: "hotel" };
  if (o.stay && o.stay.lat != null && o.stay.lng != null) return { kind: "pin", query: coords(o.stay.lat, o.stay.lng), label: "hotel" };
  if (hasPin && acc !== null && acc <= ROUGH_M) return { kind: "pin", query: coords(o.lat!, o.lng!), label: "rough pin" };
  return { kind: "text", query: [o.propertyName, o.roomOrLandmark, TOWN].filter(Boolean).join(", "), label: "" };
}

/** Directions to one order. No origin: Maps starts from where the rider is. */
export function directionsUrl(o: NavInput) {
  const t = navTarget(o);
  const p = new URLSearchParams({ api: "1", travelmode: "two-wheeler", destination: t.query });
  if (t.kind === "place") p.set("destination_place_id", t.placeId);
  return `https://www.google.com/maps/dir/?${p.toString()}`;
}

/**
 * The whole round, stops in the order given, last one the destination.
 * Place ids ride alongside in `waypoint_place_ids`, which Maps matches up by
 * position; a stop without one leaves its slot empty.
 */
export function roundUrl(stops: NavInput[]) {
  if (stops.length === 0) return null;
  const targets = stops.map(navTarget);
  const dest = targets[targets.length - 1];
  const via = targets.slice(0, -1);
  const p = new URLSearchParams({ api: "1", travelmode: "two-wheeler", destination: dest.query });
  if (dest.kind === "place") p.set("destination_place_id", dest.placeId);
  if (via.length) {
    p.set("waypoints", via.map((t) => t.query).join("|"));
    if (via.some((t) => t.kind === "place")) p.set("waypoint_place_ids", via.map((t) => (t.kind === "place" ? t.placeId : "")).join("|"));
  }
  return `https://www.google.com/maps/dir/?${p.toString()}`;
}
