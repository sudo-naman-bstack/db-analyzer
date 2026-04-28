import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import fixture from "./fixtures/jira-search.json";
import { runRefresh } from "@/lib/refresh";

const server = setupServer(
  http.get("https://example.atlassian.net/rest/api/3/search/jql", () =>
    HttpResponse.json(fixture),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const baseDeps = () => {
  const upsertTicket = vi.fn().mockResolvedValue(undefined);
  const insertStatusTransitionsIfNew = vi.fn().mockResolvedValue(undefined);
  const upsertExtractionCache = vi.fn().mockResolvedValue(undefined);
  const recordRefreshRun = vi.fn().mockResolvedValue(undefined);
  const getOverride = vi.fn().mockResolvedValue(null);
  const getCachedExtraction = vi.fn().mockResolvedValue(null);
  const llm = vi.fn();
  const categoryOf = (status: string) =>
    status === "Done" ? "done" : status === "In Progress" ? "indeterminate" : "new";
  return {
    upsertTicket,
    insertStatusTransitionsIfNew,
    upsertExtractionCache,
    recordRefreshRun,
    getOverride,
    getCachedExtraction,
    llm,
    categoryOf,
  };
};

describe("runRefresh", () => {
  it("processes fixture issues and records counts", async () => {
    vi.stubEnv("JIRA_BASE_URL", "https://example.atlassian.net");
    vi.stubEnv("JIRA_EMAIL", "x@x");
    vi.stubEnv("JIRA_API_TOKEN", "t");
    vi.stubEnv("JIRA_REPORTER_ACCOUNT_ID", "5efb524c3404690bae83acd1");
    vi.stubEnv("JIRA_PROJECT_KEY", "TM");

    const deps = baseDeps();
    const result = await runRefresh({ trigger: "manual", maxLlmCalls: 10, deps });
    expect(result.ticketCount).toBe(2);
    expect(result.errors).toBe(0);
    expect(deps.upsertTicket).toHaveBeenCalledTimes(2);
    // Both fixture tickets have [DB][CUSTOMER] titles → regex_title, so LLM is never called
    expect(deps.llm).not.toHaveBeenCalled();
  });

  it("falls back to LLM when regex fails and respects budget", async () => {
    vi.stubEnv("JIRA_BASE_URL", "https://example.atlassian.net");
    vi.stubEnv("JIRA_EMAIL", "x@x");
    vi.stubEnv("JIRA_API_TOKEN", "t");
    vi.stubEnv("JIRA_REPORTER_ACCOUNT_ID", "5efb524c3404690bae83acd1");
    vi.stubEnv("JIRA_PROJECT_KEY", "TM");

    server.use(
      http.get("https://example.atlassian.net/rest/api/3/search/jql", () =>
        HttpResponse.json({
          issues: [
            {
              key: "TM-1",
              fields: {
                summary: "no prefix",
                status: { name: "New", statusCategory: { key: "new" } },
                assignee: null,
                created: "2026-01-01T00:00:00Z",
                updated: "2026-01-01T00:00:00Z",
                description: "no opportunity",
              },
              changelog: { histories: [] },
            },
          ],
          isLast: true,
        }),
      ),
    );

    const deps = baseDeps();
    deps.llm.mockResolvedValue({ customer: "Mystery Co", modelUsed: "gemini-3.1-flash-lite" });
    const result = await runRefresh({ trigger: "cron", maxLlmCalls: 10, deps });
    expect(deps.llm).toHaveBeenCalledOnce();
    expect(result.llmCalls).toBe(1);
  });
});
