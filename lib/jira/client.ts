import { ISSUE_FIELDS_TO_REQUEST } from "./fields";
import { parseIssue, type ParsedIssue } from "./parse";

const JQL_TEMPLATE = (reporter: string, project: string) =>
  `reporter = ${reporter} AND project = "${project}" ORDER BY status ASC, created DESC`;

function authHeader(): string {
  const email = process.env.JIRA_EMAIL ?? "";
  const token = process.env.JIRA_API_TOKEN ?? "";
  return "Basic " + Buffer.from(`${email}:${token}`).toString("base64");
}

async function fetchWithRetry(url: URL, init: RequestInit, tries = 3): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status >= 500) {
        lastErr = new Error(`Jira ${res.status}`);
      } else {
        return res;
      }
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
  }
  throw lastErr instanceof Error ? lastErr : new Error("Jira fetch failed");
}

interface SearchResponse {
  issues: any[];
  isLast?: boolean;
  nextPageToken?: string | null;
}

export async function fetchAllDealblockerIssues(): Promise<ParsedIssue[]> {
  const base = process.env.JIRA_BASE_URL;
  const reporter = process.env.JIRA_REPORTER_ACCOUNT_ID;
  const project = process.env.JIRA_PROJECT_KEY;
  if (!base || !reporter || !project) {
    throw new Error("Jira env vars missing");
  }

  const jql = JQL_TEMPLATE(reporter, project);
  const all: ParsedIssue[] = [];
  let nextPageToken: string | null | undefined = undefined;

  do {
    const url = new URL("/rest/api/3/search/jql", base);
    url.searchParams.set("jql", jql);
    url.searchParams.set("fields", ISSUE_FIELDS_TO_REQUEST.join(","));
    url.searchParams.set("expand", "changelog");
    url.searchParams.set("maxResults", "100");
    if (nextPageToken) url.searchParams.set("nextPageToken", nextPageToken);

    const res = await fetchWithRetry(url, {
      headers: {
        Authorization: authHeader(),
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(`Jira ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as SearchResponse;
    for (const raw of json.issues) all.push(parseIssue(raw));
    nextPageToken = json.isLast ? null : json.nextPageToken;
  } while (nextPageToken);

  return all;
}
