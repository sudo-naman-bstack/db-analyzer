import { getTopRisk } from "@/lib/db/queries";
import { fmtDate, fmtCurrency } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { EtaBadge } from "@/components/eta-badge";
import { SectionHeader } from "@/components/section-header";
import { Flame } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RiskPage() {
  const rows = await getTopRisk(50);
  return (
    <div className="space-y-5">
      <SectionHeader
        icon={<Flame className="h-4 w-4" />}
        title="Top risk"
        description="Open tickets ranked by composite score (ARR + age + past-ETA + staleness)"
      />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Risk</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Key</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Summary</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">ARR</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Age</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Stale</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">ETA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((t, i) => {
              const pct = Math.round(t.riskScore * 100);
              const barColor = pct >= 70 ? "bg-red-500" : pct >= 50 ? "bg-amber-500" : "bg-slate-400";
              return (
                <tr key={t.key} className={`transition-colors hover:bg-blue-50/40 ${i % 2 === 1 ? "bg-slate-50/40" : "bg-white"}`}>
                  <td className="px-4 py-3 w-32">
                    <div className="flex items-center gap-2">
                      <span className="w-7 text-right text-xs font-bold tabular-nums text-slate-700">{pct}</span>
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/ticket/${t.key}`} className="font-mono text-xs font-medium text-blue-600 hover:underline">
                      {t.key}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{t.customer ?? "Unknown"}</td>
                  <td className="max-w-md px-4 py-3"><span className="line-clamp-2 text-slate-700">{t.summary}</span></td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">{fmtCurrency(t.baselineArr)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{t.ageDays}d</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{t.staleDays}d</td>
                  <td className="px-4 py-3"><EtaBadge eta={t.promisedEta} statusCategory={t.statusCategory} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
