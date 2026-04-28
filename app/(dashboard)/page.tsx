import { getOverviewKpis, getCustomerLeaderboard, getLastRefreshRun, getNeedsReview } from "@/lib/db/queries";
import { KpiCard } from "@/components/kpi-card";
import { RefreshButton } from "@/components/refresh-button";
import { fmtCurrency, fmtDate } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [kpis, leaderboard, lastRun, needsReview] = await Promise.all([
    getOverviewKpis(),
    getCustomerLeaderboard(15),
    getLastRefreshRun(),
    getNeedsReview(),
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

      {needsReview.length > 0 && (
        <section>
          <Link href="/admin/needs-review" className="text-sm text-amber-600 hover:underline">
            {needsReview.length} ticket{needsReview.length === 1 ? "" : "s"} need customer review →
          </Link>
        </section>
      )}
    </div>
  );
}
