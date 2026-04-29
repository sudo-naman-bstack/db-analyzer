import { describe, expect, it, vi } from "vitest";
import { resolveCustomer } from "@/lib/extract/orchestrator";

const noLLM = vi.fn().mockResolvedValue(null);

describe("resolveCustomer", () => {
  it("uses override first", async () => {
    const r = await resolveCustomer({
      title: "[DB][HBF]X",
      description: "Opportunity Info\nName: HBF - TM",
      override: "Manually Set",
      cache: null,
      llm: noLLM,
    });
    expect(r).toEqual({ customer: "Manually Set", source: "override", modelUsed: null });
    expect(noLLM).not.toHaveBeenCalled();
  });

  it("uses cache when content hash matches", async () => {
    const r = await resolveCustomer({
      title: "x",
      description: "y",
      override: null,
      cache: { customer: "Cached", source: "regex_title", contentHash: "match" },
      llm: noLLM,
      currentHash: "match",
    });
    expect(r).toEqual({ customer: "Cached", source: "regex_title", modelUsed: null });
  });

  it("uses regex_title when title matches", async () => {
    const r = await resolveCustomer({
      title: "[DB][HBF]X",
      description: "no opp info",
      override: null,
      cache: null,
      llm: noLLM,
    });
    expect(r.source).toBe("regex_title");
    expect(r.customer).toBe("HBF");
  });

  it("falls through to regex_desc", async () => {
    const r = await resolveCustomer({
      title: "Bad title without prefix",
      description: "Opportunity Info\nName: ACME Corp - X - Y",
      override: null,
      cache: null,
      llm: noLLM,
    });
    expect(r.source).toBe("regex_desc");
    expect(r.customer).toBe("ACME Corp");
  });

  it("falls through to LLM when both regex fail", async () => {
    const llm = vi.fn().mockResolvedValue({ customer: "FromLLM", modelUsed: "gemini-3.1-flash-lite" });
    const r = await resolveCustomer({
      title: "no prefix",
      description: "no opp info",
      override: null,
      cache: null,
      llm,
    });
    expect(r).toEqual({ customer: "FromLLM", source: "llm", modelUsed: "gemini-3.1-flash-lite" });
    expect(llm).toHaveBeenCalledOnce();
  });

  it("returns unknown when LLM also fails", async () => {
    const llm = vi.fn().mockResolvedValue(null);
    const r = await resolveCustomer({
      title: "no",
      description: "no",
      override: null,
      cache: null,
      llm,
    });
    expect(r).toEqual({ customer: "Unknown", source: "unknown", modelUsed: null });
  });

  it("falls through to extractFromAccountField when Opportunity Info is missing", async () => {
    const r = await resolveCustomer({
      title: "no prefix",
      description: "5. Name of the account - Q2\n6. Plan: TM Pro",
      override: null,
      cache: null,
      llm: noLLM,
    });
    expect(r.source).toBe("regex_desc");
    expect(r.customer).toBe("Q2");
    expect(noLLM).not.toHaveBeenCalled();
  });

  it("respects llm budget exhaustion", async () => {
    const llm = vi.fn();
    const r = await resolveCustomer({
      title: "no",
      description: "no",
      override: null,
      cache: null,
      llm,
      llmBudgetExhausted: true,
    });
    expect(r).toEqual({ customer: "Unknown", source: "unknown", modelUsed: null });
    expect(llm).not.toHaveBeenCalled();
  });

  it("uses cached unknown verdict without re-trying LLM", async () => {
    const llm = vi.fn();
    const r = await resolveCustomer({
      title: "no prefix",
      description: "no opp info",
      override: null,
      cache: { customer: "Unknown", source: "unknown", contentHash: "abc" },
      currentHash: "abc",
      llm,
    });
    expect(r).toEqual({ customer: "Unknown", source: "unknown", modelUsed: null });
    expect(llm).not.toHaveBeenCalled();
  });
});
