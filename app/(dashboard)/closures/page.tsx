import { getDoneTickets } from "@/lib/db/queries";
import { ClosureHistogram } from "@/components/closure-histogram";
import { SectionHeader } from "@/components/section-header";
import { fmtDate, daysBetween } from "@/lib/format";
import { TrendingUp } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const BUCKETS: Array<{ label: string; max: number }> = [
  { label: "0–7d", max: 7 },
  { label: "8–14d", max: 14 },
  { label: "15–30d", max: 30 },
  { label: "31–60d", max: 60 },
  { label: "61–120d", max: 120 },
  { label: "120d+", max: Infinity },
];

export default async function ClosuresPage({
  searchParams,
}: {
  searchParams: Promise<{ since?: string }>;
}) {
  const params = await searchParams;
  const since = Number(params.since ?? 90);
  const tickets = await getDoneTickets(since);

  const durations = tickets
    .filter((t) => t.doneAt && t.created)
    .map((t) => daysBetween(t.created, t.doneAt as Date));

  const histogram = BUCKETS.map((b, idx) => ({
    bucket: b.label,
    count: durations.filter((d) => {
      const prevMax = idx === 0 ? -1 : BUCKETS[idx - 1].max;
      return d > prevMax && d <= b.max;
    }).length,
  }));

  const sorted = [...durations].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
  const p90 = sorted.length ? sorted[Math.floor(sorted.length * 0.9)] : null;
  const mean = sorted.length ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length) : null;

  return (
    <div className="space-y-6">
      {/* Header + time-range picker */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SectionHeader
          icon={<TrendingUp className="h-4 w-4" />}
          title="Closure metrics"
          description={`${tickets.length} tickets closed in the last ${since} days`}
        />
        <div className="flex gap-1.5">
          {[30, 90, 365].map((d) => (
            <Link
              key={d}
              href={`?since=${d}`}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                since === d
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {d}d
            </Link>
          ))}
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Median", value: median != null ? `${median}d` : "—" },
          { label: "P90", value: p90 != null ? `${p90}d` : "—" },
          { label: "Mean", value: mean != null ? `${mean}d` : "—" },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-1.5 text-3xl font-bold tabular-nums tracking-tight text-slate-900">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Histogram */}
      <ClosureHistogram data={histogram} />

      {/* Closure table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Key</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Created</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Done</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Days</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {tickets.map((t, i) => {
              const days = daysBetween(t.created, t.doneAt as Date);
              const daysColor =
                days > 60
                  ? "text-red-700 font-semibold"
                  : days > 30
                    ? "text-amber-700 font-medium"
                    : "text-emerald-700 font-medium";
              return (
                <tr
                  key={t.key}
                  className={`transition-colors hover:bg-blue-50/40 ${i % 2 === 1 ? "bg-slate-50/40" : "bg-white"}`}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/ticket/${t.key}`}
                      className="font-mono text-xs font-medium text-blue-600 hover:underline"
                    >
                      {t.key}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{t.customer ?? "Unknown"}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-500">{fmtDate(t.created)}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-500">{fmtDate(t.doneAt as Date)}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${daysColor}`}>{days}d</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
