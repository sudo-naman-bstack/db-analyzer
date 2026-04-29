import { getTicket, getStatusHistory } from "@/lib/db/queries";
import { ShowLatestStatus } from "@/components/show-latest-status";
import { fmtDate, fmtCurrency, daysBetween } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { EtaBadge } from "@/components/eta-badge";
import { notFound } from "next/navigation";
import { ExternalLink, ArrowRight, MessageSquare, AlertCircle, Clock, CheckCircle2 } from "lucide-react";

function extractSlackUrls(description: string | null): string[] {
  if (!description) return [];
  const re = /https?:\/\/[\w-]*\.?slack\.com\/[^\s<>"']+/gi;
  const matches = description.match(re) ?? [];
  // Dedup while preserving order
  return Array.from(new Set(matches));
}

export const dynamic = "force-dynamic";

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-800">{children}</dd>
    </div>
  );
}

export default async function TicketPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const ticket = await getTicket(key);
  if (!ticket) notFound();
  const history = await getStatusHistory(key);
  const jiraUrl = `${process.env.JIRA_BASE_URL}/browse/${ticket.key}`;
  const slackUrls = extractSlackUrls(ticket.descriptionRaw);
  const staleDays = daysBetween(ticket.updated, new Date());
  const stripe =
    staleDays >= 14
      ? { bg: "bg-red-50 border-red-200", text: "text-red-700", icon: AlertCircle, label: `Stale — no update in ${staleDays} days` }
      : staleDays >= 7
        ? { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", icon: Clock, label: `Quiet — last update ${staleDays} days ago` }
        : { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", icon: CheckCircle2, label: `Active — updated ${staleDays === 0 ? "today" : `${staleDays} day${staleDays === 1 ? "" : "s"} ago`}` };
  const StripeIcon = stripe.icon;
  const daysOpen = ticket.doneAt
    ? daysBetween(ticket.created, ticket.doneAt)
    : daysBetween(ticket.created, new Date());

  return (
    <div className="space-y-6">
      {/* Freshness stripe */}
      <div
        className={`flex items-center gap-3 rounded-xl border ${stripe.bg} px-4 py-3 ${stripe.text}`}
        title="Updated time tracks any change to the ticket — status moves, comments, field edits, ETA changes, etc. Synced from Jira's `updated` timestamp."
      >
        <StripeIcon className="h-4 w-4 shrink-0" />
        <span className="text-sm font-medium">{stripe.label}</span>
      </div>

      {/* Ticket header */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <a
            href={jiraUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs font-medium text-blue-700 hover:bg-blue-50 hover:text-blue-800"
          >
            {ticket.key}
            <ExternalLink className="h-3 w-3" />
          </a>
          <StatusBadge status={ticket.status} />
        </div>
        <h1 className="text-xl font-semibold leading-snug tracking-tight text-slate-900">
          {ticket.summary}
        </h1>
      </div>

      {/* Meta grid */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-5 md:grid-cols-3">
          <MetaItem label="Status">
            <StatusBadge status={ticket.status} />
          </MetaItem>
          <MetaItem label="Customer">
            <span className="font-medium">{ticket.customer ?? "Unknown"}</span>
            {ticket.customerSource && (
              <span className="ml-1.5 text-xs text-slate-400">({ticket.customerSource})</span>
            )}
          </MetaItem>
          <MetaItem label="Assignee">
            {ticket.assignee ?? <span className="text-slate-400">Unassigned</span>}
          </MetaItem>
          <MetaItem label="Created">{fmtDate(ticket.created)}</MetaItem>
          <MetaItem label="Done">
            {ticket.doneAt ? fmtDate(ticket.doneAt) : <span className="text-slate-400">—</span>}
          </MetaItem>
          <MetaItem label="Days open">
            <span
              className={
                daysOpen > 60
                  ? "font-bold text-red-700"
                  : daysOpen > 30
                    ? "font-semibold text-amber-700"
                    : "text-slate-800"
              }
            >
              {daysOpen}d
            </span>
          </MetaItem>
          <MetaItem label="Promised ETA">
            <EtaBadge
              eta={ticket.promisedEta as unknown as string | null}
              statusCategory={ticket.statusCategory}
            />
          </MetaItem>
          <MetaItem label="Customer Expected">
            {ticket.customerExpectedEta ?? <span className="text-slate-400">—</span>}
          </MetaItem>
          <MetaItem label="Baseline ARR">
            <span className="font-mono tabular-nums">{fmtCurrency(ticket.baselineArr)}</span>
          </MetaItem>
          <MetaItem label="Category">
            {ticket.dbCategory ?? <span className="text-slate-400">—</span>}
          </MetaItem>
          <MetaItem label="Product">
            {ticket.dbProduct ?? <span className="text-slate-400">—</span>}
          </MetaItem>
          <MetaItem label="CE">
            {ticket.ceName ?? <span className="text-slate-400">—</span>}
          </MetaItem>
        </dl>
      </div>

      {/* Slack threads */}
      {slackUrls.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Slack threads
          </h3>
          <div className="flex flex-wrap gap-2">
            {slackUrls.map((url, i) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                <MessageSquare className="h-4 w-4" />
                Slack thread {i + 1}
                <ExternalLink className="h-3 w-3 opacity-60" />
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Latest status AI summary */}
      <ShowLatestStatus ticketKey={ticket.key} />

      {/* Status timeline */}
      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Status timeline
        </h3>
        {history.length === 0 ? (
          <p className="text-sm text-slate-400">No status changes recorded.</p>
        ) : (
          <ol className="relative space-y-0 border-l border-slate-200 pl-5">
            {history.map((h, i) => (
              <li key={h.id} className={`relative pb-5 ${i === history.length - 1 ? "pb-0" : ""}`}>
                {/* Timeline dot */}
                <span className="absolute -left-[1.125rem] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-slate-200 bg-white" />

                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="tabular-nums text-slate-500">{fmtDate(h.changedAt)}</span>
                  <span className="flex items-center gap-1.5">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">
                      {h.fromStatus ?? "—"}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-white">
                      {h.toStatus}
                    </span>
                  </span>
                  {h.author && (
                    <span className="text-slate-400">by {h.author}</span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
