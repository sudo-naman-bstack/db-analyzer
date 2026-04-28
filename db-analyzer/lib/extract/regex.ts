const DB_PREFIX_RE = /^\s*\[db\]\[\s*([^\]]+?)\s*\]/i;
const SINGLE_BRACKET_RE = /^\s*\[\s*([^\]]+?)\s*\]/;
const OPPORTUNITY_RE = /Opportunity\s*Info[\s\S]{0,200}?Name:\s*([^\n<]+)/i;

const GENERIC_TAGS = new Set([
  "DB",
  "BUG",
  "FIX",
  "TASK",
  "STORY",
  "FEATURE",
  "REQUEST",
  "TEST",
  "WIP",
  "TODO",
  "HOTFIX",
  "BLOCKER",
  "P0",
  "P1",
  "P2",
  "P3",
  "P4",
  "MUST",
  "SHOULD",
  "NICE",
  "URGENT",
  "DRAFT",
  "TM",
]);

function cleanCustomerName(raw: string): string | null {
  let v = raw.trim();
  // Strip trailing punctuation noise like "Primark."
  v = v.replace(/[.,;:!?]+$/, "").trim();
  if (!v) return null;
  if (GENERIC_TAGS.has(v.toUpperCase())) return null;
  return v;
}

export function extractFromTitle(title: string): string | null {
  // Legacy [DB][CUSTOMER] form
  const dbMatch = title.match(DB_PREFIX_RE);
  if (dbMatch) {
    return cleanCustomerName(dbMatch[1]);
  }
  // Modern [CUSTOMER] form
  const singleMatch = title.match(SINGLE_BRACKET_RE);
  if (singleMatch) {
    return cleanCustomerName(singleMatch[1]);
  }
  return null;
}

export function extractFromOpportunity(description: string): string | null {
  const m = description.match(OPPORTUNITY_RE);
  if (!m) return null;
  const raw = m[1].trim();
  const segment = raw.split(" - ")[0]?.trim();
  return segment ? segment : null;
}

const ACCOUNT_NAME_RE =
  /Name\s+of\s+the\s+(?:group\s*\/\s*)?(?:account|group)(?:\s*\/\s*(?:group|account))?\s*[:\-]\s*([^\n<]+)/i;

export function extractFromAccountField(description: string): string | null {
  const m = description.match(ACCOUNT_NAME_RE);
  if (!m) return null;
  const raw = m[1].trim();
  if (!raw) return null;
  // Reject N/A-style placeholders.
  if (/^N\s*\/?\s*A$/i.test(raw)) return null;
  // Strip trailing parenthetical or punctuation noise.
  const cleaned = raw.replace(/[.;,]+$/, "").trim();
  if (cleaned.length < 2) return null;
  return cleaned.split(" - ")[0]?.trim() || cleaned;
}
