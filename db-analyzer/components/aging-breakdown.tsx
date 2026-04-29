import Link from "next/link";

const COLORS: Record<string, string> = {
  "0-7d": "bg-emerald-400",
  "8-14d": "bg-emerald-300",
  "15-30d": "bg-amber-300",
  "31-60d": "bg-amber-500",
  "60d+": "bg-red-500",
};

export function AgingBreakdown({ buckets }: { buckets: Record<string, number> }) {
  const total = Object.values(buckets).reduce((a, b) => a + b, 0);
  if (total === 0) {
    return <p className="text-sm text-slate-500">No open tickets — clean slate.</p>;
  }
  return (
    <div className="space-y-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        {Object.entries(buckets).map(([label, n]) =>
          n > 0 ? (
            <div
              key={label}
              className={`${COLORS[label]} transition-all`}
              style={{ width: `${(n / total) * 100}%` }}
              title={`${label}: ${n}`}
            />
          ) : null,
        )}
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(buckets).map(([label, n]) => (
          <Link
            key={label}
            href="/tickets?filter=open"
            className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900"
          >
            <span className={`h-2.5 w-2.5 rounded-sm ${COLORS[label]}`} />
            <span className="font-medium">{label}</span>
            <span className="tabular-nums text-slate-500">({n})</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
