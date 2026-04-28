import { getOverviewKpis, getCustomerLeaderboard, getLastRefreshRun, getNeedsReview, getTriageCounts } from "@/lib/db/queries";
import { KpiCard } from "@/components/kpi-card";
import { RefreshButton } from "@/components/refresh-button";
import { SectionHeader } from "@/components/section-header";
import { fmtCurrency, fmtDate } from "@/lib/format";
import {
  AlertTriangle,
  Clock,
  DollarSign,
  TrendingDown,
  Timer,
  CalendarX,
  UserX,
  ClipboardList,
  Users,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [kpis, leaderboard, lastRun, needsReview, triage] = await Promise.all([
    getOverviewKpis(),
    getCustomerLeaderboard(15),
    getLastRefreshRun(),
    getNeedsReview(),
    getTriageCounts(),
  ]);

  return (
    <div className="space-y-8">
      {/* Top bar: last refresh + refresh button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Clock className="h-3.5 w-3.5" />
          {lastRun
            ? `Last refresh: ${fmtDate(lastRun.startedAt)} · ${lastRun.ticketCount ?? 0} tickets`
            : "No refresh yet"}
        </div>
        <RefreshButton />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Link href="/tickets?filter=open" className="block">
          <KpiCard
            label="Open dealblockers"
            value={String(kpis.openCount)}
            icon={<AlertTriangle className="h-4 w-4" />}
            variant={kpis.openCount > 0 ? "warning" : "success"}
          />
        </Link>
        <Link href="/tickets?filter=open" className="block">
          <KpiCard
            label="ARR exposed"
            value={fmtCurrency(kpis.arrExposed)}
            hint="Customer-level, deduped"
            icon={<DollarSign className="h-4 w-4" />}
            variant="default"
          />
        </Link>
        <Link href="/tickets?filter=open" className="block">
          <KpiCard
            label="iACV at risk"
            value={fmtCurrency(kpis.iacvAtRisk)}
            hint="Sum across tickets"
            icon={<TrendingDown className="h-4 w-4" />}
            variant="default"
          />
        </Link>
        <Link href="/tickets?filter=past-eta" className="block">
          <KpiCard
            label="Past Promised ETA"
            value={String(kpis.pastEtaCount)}
            icon={<CalendarX className="h-4 w-4" />}
            variant={kpis.pastEtaCount > 0 ? "danger" : "success"}
          />
        </Link>
        <Link href="/closures" className="block">
          <KpiCard
            label="Median closure (90d)"
            value={kpis.medianClosureDays != null ? `${Math.round(kpis.medianClosureDays)}d` : "—"}
            icon={<Timer className="h-4 w-4" />}
            variant="info"
          />
        </Link>
      </div>

      {/* Triage section */}
      <section>
        <SectionHeader
          icon={<ClipboardList className="h-4 w-4" />}
          title="Triage"
          description="Items that need attention"
          className="mb-4"
        />
        <div className="flex flex-wrap gap-3">
          <Link
            href="/tickets?filter=no-eta"
            className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <CalendarX className="h-4 w-4" />
            </span>
            <div className="text-sm">
              <span className="font-bold text-slate-900">{triage.noEta}</span>{" "}
              <span className="text-slate-500">open without Promised ETA</span>
            </div>
          </Link>

          <Link
            href="/tickets?filter=unassigned"
            className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <UserX className="h-4 w-4" />
            </span>
            <div className="text-sm">
              <span className="font-bold text-slate-900">{triage.unassigned}</span>{" "}
              <span className="text-slate-500">open and unassigned</span>
            </div>
          </Link>

          {needsReview.length > 0 && (
            <Link
              href="/admin/needs-review"
              className="group flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                <ClipboardList className="h-4 w-4" />
              </span>
              <div className="text-sm">
                <span className="font-bold text-amber-900">{needsReview.length}</span>{" "}
                <span className="text-amber-700">need customer review</span>
              </div>
            </Link>
          )}
        </div>
      </section>

      {/* Top customers table */}
      <section>
        <SectionHeader
          icon={<Users className="h-4 w-4" />}
          title="Top customers"
          description="By open ticket count"
          className="mb-4"
        />
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Customer
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Tickets
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  ARR
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  iACV
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {leaderboard.map((row, i) => (
                <tr
                  key={row.customer ?? "unknown"}
                  className={`group transition-colors hover:bg-blue-50/50 ${i % 2 === 1 ? "bg-slate-50/50" : "bg-white"}`}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/customers#${encodeURIComponent(row.customer ?? "Unknown")}`}
                      className="font-medium text-slate-800 hover:text-blue-600 hover:underline"
                    >
                      {row.customer ?? "Unknown"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    <span className="inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded-full bg-slate-100 px-1.5 text-xs font-semibold text-slate-700">
                      {row.n}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                    {fmtCurrency(row.arr)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                    {fmtCurrency(row.iacv)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
