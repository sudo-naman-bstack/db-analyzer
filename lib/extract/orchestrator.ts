import { extractFromTitle, extractFromOpportunity, extractFromAccountField } from "./regex";
import type { ExtractInput, ExtractResult } from "@/lib/llm/gemini";

export type CustomerSource = "override" | "regex_title" | "regex_desc" | "llm" | "unknown";

export interface CacheEntry {
  customer: string;
  source: Exclude<CustomerSource, "override">;
  contentHash: string;
}

export interface ResolveInput {
  title: string;
  description: string;
  override: string | null;
  cache: CacheEntry | null;
  currentHash?: string;
  llm: (input: ExtractInput) => Promise<ExtractResult | null>;
  llmBudgetExhausted?: boolean;
}

export interface ResolveOutput {
  customer: string;
  source: CustomerSource;
  modelUsed: string | null;
}

export async function resolveCustomer(input: ResolveInput): Promise<ResolveOutput> {
  if (input.override) {
    return { customer: input.override, source: "override", modelUsed: null };
  }
  if (input.cache && input.currentHash && input.cache.contentHash === input.currentHash) {
    return { customer: input.cache.customer, source: input.cache.source, modelUsed: null };
  }
  const fromTitle = extractFromTitle(input.title);
  if (fromTitle) {
    return { customer: fromTitle, source: "regex_title", modelUsed: null };
  }
  const fromDesc = extractFromOpportunity(input.description);
  if (fromDesc) {
    return { customer: fromDesc, source: "regex_desc", modelUsed: null };
  }
  const fromAccount = extractFromAccountField(input.description);
  if (fromAccount) {
    return { customer: fromAccount, source: "regex_desc", modelUsed: null };
  }
  if (input.llmBudgetExhausted) {
    return { customer: "Unknown", source: "unknown", modelUsed: null };
  }
  const llmResult = await input.llm({ title: input.title, description: input.description });
  if (llmResult) {
    return { customer: llmResult.customer, source: "llm", modelUsed: llmResult.modelUsed };
  }
  return { customer: "Unknown", source: "unknown", modelUsed: null };
}

export function contentHash(title: string, description: string): string {
  // tiny stable hash; no need for cryptographic strength
  let h = 5381;
  const s = `${title} ${description}`;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}
