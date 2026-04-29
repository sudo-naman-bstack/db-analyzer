import { fmtCurrency } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { EtaBadge } from "@/components/eta-badge";
import { MessageSquare } from "lucide-react";
import Link from "next/link";
import type { Ticket } from "@/lib/db/schema";

function firstSlackUrl(description: string | null): string | null {
  if (!description) return null;
  const m = description.match(/https?:\/\/[\w-]*\.?slack\.com\/[^\s<>"']+/i);
  return m ? m[0] : null;
}

export interface CustomerGroup {
  customer: string | null;
  n: number;
  openN: number;
  arr: string;
  iacv: string;
}

export function CustomerAccordion({
  grouped,
  byCustomer,
}: {
  grouped: CustomerGroup[];
  byCustomer: Map<string, Ticket[]>;
}) {
  return (
    <div className="space-y-3">
      {grouped.map((g) => {
        const customer = g.customer ?? "Unknown";
        const rows = byCustomer.get(customer) ?? [];
        const openCount = g.openN;

        return (
          <details
            key={customer}
            id={encodeURIComponent(customer)}
            className="group rounded-xl border border-slate-200 bg-white shadow-sm open:border-blue-200 open:ring-1 open:ring-blue-200"
          >
            <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
              <svg
                className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span className="flex-1 text-sm font-semibold text-slate-900">{customer}</span>
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

            <div className="border-t border-blue-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Key</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Summary</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">CE</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Promised ETA</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">ARR</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Slack</th>
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
                      <td className="px-4 py-2.5 text-slate-600">
                        {t.ceName ?? <span className="text-slate-400">—</span>}
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
                      <td className="px-4 py-2.5 text-center">
                        {(() => {
                          const url = firstSlackUrl(t.descriptionRaw);
                          return url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                              title="Open Slack thread"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </a>
                          ) : (
                            <span className="text-slate-300">—</span>
                          );
                        })()}
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
  );
}
