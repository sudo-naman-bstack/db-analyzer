import { JIRA_FIELDS } from "./fields";

export interface ParsedIssue {
  key: string;
  summary: string;
  status: string;
  statusCategory: string;
  assignee: string | null;
  created: string;
  updated: string;
  description: string;
  promisedEta: string | null;
  customerExpectedEta: string | null;
  baselineArr: string | null;
  incrementalAcv: string | null;
  ceName: string | null;
  dbCategory: string | null;
  dbProduct: string | null;
  sfdcLink: string | null;
  customerStage: string | null;
  rawChangelog: Array<{
    created: string;
    author: string | null;
    items: Array<{ field: string; fromString: string | null; toString: string | null }>;
  }>;
}

export function adfToText(node: any): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  let text = "";
  if (typeof node.text === "string") text += node.text;
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      text += adfToText(child);
      if (
        child &&
        (child.type === "paragraph" ||
          child.type === "heading" ||
          child.type === "listItem" ||
          child.type === "blockquote" ||
          child.type === "tableRow")
      ) {
        text += "\n";
      }
    }
  }
  return text;
}

export function descriptionToString(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") return adfToText(raw);
  return "";
}

function readSelectValue(v: unknown): string | null {
  if (v == null) return null;
  if (Array.isArray(v)) {
    const first = v[0] as { value?: string } | undefined;
    return first?.value ?? null;
  }
  if (typeof v === "object" && v !== null && "value" in v) {
    return (v as { value: string }).value ?? null;
  }
  if (typeof v === "string") return v;
  return null;
}

function readNumber(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  return null;
}

export function parseIssue(raw: any): ParsedIssue {
  const f = raw.fields ?? {};
  const histories = raw.changelog?.histories ?? [];
  return {
    key: raw.key,
    summary: f.summary ?? "",
    status: f.status?.name ?? "",
    statusCategory: f.status?.statusCategory?.key ?? "new",
    assignee: f.assignee?.displayName ?? null,
    created: f.created,
    updated: f.updated,
    description: descriptionToString(f.description),
    promisedEta: f[JIRA_FIELDS.promisedEta] ?? null,
    customerExpectedEta: f[JIRA_FIELDS.customerExpectedEta] ?? null,
    baselineArr: readNumber(f[JIRA_FIELDS.baselineArr]),
    incrementalAcv: readNumber(f[JIRA_FIELDS.incrementalAcv]),
    ceName: f[JIRA_FIELDS.ceName] ?? null,
    dbCategory: readSelectValue(f[JIRA_FIELDS.dbCategory]),
    dbProduct: f[JIRA_FIELDS.dbProduct] ?? null,
    sfdcLink: f[JIRA_FIELDS.sfdcLink] ?? null,
    customerStage: readSelectValue(f[JIRA_FIELDS.customerStage]),
    rawChangelog: histories.map((h: any) => ({
      created: h.created,
      author: h.author?.displayName ?? null,
      items: (h.items ?? []).map((it: any) => ({
        field: it.field,
        fromString: it.fromString ?? null,
        toString: it.toString ?? null,
      })),
    })),
  };
}
