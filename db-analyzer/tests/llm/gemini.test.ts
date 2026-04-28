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

  it("falls through on rate limit", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test");
    const m = mockGenerate([
      () => {
        throw Object.assign(new Error("429"), { status: 429 });
      },
      () => ({ text: '{"customer":"ACME"}' }),
    ]);
    const result = await extractCustomerWithLLM(
      { title: "x", description: "x" },
      { clientFactory: m.factory },
    );
    expect(result).toEqual({ customer: "ACME", modelUsed: MODEL_CASCADE[1] });
    expect(m.calls).toEqual([MODEL_CASCADE[0], MODEL_CASCADE[1]]);
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
