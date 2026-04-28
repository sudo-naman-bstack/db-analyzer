import { getDoneTickets } from "@/lib/db/queries";
import { ClosureHistogram } from "@/components/closure-histogram";
import { fmtDate, daysBetween } from "@/lib/format";
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
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-medium">Closure metrics</h2>
        <div className="flex gap-2 text-sm">
          {[30, 90, 365].map((d) => (
            <Link
              key={d}
              href={`?since=${d}`}
              className={`rounded border px-2 py-1 ${since === d ? "bg-muted" : ""}`}
            >
              {d}d
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="rounded-lg border p-3">Median: <b>{median ?? "—"}d</b></div>
        <div className="rounded-lg border p-3">P90: <b>{p90 ?? "—"}d</b></div>
        <div className="rounded-lg border p-3">Mean: <b>{mean ?? "—"}d</b></div>
      </div>

      <ClosureHistogram data={histogram} />

      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-left">
          <tr>
            <th className="px-3 py-2">Key</th>
            <th className="px-3 py-2">Customer</th>
            <th className="px-3 py-2">Created</th>
            <th className="px-3 py-2">Done</th>
            <th className="px-3 py-2">Days</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => (
            <tr key={t.key} className="border-t">
              <td className="px-3 py-2">
                <Link href={`/ticket/${t.key}`} className="hover:underline">{t.key}</Link>
              </td>
              <td className="px-3 py-2">{t.customer ?? "Unknown"}</td>
              <td className="px-3 py-2">{fmtDate(t.created)}</td>
              <td className="px-3 py-2">{fmtDate(t.doneAt as Date)}</td>
              <td className="px-3 py-2">{daysBetween(t.created, t.doneAt as Date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
