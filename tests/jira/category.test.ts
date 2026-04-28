import { describe, expect, it } from "vitest";
import { buildCategoryMap, makeCategoryOf } from "@/lib/jira/category";

describe("buildCategoryMap", () => {
  it("maps each status to its category", () => {
    const m = buildCategoryMap([
      { status: "Done", statusCategory: "done" },
      { status: "In Progress", statusCategory: "indeterminate" },
    ]);
    expect(m).toEqual({ Done: "done", "In Progress": "indeterminate" });
  });
});

describe("makeCategoryOf", () => {
  it("returns mapped category", () => {
    const fn = makeCategoryOf({ Done: "done" });
    expect(fn("Done")).toBe("done");
  });

  it("falls back to indeterminate for unknown", () => {
    const fn = makeCategoryOf({});
    expect(fn("Mystery")).toBe("indeterminate");
  });
});
