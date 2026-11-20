/**
 * Which partner's QR a guest came in through. The menu page reads `?src=` and
 * keeps it in a cookie for two days, so it survives the walk from the menu to
 * checkout and a guest who comes back the next evening from the same room.
 */
export const SOURCE_COOKIE = "ab_src";
export const SOURCE_MAX_AGE_S = 2 * 24 * 60 * 60;
export const isSlug = (s: unknown): s is string => typeof s === "string" && /^[a-z0-9-]{1,80}$/.test(s);
