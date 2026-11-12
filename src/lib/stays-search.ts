/**
 * The words worth searching for in a typed hotel name. "Hotel", "the",
 * "Mount Abu" and the like are in half the names, so they would match
 * everything; dropped unless they are all that was typed.
 */
const NOISE = new Set(["hotel", "hotels", "the", "resort", "resorts", "mount", "mt", "abu", "and", "&", "inn", "stay", "homestay", "villa"]);

export function searchWords(q: string): string[] {
  const all = q
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9& ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  const useful = all.filter((w) => !NOISE.has(w));
  return (useful.length ? useful : all).slice(0, 4);
}

/**
 * Whether a typed name is worth remembering as a new place for later
 * guests. Keeps out room numbers, phone numbers and one-letter junk; it is
 * shown to other people, so when in doubt, don't.
 */
export function rememberable(name: string): boolean {
  const n = name.trim();
  if (n.length < 3 || n.length > 80) return false;
  if (!/[a-z]{3}/i.test(n)) return false; // needs a real word
  if (/\d{6,}/.test(n.replace(/\s/g, ""))) return false; // phone or PIN-like
  if (/^(room|flat|house|h\.?no|plot)\b/i.test(n)) return false;
  return true;
}
