import { describe, expect, it } from "vitest";
import { extractStatusTransitions } from "@/lib/jira/changelog";

describe("extractStatusTransitions", () => {
  it("returns one transition per status item", () => {
    const transitions = extractStatusTransitions("TM-1", [
      {
        created: "2026-01-01T00:00:00.000Z",
        author: "Alice",
        items: [
          { field: "status", fromString: "Open", toString: "In Progress" },
          { field: "summary", fromString: "old", toString: "new" },
        ],
      },
      {
        created: "2026-01-05T00:00:00.000Z",
        author: "Bob",
        items: [{ field: "status", fromString: "In Progress", toString: "Done" }],
      },
    ]);

    expect(transitions).toHaveLength(2);
    expect(transitions[0]).toMatchObject({
      issueKey: "TM-1",
      fromStatus: "Open",
      toStatus: "In Progress",
      author: "Alice",
    });
    expect(transitions[1].toStatus).toBe("Done");
  });

  it("ignores non-status items", () => {
    const transitions = extractStatusTransitions("TM-2", [
      {
        created: "2026-01-01T00:00:00.000Z",
        author: null,
        items: [{ field: "assignee", fromString: "x", toString: "y" }],
      },
    ]);
    expect(transitions).toHaveLength(0);
  });
});
