import { describe, expect, it } from "vitest";
import { extractFromTitle, extractFromOpportunity, extractFromAccountField } from "@/lib/extract/regex";

describe("extractFromTitle", () => {
  it("pulls the customer code from [DB][CUSTOMER] prefix", () => {
    expect(extractFromTitle("[DB][HBF]Restrict Public Link")).toBe("HBF");
  });

  it("returns null when no prefix", () => {
    expect(extractFromTitle("Random title")).toBeNull();
  });

  it("handles whitespace and lowercase prefix", () => {
    expect(extractFromTitle("  [db][ Acme Corp ] Title")).toBe("Acme Corp");
  });
});

describe("extractFromOpportunity", () => {
  it("reads the first segment of Opportunity Info Name", () => {
    const desc = "Opportunity Info\nName: HBF - TM - Ent. 10 U\nLink: https://x";
    expect(extractFromOpportunity(desc)).toBe("HBF");
  });

  it("supports HTML-encoded variants", () => {
    const desc =
      "<h3>Opportunity Info</h3><p>Name: ACME Corp - Live - 5 U</p><p>Link: https://x</p>";
    expect(extractFromOpportunity(desc)).toBe("ACME Corp");
  });

  it("returns null when missing", () => {
    expect(extractFromOpportunity("nothing here")).toBeNull();
  });
});

describe("extractFromAccountField", () => {
  it("matches 'Name of the account: <X>' with colon", () => {
    expect(
      extractFromAccountField("Name of the account: ACME Corp\nMore text"),
    ).toBe("ACME Corp");
  });

  it("matches 'Name of the group/account:<X>' with no space", () => {
    expect(extractFromAccountField("Name of the group/account:HKJC")).toBe("HKJC");
  });

  it("matches 'Name of the account - <X>' with dash", () => {
    expect(extractFromAccountField("5. Name of the account - Q2\n6.")).toBe("Q2");
  });

  it("returns null when value is N/A", () => {
    expect(extractFromAccountField("Name of the account: NA")).toBeNull();
    expect(extractFromAccountField("Name of the account: N/A")).toBeNull();
  });

  it("returns null when missing", () => {
    expect(extractFromAccountField("nothing here")).toBeNull();
  });
});
