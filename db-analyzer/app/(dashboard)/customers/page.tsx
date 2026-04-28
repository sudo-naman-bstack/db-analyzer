import { db } from "@/lib/db/client";
import { tickets } from "@/lib/db/schema";
import { sql, desc, count } from "drizzle-orm";
import { fmtCurrency } from "@/lib/format";
import { ExpandOnHash } from "@/components/expand-on-hash";
import { StatusBadge } from "@/components/status-badge";
import { EtaBadge } from "@/components/eta-badge";
import { SectionHeader } from "@/components/section-header";
import { Users } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const grouped = await db
    .select({
      customer: tickets.customer,
      n: count(),
      arr: sql<string>`COALESCE(MAX(${tickets.baselineArr}), 0)`,
      iacv: sql<string>`COALESCE(SUM(${tickets.incrementalAcv}), 0)`,
    })
    .from(tickets)
    .groupBy(tickets.customer)
    .orderBy(desc(count()), desc(sql`COALESCE(MAX(${tickets.baselineArr}), 0)`));

  const all = await db.select().from(tickets).orderBy(desc(tickets.updated));
  const byCustomer = new Map<string, typeof all>();
  for (const t of all) {
    const key = t.customer ?? "Unknown";
    if (!byCustomer.has(key)) byCustomer.set(key, []);
    byCustomer.get(key)!.push(t);
  }

  return (
    <div className="space-y-6">
      <ExpandOnHash />
      <SectionHeader
        icon={<Users className="h-4 w-4" />}
        title="By customer"
        description={`${grouped.length} customers with dealblocking tickets`}
      />

      <div className="space-y-3">
        {grouped.map((g) => {
          const customer = g.customer ?? "Unknown";
          const rows = byCustomer.get(customer) ?? [];
          const openCount = rows.filter((t) => t.statusCategory !== "done").length;

          return (
            <details
              key={customer}
              id={encodeURIComponent(customer)}
              className="group rounded-xl border border-slate-200 bg-white shadow-sm open:border-blue-200 open:ring-1 open:ring-blue-200"
            >
              <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
                {/* Chevron */}
                <svg
                  className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>

                {/* Customer name */}
                <span className="flex-1 text-sm font-semibold text-slate-900">{customer}</span>

                {/* Stats chips */}
                <div className="flex items-center gap-2">
                  {openCount > 0 && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                      {openCount} open
                    </span>
                  )}
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {g.n} total
                  </span>
                  <span className="hidden rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 sm:inline">
                    ARR {fmtCurrency(g.arr)}
                  </span>
                  <span className="hidden rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 md:inline">
                    iACV {fmtCurrency(g.iacv)}
                  </span>
                </div>
              </summary>

              {/* Expanded table */}
              <div className="border-t border-blue-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Key</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Summary</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Promised ETA</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">ARR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rows.map((t, i) => (
                      <tr
                        key={t.key}
                        className={`transition-colors hover:bg-blue-50/40 ${i % 2 === 1 ? "bg-slate-50/40" : ""}`}
                      >
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/ticket/${t.key}`}
                            className="font-mono text-xs font-medium text-blue-600 hover:underline"
                          >
                            {t.key}
                          </Link>
                        </td>
                        <td className="max-w-xs px-4 py-2.5">
                          <span className="line-clamp-2 text-slate-700">{t.summary}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={t.status} />
                        </td>
                        <td className="px-4 py-2.5">
                          <EtaBadge
                            eta={t.promisedEta as unknown as string | null}
                            statusCategory={t.statusCategory}
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                          {fmtCurrency(t.baselineArr)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
