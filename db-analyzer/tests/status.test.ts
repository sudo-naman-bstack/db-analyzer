import { describe, expect, it } from "vitest";
import { deriveDoneAt } from "@/lib/status";

const cat = (status: string) => (status === "Done" ? "done" : status === "In Progress" ? "indeterminate" : "new");

describe("deriveDoneAt", () => {
  it("returns null when never done", () => {
    expect(
      deriveDoneAt(
        [
          { toStatus: "In Progress", changedAt: "2026-01-01T00:00:00Z" },
          { toStatus: "Open", changedAt: "2026-01-02T00:00:00Z" },
        ],
        cat,
      ),
    ).toBeNull();
  });

  it("returns the latest entry into a done category", () => {
    expect(
      deriveDoneAt(
        [
          { toStatus: "Done", changedAt: "2026-01-01T00:00:00Z" },
          { toStatus: "Reopened", changedAt: "2026-01-05T00:00:00Z" },
          { toStatus: "Done", changedAt: "2026-01-10T00:00:00Z" },
        ],
        cat,
      ),
    ).toBe("2026-01-10T00:00:00Z");
  });
});
