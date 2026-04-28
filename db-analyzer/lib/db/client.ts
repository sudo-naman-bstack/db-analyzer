import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error("POSTGRES_URL not set");
}

const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });
export { schema };
