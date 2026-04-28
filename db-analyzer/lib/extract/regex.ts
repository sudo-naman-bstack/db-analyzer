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
