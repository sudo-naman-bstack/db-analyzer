import { getEtaTrackingData, getEtaChangeSummary } from "@/lib/db/eta-queries";
import { fmtDate, fmtCurrency } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { SectionHeader } from "@/components/section-header";
import { CalendarClock, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function EtaTrackingPage() {
  const [rows, summary] = await Promise.all([getEtaTrackingData(), getEtaChangeSummary()]);

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={<CalendarClock className="h-4 w-4" />}
        title="ETA tracking"
        description="How often and how much Promised ETAs are changing across open dealblockers"
      />

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <SummaryCard label="Changes (7d)" value={summary.totalChanges7d} />
        <SummaryCard label="Changes (30d)" value={summary.totalChanges30d} />
        <SummaryCard label="Changes (60d)" value={summary.totalChanges60d} />
        <SummaryCard label="Tickets changed (7d)" value={summary.ticketsChanged7d} />
        <SummaryCard label="Tickets changed (30d)" value={summary.ticketsChanged30d} />
        <SummaryCard
          label="Avg changes/ticket"
          value={summary.avgChangesPerTicket != null ? summary.avgChangesPerTicket.toFixed(1) : "—"}
        />
        <SummaryCard
          label="Net shift (30d)"
          value={
            summary.netShift30d != null
              ? `${summary.netShift30d > 0 ? "+" : ""}${summary.netShift30d}d`
              : "—"
          }
          color={
            summary.netShift30d != null
              ? summary.netShift30d > 0
                ? "text-red-600"
                : summary.netShift30d < 0
                  ? "text-green-600"
                  : undefined
              : undefined
          }
          hint={
            summary.netShift30d != null && summary.netShift30d > 0
              ? "ETAs pushing out"
              : summary.netShift30d != null && summary.netShift30d < 0
                ? "ETAs pulling in"
                : undefined
          }
        />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No ETA changes recorded yet. Run a refresh to capture ETA change history from Jira changelogs.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Key</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Summary</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Current ETA</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <span className="inline-flex items-center gap-1">7d</span>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">30d</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">60d</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Total</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Avg shift</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Net shift</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">ARR</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Last changed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((t, i) => {
                  const changeIntensity =
                    t.totalChanges >= 5
                      ? "text-red-700 font-semibold"
                      : t.totalChanges >= 3
                        ? "text-amber-700 font-medium"
                        : "text-slate-600";
                  const netColor =
                    t.netShiftDays != null && t.netShiftDays > 0
                      ? "text-red-600"
                      : t.netShiftDays != null && t.netShiftDays < 0
                        ? "text-green-600"
                        : "text-slate-600";

                  return (
                    <tr
                      key={t.key}
                      className={`transition-colors hover:bg-blue-50/40 ${i % 2 === 1 ? "bg-slate-50/40" : "bg-white"}`}
                    >
                      <td className="px-4 py-3">
                        <Link href={`/ticket/${t.key}`} className="font-mono text-xs font-medium text-blue-600 hover:underline">
                          {t.key}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{t.customer ?? "Unknown"}</td>
                      <td className="max-w-xs px-4 py-3">
                        <span className="line-clamp-2 text-slate-700">{t.summary}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">{fmtDate(t.currentEta)}</td>
                      <td className={`px-4 py-3 text-right tabular-nums ${t.changes7d > 0 ? "text-red-600 font-medium" : "text-slate-400"}`}>
                        {t.changes7d || "—"}
                      </td>
                      <td className={`px-4 py-3 text-right tabular-nums ${t.changes30d > 0 ? changeIntensity : "text-slate-400"}`}>
                        {t.changes30d || "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">{t.changes60d || "—"}</td>
                      <td className={`px-4 py-3 text-right tabular-nums ${changeIntensity}`}>
                        {t.totalChanges}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                        {t.avgShiftDays != null ? `${t.avgShiftDays.toFixed(0)}d` : "—"}
                      </td>
                      <td className={`px-4 py-3 text-right tabular-nums ${netColor}`}>
                        {t.netShiftDays != null ? (
                          <span className="inline-flex items-center gap-0.5">
                            {t.netShiftDays > 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : t.netShiftDays < 0 ? (
                              <TrendingDown className="h-3 w-3" />
                            ) : (
                              <ArrowRight className="h-3 w-3" />
                            )}
                            {t.netShiftDays > 0 ? "+" : ""}{t.netShiftDays}d
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                        {fmtCurrency(t.baselineArr)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-500">
                        {t.lastChangedAt ? fmtDate(t.lastChangedAt) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  hint,
}: {
  label: string;
  value: string | number;
  color?: string;
  hint?: string;
}) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</span>
      <span className={`mt-1 text-xl font-bold tabular-nums ${color ?? "text-slate-900"}`}>{value}</span>
      <span className="mt-auto min-h-[1rem] text-[11px] text-slate-400">{hint ?? ""}</span>
    </div>
  );
}
