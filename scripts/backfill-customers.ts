#!/usr/bin/env tsx
import { config } from "dotenv";
config({ path: ".env.local" });
import { Pool } from "pg";
import {
  resolveCustomer,
  contentHash,
} from "../lib/extract/orchestrator";
import { extractCustomerWithLLM } from "../lib/llm/gemini";

function findConnectionString(): string | null {
  const direct =
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL_UNPOOLED;
  if (direct) return direct;
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

async function main() {
  const connectionString = findConnectionString();
  if (!connectionString) {
    console.error("ERROR: No Postgres connection string in env.");
    process.exit(1);
  }
  if (!process.env.GEMINI_API_KEY) {
    console.error("ERROR: GEMINI_API_KEY not set in env.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const limit = Number(process.env.LIMIT ?? "1000");

  const { rows } = await pool.query<{
    key: string;
    summary: string;
    description_raw: string | null;
  }>(
    `SELECT key, summary, description_raw
       FROM tickets
      WHERE customer_source = 'unknown'
      ORDER BY updated DESC
      LIMIT $1`,
    [limit],
  );

  console.log(`Found ${rows.length} unknown tickets to process.`);
  let regexHits = 0;
  let llmHits = 0;
  let stillUnknown = 0;
  let llmCalls = 0;

  for (let i = 0; i < rows.length; i++) {
    const t = rows[i];
    const description = t.description_raw ?? "";
    const result = await resolveCustomer({
      title: t.summary,
      description,
      override: null,
      cache: null,
      llm: async (input) => {
        llmCalls += 1;
        return extractCustomerWithLLM(input);
      },
    });

    const tag = `[${i + 1}/${rows.length}] ${t.key}`;
    if (result.source === "unknown") {
      stillUnknown += 1;
      console.log(`${tag}  -> still Unknown`);
      continue;
    }
    if (result.source === "llm") llmHits += 1;
    else regexHits += 1;
    console.log(`${tag}  -> ${result.customer} (${result.source})`);

    await pool.query(
      `UPDATE tickets SET customer = $1, customer_source = $2 WHERE key = $3`,
      [result.customer, result.source, t.key],
    );
    if (result.source !== "override") {
      await pool.query(
        `INSERT INTO extraction_cache (issue_key, content_hash, customer, source, model_used, extracted_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (issue_key) DO UPDATE
           SET content_hash = EXCLUDED.content_hash,
               customer = EXCLUDED.customer,
               source = EXCLUDED.source,
               model_used = EXCLUDED.model_used,
               extracted_at = EXCLUDED.extracted_at`,
        [
          t.key,
          contentHash(t.summary, description),
          result.customer,
          result.source,
          result.modelUsed,
        ],
      );
    }

  }

  console.log("");
  console.log(`Done. regex=${regexHits} llm=${llmHits} stillUnknown=${stillUnknown}`);
  console.log(`Total LLM calls made: ${llmCalls}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
