#!/usr/bin/env tsx
import "dotenv/config";

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("ERROR: GEMINI_API_KEY not set in env.");
    process.exit(1);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Failed (${res.status}):`, await res.text());
    process.exit(1);
  }
  const json = (await res.json()) as {
    models?: Array<{
      name: string;
      displayName?: string;
      supportedGenerationMethods?: string[];
    }>;
  };

  const generative = (json.models ?? []).filter((m) =>
    m.supportedGenerationMethods?.includes("generateContent"),
  );

  console.log(`Found ${generative.length} models supporting generateContent:\n`);
  for (const m of generative) {
    const id = m.name.replace(/^models\//, "");
    const label = m.displayName ?? "";
    console.log(`  ${id.padEnd(50)} ${label}`);
  }
  console.log("");
  console.log("Use the leftmost identifier in lib/llm/gemini.ts MODEL_CASCADE.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
