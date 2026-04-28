import { getOverviewKpis, getCustomerLeaderboard, getLastRefreshRun, getNeedsReview, getTriageCounts } from "@/lib/db/queries";
import { KpiCard } from "@/components/kpi-card";
import { RefreshButton } from "@/components/refresh-button";
import { fmtCurrency, fmtDate } from "@/lib/format";
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
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {lastRun
            ? `Last refresh: ${fmtDate(lastRun.startedAt)} • ${lastRun.ticketCount ?? 0} tickets`
            : "No refresh yet"}
        </div>
        <RefreshButton />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Link href="/tickets?filter=open" className="block hover:opacity-80">
          <KpiCard label="Open dealblockers" value={String(kpis.openCount)} />
        </Link>
        <Link href="/tickets?filter=open" className="block hover:opacity-80">
          <KpiCard label="ARR exposed" value={fmtCurrency(kpis.arrExposed)} hint="Customer-level, deduped" />
        </Link>
        <Link href="/tickets?filter=open" className="block hover:opacity-80">
          <KpiCard label="iACV at risk" value={fmtCurrency(kpis.iacvAtRisk)} hint="Sum across tickets" />
        </Link>
        <Link href="/tickets?filter=past-eta" className="block hover:opacity-80">
          <KpiCard label="Past Promised ETA" value={String(kpis.pastEtaCount)} />
        </Link>
        <Link href="/closures" className="block hover:opacity-80">
          <KpiCard
            label="Median closure (90d)"
            value={kpis.medianClosureDays != null ? `${Math.round(kpis.medianClosureDays)}d` : "—"}
          />
        </Link>
      </div>

      <section>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">Triage</h3>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/tickets?filter=no-eta"
            className="rounded-lg border px-3 py-2 hover:bg-muted"
          >
            <span className="font-semibold">{triage.noEta}</span>{" "}
            <span className="text-muted-foreground">open without Promised ETA</span>
          </Link>
          <Link
            href="/tickets?filter=unassigned"
            className="rounded-lg border px-3 py-2 hover:bg-muted"
          >
            <span className="font-semibold">{triage.unassigned}</span>{" "}
            <span className="text-muted-foreground">open and unassigned</span>
          </Link>
          {needsReview.length > 0 && (
            <Link
              href="/admin/needs-review"
              className="rounded-lg border border-amber-300 px-3 py-2 text-amber-700 hover:bg-amber-50"
            >
              <span className="font-semibold">{needsReview.length}</span>{" "}
              <span>need customer review</span>
            </Link>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Top customers</h2>
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Tickets</th>
                <th className="px-3 py-2">ARR</th>
                <th className="px-3 py-2">iACV</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row) => (
                <tr key={row.customer ?? "unknown"} className="border-t">
                  <td className="px-3 py-2">
                    <Link
                      href={`/customers#${encodeURIComponent(row.customer ?? "Unknown")}`}
                      className="hover:underline"
                    >
                      {row.customer ?? "Unknown"}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{row.n}</td>
                  <td className="px-3 py-2">{fmtCurrency(row.arr)}</td>
                  <td className="px-3 py-2">{fmtCurrency(row.iacv)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}
