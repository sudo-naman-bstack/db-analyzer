import { getTicket, getStatusHistory } from "@/lib/db/queries";
import { fmtDate, fmtCurrency, daysBetween } from "@/lib/format";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TicketPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const ticket = await getTicket(key);
  if (!ticket) notFound();
  const history = await getStatusHistory(key);
  const jiraUrl = `${process.env.JIRA_BASE_URL}/browse/${ticket.key}`;

  return (
    <div className="space-y-6">
      <div>
        <a href={jiraUrl} target="_blank" rel="noreferrer" className="text-sm text-muted-foreground hover:underline">
          {ticket.key} ↗
        </a>
        <h2 className="mt-1 text-xl font-semibold">{ticket.summary}</h2>
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border p-4 text-sm md:grid-cols-3">
        <div><dt className="text-muted-foreground">Status</dt><dd>{ticket.status}</dd></div>
        <div><dt className="text-muted-foreground">Customer</dt><dd>{ticket.customer ?? "Unknown"} <span className="text-xs text-muted-foreground">({ticket.customerSource})</span></dd></div>
        <div><dt className="text-muted-foreground">Assignee</dt><dd>{ticket.assignee ?? "—"}</dd></div>
        <div><dt className="text-muted-foreground">Created</dt><dd>{fmtDate(ticket.created)}</dd></div>
        <div><dt className="text-muted-foreground">Done</dt><dd>{ticket.doneAt ? fmtDate(ticket.doneAt) : "—"}</dd></div>
        <div><dt className="text-muted-foreground">Days open</dt><dd>{ticket.doneAt ? daysBetween(ticket.created, ticket.doneAt) : daysBetween(ticket.created, new Date())}</dd></div>
        <div><dt className="text-muted-foreground">Promised ETA</dt><dd>{ticket.promisedEta ? fmtDate(ticket.promisedEta as unknown as string) : "—"}</dd></div>
        <div><dt className="text-muted-foreground">Customer Expected</dt><dd>{ticket.customerExpectedEta ?? "—"}</dd></div>
        <div><dt className="text-muted-foreground">Baseline ARR</dt><dd>{fmtCurrency(ticket.baselineArr)}</dd></div>
        <div><dt className="text-muted-foreground">Category</dt><dd>{ticket.dbCategory ?? "—"}</dd></div>
        <div><dt className="text-muted-foreground">Product</dt><dd>{ticket.dbProduct ?? "—"}</dd></div>
        <div><dt className="text-muted-foreground">CE</dt><dd>{ticket.ceName ?? "—"}</dd></div>
      </dl>

      <section>
        <h3 className="mb-2 font-medium">Status timeline</h3>
        <ul className="space-y-2 text-sm">
          {history.map((h) => (
            <li key={h.id} className="flex gap-3">
              <span className="text-muted-foreground">{fmtDate(h.changedAt)}</span>
              <span>
                <b>{h.fromStatus ?? "—"}</b> → <b>{h.toStatus}</b>
                {h.author && <span className="text-muted-foreground"> by {h.author}</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
