import { describe, expect, it } from "vitest";
import { directionsUrl, navTarget, roundUrl, type NavInput } from "./nav";

const base: NavInput = { lat: null, lng: null, locationAccuracyM: null, stay: null, propertyName: "Hotel Hilltone", roomOrLandmark: "Room 12" };
const hotel = { name: "Hotel Hilltone", placeId: "ChIJ_hilltone", lat: 24.5926, lng: 72.7156 };

describe("navTarget — where the rider is sent", () => {
  it("uses a precise guest pin first", () => {
    expect(navTarget({ ...base, lat: 24.59, lng: 72.71, locationAccuracyM: 20, stay: hotel })).toMatchObject({ kind: "pin", query: "24.59,72.71" });
  });
  it("prefers the picked hotel's Google place over a rough pin", () => {
    expect(navTarget({ ...base, lat: 24.6, lng: 72.7, locationAccuracyM: 1500, stay: hotel })).toMatchObject({ kind: "place", placeId: "ChIJ_hilltone" });
  });
  it("uses a roughish pin when no hotel was picked", () => {
    expect(navTarget({ ...base, lat: 24.6, lng: 72.7, locationAccuracyM: 400 })).toMatchObject({ kind: "pin", label: "rough pin" });
  });
  it("ignores a very rough pin and falls back to the typed address", () => {
    expect(navTarget({ ...base, lat: 24.6, lng: 72.7, locationAccuracyM: 2000 })).toMatchObject({ kind: "text", query: "Hotel Hilltone, Room 12, Mount Abu, Rajasthan" });
  });
  it("treats old pins with no recorded accuracy as precise, as before", () => {
    expect(navTarget({ ...base, lat: 24.59, lng: 72.71 })).toMatchObject({ kind: "pin" });
  });
  it("uses a hand-added hotel's coordinates when it has no place id", () => {
    expect(navTarget({ ...base, stay: { ...hotel, placeId: null } })).toMatchObject({ kind: "pin", query: "24.5926,72.7156", label: "hotel" });
  });
});

describe("Maps links", () => {
  it("opens the exact Google place, with no origin so Maps starts from the rider", () => {
    const u = new URL(directionsUrl({ ...base, stay: hotel }));
    expect(u.searchParams.get("destination_place_id")).toBe("ChIJ_hilltone");
    expect(u.searchParams.get("origin")).toBeNull();
    expect(u.searchParams.get("travelmode")).toBe("two-wheeler");
  });
  it("lines up waypoint place ids by position", () => {
    const u = new URL(roundUrl([{ ...base, stay: hotel }, { ...base, lat: 24.6, lng: 72.7, locationAccuracyM: 10 }, { ...base }])!);
    expect(u.searchParams.get("waypoints")).toBe("Hotel Hilltone, Mount Abu, Rajasthan|24.6,72.7");
    expect(u.searchParams.get("waypoint_place_ids")).toBe("ChIJ_hilltone|");
    expect(u.searchParams.get("destination")).toBe("Hotel Hilltone, Room 12, Mount Abu, Rajasthan");
  });
  it("has nothing to start with no stops", () => {
    expect(roundUrl([])).toBeNull();
  });
});
