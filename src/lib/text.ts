// Pure helpers, no imports: used by the menu query and testable on their own.

const SMALL = new Set(["a", "al", "an", "and", "as", "at", "but", "by", "for", "in", "'n'", "n", "of", "on", "or", "the", "to", "with"]);
/** Words that are always written one way, whatever the admin typed. */
const FIXED: Record<string, string> = { bbq: "BBQ", kfc: "KFC" };

const cap = (w: string) => w.replace(/(^|[&(\-/"‘“])([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());

/**
 * "PESTO AND SUNDRIED TOMATO", "peri peri fries" and "L&T classic" all come
 * out as Title Case: "Pesto and Sundried Tomato", "Peri Peri Fries",
 * "L&T Classic". Whatever the casing typed in /admin, the guest sees this.
 */
export function titleCase(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(" ")
    .map((w, i) => {
      if (FIXED[w]) return FIXED[w];
      if (i > 0 && SMALL.has(w)) return w;
      return cap(w);
    })
    .join(" ");
}

/**
 * Descriptions are sentences, so Title Case would read oddly ("Cubes Of
 * Cottage Cheese Mixed In…"). They are normalised to sentence case instead:
 * first letter of each sentence capital, the rest lower.
 */
export function sentenceCase(input: string | null | undefined): string {
  if (!input) return "";
  const s = input.trim().replace(/\s+/g, " ").toLowerCase();
  return s
    .replace(/(^|[.!?]\s+)([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase())
    .replace(/\b(bbq|kfc)\b/g, (m) => FIXED[m]);
}
