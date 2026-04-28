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
}

function defaultFactory(): GenAIClientLike {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" }) as unknown as GenAIClientLike;
}

function isRetryable(_err: unknown): boolean {
  return true; // network/unknown — try next model
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
  const userText = `Title: ${input.title}\n\nDescription:\n${input.description.slice(0, 6000)}`;

  for (const model of MODEL_CASCADE) {
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
    } catch (err) {
      if (!isRetryable(err)) throw err;
    }
  }
  return null;
}
