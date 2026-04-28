import type { ParsedIssue } from "./parse";

export interface StatusTransition {
  issueKey: string;
  fromStatus: string | null;
  toStatus: string;
  changedAt: string;
  author: string | null;
}

export function extractStatusTransitions(
  issueKey: string,
  histories: ParsedIssue["rawChangelog"],
): StatusTransition[] {
  const out: StatusTransition[] = [];
  for (const h of histories) {
    for (const item of h.items) {
      if (item.field !== "status" || !item.toString) continue;
      out.push({
        issueKey,
        fromStatus: item.fromString,
        toStatus: item.toString,
        changedAt: h.created,
        author: h.author,
      });
    }
  }
  return out;
}
