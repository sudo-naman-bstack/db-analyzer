import { afterEach, describe, expect, it, vi } from "vitest";
import { extractCustomerWithLLM, MODEL_CASCADE } from "@/lib/llm/gemini";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function mockGenerate(impls: Array<() => any>) {
  const calls: string[] = [];
  let i = 0;
  return {
    calls,
    factory: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: vi.fn().mockImplementation(({ model }: { model: string }) => {
          calls.push(model);
          const impl = impls[i++];
          return impl();
        }),
      },
    })),
  };
}

describe("extractCustomerWithLLM", () => {
  it("returns the customer from the primary model on success", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test");
    const m = mockGenerate([() => ({ text: '{"customer":"HBF"}' })]);
    const result = await extractCustomerWithLLM(
      { title: "[DB][HBF]X", description: "x" },
      { clientFactory: m.factory },
    );
    expect(result).toEqual({ customer: "HBF", modelUsed: MODEL_CASCADE[0] });
    expect(m.calls).toEqual([MODEL_CASCADE[0]]);
  });

  it("retries the same model on 429 before cascading", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test");
    const rateLimit = () => {
      throw Object.assign(new Error("429"), { status: 429 });
    };
    const m = mockGenerate([
      rateLimit, // first call: 429
      () => ({ text: '{"customer":"ACME"}' }), // retry on same model: success
    ]);
    const result = await extractCustomerWithLLM(
      { title: "x", description: "x" },
      { clientFactory: m.factory, backoffMs: 1, maxRetries: 2 },
    );
    expect(result).toEqual({ customer: "ACME", modelUsed: MODEL_CASCADE[0] });
    // Same model called twice — retry, not cascade
    expect(m.calls).toEqual([MODEL_CASCADE[0], MODEL_CASCADE[0]]);
  });

  it("cascades to next model after exhausting 429 retries", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test");
    const rateLimit = () => {
      throw Object.assign(new Error("429"), { status: 429 });
    };
    const m = mockGenerate([
      rateLimit, // model 0: attempt 1
      rateLimit, // model 0: retry 1
      rateLimit, // model 0: retry 2
      () => ({ text: '{"customer":"ACME"}' }), // model 1: success
    ]);
    const result = await extractCustomerWithLLM(
      { title: "x", description: "x" },
      { clientFactory: m.factory, backoffMs: 1, maxRetries: 2 },
    );
    expect(result).toEqual({ customer: "ACME", modelUsed: MODEL_CASCADE[1] });
    expect(m.calls).toEqual([
      MODEL_CASCADE[0],
      MODEL_CASCADE[0],
      MODEL_CASCADE[0],
      MODEL_CASCADE[1],
    ]);
  });

  it("falls through on parse failure", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test");
    const m = mockGenerate([
      () => ({ text: "not json" }),
      () => ({ text: '{"customer":"OK"}' }),
    ]);
    const result = await extractCustomerWithLLM(
      { title: "x", description: "x" },
      { clientFactory: m.factory },
    );
    expect(result?.customer).toBe("OK");
  });

  it("returns null when all models fail", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test");
    const m = mockGenerate(MODEL_CASCADE.map(() => () => ({ text: "bad" })));
    const result = await extractCustomerWithLLM(
      { title: "x", description: "x" },
      { clientFactory: m.factory },
    );
    expect(result).toBeNull();
  });
});
