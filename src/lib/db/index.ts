import postgres from "postgres";

// One shared connection pool per server process. Server-only: never import from client components.
declare global {
  var __abSql: ReturnType<typeof postgres> | undefined;
}

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return postgres(url, { max: 10, idle_timeout: 30, prepare: true });
}

export const sql = globalThis.__abSql ?? create();
if (process.env.NODE_ENV !== "production") globalThis.__abSql = sql;
