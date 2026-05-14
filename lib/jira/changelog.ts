import type { ParsedIssue } from "./parse";
import { JIRA_FIELDS } from "./fields";

export interface StatusTransition {
  issueKey: string;
  fromStatus: string | null;
  toStatus: string;
  changedAt: string;
  author: string | null;
}

export interface EtaChange {
  issueKey: string;
  changedAt: string;
  fromEta: string | null;
  toEta: string | null;
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

export function extractEtaChanges(
  issueKey: string,
  histories: ParsedIssue["rawChangelog"],
): EtaChange[] {
  const out: EtaChange[] = [];
  for (const h of histories) {
    for (const item of h.items) {
      const isEta =
        item.fieldId === JIRA_FIELDS.promisedEta ||
        item.field.toLowerCase().includes("promised eta");
      if (!isEta) continue;
      out.push({
        issueKey,
        changedAt: h.created,
        fromEta: item.fromString,
        toEta: item.toString,
        author: h.author,
      });
    }
  }
  return out;
}
