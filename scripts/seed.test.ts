import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The seed runs on every deploy (`docker compose run --rm migrate`), so
 * anything it overwrites silently reverts whenever we ship. That is not
 * hypothetical: menu prices edited in /admin went back to the CSV four times
 * in one day before anyone connected it to deploying.
 *
 * Per table, these columns belong to whoever runs the kitchen rather than to
 * the file, because /admin can edit them. A plain `col = excluded.col` on one
 * of them is the bug; it is only allowed behind the SEED_OVERWRITE guard,
 * which is never set on a deploy.
 *
 * Tables absent here — pack_kits, categories — have no editor in /admin, so
 * the CSV is rightly their source of truth.
 */
const OWNER_OWNED: Record<string, string[]> = {
  menu_items: ["name", "category_id", "station_id", "cuisine", "is_veg", "price_paise", "packaging_cost_paise"],
  addons: ["price_paise", "is_veg"],
  ingredients: ["procurement_group", "unit", "rate_paise_per_unit"],
};

const src = readFileSync(join(process.cwd(), "scripts", "seed.ts"), "utf8");

/** The text of one `insert into <table> … ;` statement in the seed. */
function statement(table: string): string {
  // The table name may be followed by a newline rather than a space.
  const start = src.search(new RegExp(`insert into ${table}\\s`));
  expect(start, `no "insert into ${table}" in the seed`).toBeGreaterThan(-1);
  const end = src.indexOf("`;", start);
  return src.slice(start, end === -1 ? undefined : end);
}

describe("seed", () => {
  for (const [table, cols] of Object.entries(OWNER_OWNED)) {
    describe(table, () => {
      const sql = statement(table);
      it.each(cols)("never overwrites %s unguarded", (col) => {
        // `col = excluded.col`, but not the guarded
        // `col = case when ${OVERWRITE} then excluded.col else …`.
        const unguarded = new RegExp(`\\b${col}\\s*=\\s*excluded\\.${col}\\b`, "g");
        const hits = [...sql.matchAll(unguarded)];
        expect(hits, `${table}.${col} is overwritten from the CSV without the SEED_OVERWRITE guard`).toHaveLength(0);
      });
    });
  }

  it("still offers a deliberate bulk reset", () => {
    expect(src).toContain('process.env.SEED_OVERWRITE === "1"');
  });

  it("is never switched on by the compose file", () => {
    // Mentioning it in a comment is fine and useful; setting it is the bug,
    // because then every deploy pushes the CSV over live prices again.
    const set = readFileSync(join(process.cwd(), "docker-compose.yml"), "utf8")
      .split("\n")
      .filter((l) => !l.trim().startsWith("#"))
      .filter((l) => /SEED_OVERWRITE\s*[:=]/.test(l));
    expect(set, "docker-compose.yml sets SEED_OVERWRITE").toEqual([]);
  });

  it("does not seed on deploy", () => {
    // The migrate service is what a deploy runs. The seed is the only thing
    // that can overwrite the menu, so it must be a separate, deliberate run.
    const compose = readFileSync(join(process.cwd(), "docker-compose.yml"), "utf8");
    const migrate = compose.slice(compose.indexOf("\n  migrate:"), compose.indexOf("\n  seed:"));
    expect(migrate).toContain("db:migrate");
    expect(migrate, "the migrate service runs the seed again").not.toContain("db:seed");
  });
});
