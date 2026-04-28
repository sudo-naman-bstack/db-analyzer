import { describe, expect, it } from "vitest";
import fixture from "../fixtures/jira-search.json";
import { parseIssue } from "@/lib/jira/parse";

describe("parseIssue", () => {
  it("normalizes a TM-21858-shaped issue", () => {
    const issue = (fixture as any).issues[0];
    const parsed = parseIssue(issue);
    expect(parsed.key).toBe("TM-21858");
    expect(parsed.summary).toContain("[DB][HBF]");
    expect(parsed.status).toBe("New Item");
    expect(parsed.statusCategory).toBe("new");
    expect(parsed.assignee).toBe("Naman Chaturvedi");
    expect(parsed.promisedEta).toBe("2026-04-30");
    expect(parsed.customerExpectedEta).toBe("Current Quarter");
    expect(parsed.baselineArr).toBe("265021.64");
    expect(parsed.dbCategory).toBe("Adhoc Feature Request");
    expect(parsed.dbProduct).toBe("Test Management");
    expect(parsed.customerStage).toBe("Renewals");
  });

  it("handles null custom fields", () => {
    const issue = (fixture as any).issues[1];
    const parsed = parseIssue(issue);
    expect(parsed.promisedEta).toBeNull();
    expect(parsed.dbCategory).toBeNull();
    expect(parsed.assignee).toBeNull();
  });
});
