import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import fixture from "../fixtures/jira-search.json";
import { fetchAllDealblockerIssues } from "@/lib/jira/client";

const server = setupServer(
  http.get("https://example.atlassian.net/rest/api/3/search/jql", () => {
    return HttpResponse.json(fixture);
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("fetchAllDealblockerIssues", () => {
  it("returns all parsed issues", async () => {
    vi.stubEnv("JIRA_BASE_URL", "https://example.atlassian.net");
    vi.stubEnv("JIRA_EMAIL", "test@example.com");
    vi.stubEnv("JIRA_API_TOKEN", "token");
    vi.stubEnv("JIRA_REPORTER_ACCOUNT_ID", "5efb524c3404690bae83acd1");
    vi.stubEnv("JIRA_PROJECT_KEY", "TM");

    const issues = await fetchAllDealblockerIssues();
    expect(issues).toHaveLength(3);
    expect(issues[0].key).toBe("TM-21858");
    expect(issues[0].rawChangelog.length).toBeGreaterThan(0);
  });
});
