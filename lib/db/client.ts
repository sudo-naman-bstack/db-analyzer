import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let cached: NodePgDatabase<typeof schema> | null = null;

function findConnectionString(): string | null {
  // Direct (unprefixed) env names — used in local dev and most setups.
  const direct =
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL_UNPOOLED;
  if (direct) return direct;

  // Vercel's Neon marketplace integration prefixes vars with the database
  // name (e.g., db_analyzer_POSTGRES_URL). Match any prefixed variant.
  // Prefer pooled URLs over non-pooled.
  const entries = Object.entries(process.env);
  const pooled = entries.find(
    ([k, v]) => v && (k.endsWith("_POSTGRES_URL") || k.endsWith("_DATABASE_URL")),
  );
  if (pooled?.[1]) return pooled[1];

  const unpooled = entries.find(
    ([k, v]) =>
      v &&
      (k.endsWith("_POSTGRES_URL_NON_POOLING") || k.endsWith("_DATABASE_URL_UNPOOLED")),
  );
  return unpooled?.[1] ?? null;
}

function init(): NodePgDatabase<typeof schema> {
  const connectionString = findConnectionString();
  if (!connectionString) {
    throw new Error(
      "No Postgres connection string. Set POSTGRES_URL or DATABASE_URL in your environment.",
    );
  }
  const pool = new Pool({ connectionString });
  cached = drizzle(pool, { schema });
  return cached;
}

export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    const real = cached ?? init();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
