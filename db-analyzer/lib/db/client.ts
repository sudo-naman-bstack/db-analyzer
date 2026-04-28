import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let cached: NodePgDatabase<typeof schema> | null = null;

function init(): NodePgDatabase<typeof schema> {
  const connectionString =
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL_UNPOOLED;
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
