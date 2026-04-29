import { getTicketsByFilter, type TicketFilter } from "@/lib/db/queries";
import { fmtDate, fmtCurrency, daysBetween } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { EtaBadge } from "@/components/eta-badge";
import Link from "next/link";

export const dynamic = "force-dynamic";

const FILTER_LABELS: Record<TicketFilter, string> = {
  open: "Open dealblockers",
  "past-eta": "Past Promised ETA",
  done: "Closed dealblockers",
  "no-eta": "Open without Promised ETA",
  unassigned: "Open and unassigned",
  stale: "Stale (no update in 14+ days)",
  all: "All dealblockers",
};

const VALID_FILTERS: TicketFilter[] = ["open", "past-eta", "done", "no-eta", "unassigned", "stale", "all"];

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; customer?: string }>;
}) {
  const params = await searchParams;
  const raw = (params.filter ?? "all") as TicketFilter;
  const filter: TicketFilter = VALID_FILTERS.includes(raw) ? raw : "all";
  const customer = params.customer;
  const rows = await getTicketsByFilter(filter, customer);

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">
          {FILTER_LABELS[filter]}
        </h2>
        {customer && (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-sm text-slate-600">
            {customer}
          </span>
        )}
        <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-medium text-slate-600">
          {rows.length} ticket{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Key</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Summary</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Assignee</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">CE</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Created</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Age</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Promised ETA</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">ARR</th>
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
                return (
                  <tr
                    key={t.key}
                    className={`group transition-colors hover:bg-blue-50/40 ${i % 2 === 1 ? "bg-slate-50/40" : "bg-white"}`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/ticket/${t.key}`}
                        className="font-mono text-xs font-medium text-blue-600 hover:underline"
                      >
                        {t.key}
                      </Link>
                    </td>
                    <td className="max-w-xs px-4 py-3">
                      <span className="line-clamp-2 text-slate-700">{t.summary}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{t.customer ?? "Unknown"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
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
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                      {fmtCurrency(t.baselineArr)}
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
