export interface StatusTransitionLite {
  toStatus: string;
  changedAt: string;
}

export function deriveDoneAt(
  transitions: StatusTransitionLite[],
  categoryOf: (status: string) => string,
): string | null {
  let latest: string | null = null;
  for (const t of transitions) {
    if (categoryOf(t.toStatus) === "done") {
      if (!latest || t.changedAt > latest) latest = t.changedAt;
    }
  }
  return latest;
}
