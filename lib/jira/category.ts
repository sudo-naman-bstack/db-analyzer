export function buildCategoryMap(
  issues: Array<{ status: string; statusCategory: string }>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) out[i.status] = i.statusCategory;
  return out;
}

export function makeCategoryOf(map: Record<string, string>) {
  return (status: string): string => map[status] ?? "indeterminate";
}
