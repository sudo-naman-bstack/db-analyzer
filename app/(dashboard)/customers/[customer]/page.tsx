import { db } from "@/lib/db/client";
import { tickets } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { fmtDate, fmtCurrency, daysBetween } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { EtaBadge } from "@/components/eta-badge";
import { SectionHeader } from "@/components/section-header";
import { SlackIcon } from "@/components/slack-icon";
import { Users, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function firstSlackUrl(description: string | null): string | null {
  if (!description) return null;
  const m = description.match(/https?:\/\/[\w-]*\.?slack\.com\/[^\s<>"']+/i);
  return m ? m[0] : null;
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customer: string }>;
}) {
  const { customer: rawParam } = await params;
  const customerName = decodeURIComponent(rawParam);

  // Match either the literal customer name or NULL when navigating to "Unknown"
  const matchClause =
    customerName === "Unknown"
      ? sql`${tickets.customer} IS NULL OR ${tickets.customer} = 'Unknown'`
      : eq(tickets.customer, customerName);

  const rows = await db.select().from(tickets).where(matchClause).orderBy(desc(tickets.updated));
  if (rows.length === 0) notFound();

  // Aggregate: open, closed, ARR (max), iACV (sum)
  const openCount = rows.filter((t) => t.statusCategory !== "done").length;
  const closedCount = rows.length - openCount;
  const arr = rows.reduce((max, t) => {
    const v = Number(t.baselineArr ?? 0);
    return v > max ? v : max;
  }, 0);
  const iacv = rows.reduce((sum, t) => sum + Number(t.incrementalAcv ?? 0), 0);

  return (
    <div className="space-y-5">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to overview
      </Link>

      <SectionHeader
        icon={<Users className="h-4 w-4" />}
        title={customerName}
        description={`${rows.length} dealblocker${rows.length === 1 ? "" : "s"}`}
      />

      {/* Stat chips */}
      <div className="flex flex-wrap gap-3 text-sm">
        {openCount > 0 && (
          <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-800">
            {openCount} open
          </span>
        )}
        {closedCount > 0 && (
          <span className="rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-700">
            {closedCount} closed
          </span>
        )}
        <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
          ARR {fmtCurrency(arr)}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
          iACV {fmtCurrency(iacv)}
        </span>
      </div>

      {/* Tickets table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Key</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Summary</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Assignee</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">CE</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Created</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Age</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Promised ETA</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">ARR</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Slack</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((t, i) => {
                const age = daysBetween(t.created, new Date());
                const ageColor =
                  age > 60 && t.statusCategory !== "done"
                    ? "text-red-700 font-semibold"
                    : age > 30 && t.statusCategory !== "done"
                      ? "text-amber-700 font-medium"
                      : "text-slate-600";
                const slackUrl = firstSlackUrl(t.descriptionRaw);
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
                    <td className="max-w-md px-4 py-3"><span className="line-clamp-2 text-slate-700">{t.summary}</span></td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 text-slate-600">{t.assignee ?? <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-3 text-slate-600">{t.ceName ?? <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-500">{fmtDate(t.created)}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${ageColor}`}>{age}d</td>
                    <td className="px-4 py-3">
                      <EtaBadge
                        eta={t.promisedEta as unknown as string | null}
                        statusCategory={t.statusCategory}
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">{fmtCurrency(t.baselineArr)}</td>
                    <td className="px-4 py-3 text-center">
                      {slackUrl ? (
                        <a
                          href={slackUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-slate-100"
                          title="Open Slack thread"
                        >
                          <SlackIcon className="h-4 w-4" />
                        </a>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
