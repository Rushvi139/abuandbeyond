import postgres from "postgres";

// One shared connection pool per server process, created on first use so builds
// and pages that never touch the DB don't need DATABASE_URL. Server-only.
type Sql = ReturnType<typeof postgres>;
declare global {
  var __abSql: Sql | undefined;
}

function create(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return postgres(url, {
    max: 10,
    idle_timeout: 30,
    prepare: true,
    // bigint (money in paise, counts) → JS number. Safe: paise values are far below 2^53.
    types: { bigint: { to: 20, from: [20], serialize: (x: number | bigint | string) => String(x), parse: (x: string) => Number(x) } },
  });
}

export function db(): Sql {
  if (!globalThis.__abSql) globalThis.__abSql = create();
  return globalThis.__abSql;
}
