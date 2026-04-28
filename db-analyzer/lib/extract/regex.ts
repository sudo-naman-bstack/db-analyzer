const TITLE_RE = /^\s*\[db\]\[\s*([^\]]+?)\s*\]/i;
const OPPORTUNITY_RE = /Opportunity\s*Info[\s\S]{0,200}?Name:\s*([^\n<]+)/i;

export function extractFromTitle(title: string): string | null {
  const m = title.match(TITLE_RE);
  return m ? m[1].trim() : null;
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
