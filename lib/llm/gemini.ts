import { GoogleGenAI } from "@google/genai";

export const MODEL_CASCADE = [
  "gemini-3.1-flash-lite",
  "gemini-3-flash",
  "gemini-2.5-flash-lite",
  "gemma-3-27b-it",
] as const;

export type ModelName = (typeof MODEL_CASCADE)[number];

const SYSTEM_PROMPT = [
  "You are an extractor. Given a Jira ticket title and description, identify the",
  "customer/account name (the company or organization the ticket is about).",
  'Return only JSON of the shape {"customer":"<name>"}. If unsure, return',
  '{"customer":""}. Do not include any other text.',
].join(" ");

export interface ExtractInput {
  title: string;
  description: string;
}

export interface ExtractResult {
  customer: string;
  modelUsed: ModelName;
}

interface GenAIClientLike {
  models: {
    generateContent: (args: {
      model: string;
      contents: any;
      config?: any;
    }) => Promise<{ text?: string }>;
  };
}

export interface ExtractOptions {
  clientFactory?: () => GenAIClientLike;
  /** Override the per-model 429 backoff. Defaults to 5000ms. */
  backoffMs?: number;
  /** Override the per-model 429 retry count. Defaults to 2. */
  maxRetries?: number;
}

function defaultFactory(): GenAIClientLike {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" }) as unknown as GenAIClientLike;
}

function statusOf(err: unknown): number | undefined {
  return (err as { status?: number })?.status;
}

function isRateLimit(err: unknown): boolean {
  return statusOf(err) === 429;
}

function isCascadable(err: unknown): boolean {
  // Cascade to next model on rate limit, server errors, or unknown network errors.
  // Don't cascade on 4xx (other than 429) — those are config/auth issues that
  // would fail on every model anyway.
  const s = statusOf(err);
  if (s === undefined) return true; // network/unknown — try next
  if (s === 429) return true;
  if (s >= 500) return true;
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseCustomer(text: string | undefined): string | null {
  if (!text) return null;
  // Strip markdown fences if present
  const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as { customer?: string };
    if (typeof parsed.customer === "string" && parsed.customer.trim().length > 0) {
      return parsed.customer.trim();
    }
    return null;
  } catch {
    return null;
  }
}

export async function extractCustomerWithLLM(
  input: ExtractInput,
  opts: ExtractOptions = {},
): Promise<ExtractResult | null> {
  const factory = opts.clientFactory ?? defaultFactory;
  const client = factory();
  const backoffMs = opts.backoffMs ?? 5000;
  const maxRetries = opts.maxRetries ?? 2;
  const userText = `Title: ${input.title}\n\nDescription:\n${input.description.slice(0, 6000)}`;

  for (const model of MODEL_CASCADE) {
    let attempt = 0;
    while (true) {
      try {
        const res = await client.models.generateContent({
          model,
          contents: [
            { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
            { role: "user", parts: [{ text: userText }] },
          ],
          config: { temperature: 0 },
        });
        const customer = parseCustomer(res.text);
        if (customer) return { customer, modelUsed: model };
        // Parsed but no customer — try next model, don't retry same one.
        break;
      } catch (err) {
        if (isRateLimit(err) && attempt < maxRetries) {
          // Rate-limited: sleep and retry the SAME model before cascading.
          attempt += 1;
          await sleep(backoffMs * attempt);
          continue;
        }
        if (!isCascadable(err)) throw err;
        break; // cascade to next model
      }
    }
  }
  return null;
}
