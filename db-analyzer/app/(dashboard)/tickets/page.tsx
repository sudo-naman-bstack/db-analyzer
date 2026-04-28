import { getTicketsByFilter, type TicketFilter } from "@/lib/db/queries";
import { fmtDate, fmtCurrency, isPastEta } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

const FILTER_LABELS: Record<TicketFilter, string> = {
  open: "Open dealblockers",
  "past-eta": "Past Promised ETA",
  done: "Closed dealblockers",
  "no-eta": "Open without Promised ETA",
  unassigned: "Open and unassigned",
  all: "All dealblockers",
};

const VALID_FILTERS: TicketFilter[] = ["open", "past-eta", "done", "no-eta", "unassigned", "all"];

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
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-medium">{FILTER_LABELS[filter]}</h2>
        {customer && <span className="text-sm text-muted-foreground">— {customer}</span>}
        <span className="ml-auto text-sm text-muted-foreground">{rows.length} ticket{rows.length === 1 ? "" : "s"}</span>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-left">
          <tr>
            <th className="px-3 py-2">Key</th>
            <th className="px-3 py-2">Summary</th>
            <th className="px-3 py-2">Customer</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Assignee</th>
            <th className="px-3 py-2">Promised ETA</th>
            <th className="px-3 py-2">ARR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.key} className="border-t">
              <td className="px-3 py-2">
                <Link href={`/ticket/${t.key}`} className="hover:underline">
                  {t.key}
                </Link>
              </td>
              <td className="px-3 py-2">{t.summary}</td>
              <td className="px-3 py-2">{t.customer ?? "Unknown"}</td>
              <td className="px-3 py-2">{t.status}</td>
              <td className="px-3 py-2">{t.assignee ?? "—"}</td>
              <td className="px-3 py-2">
                <span
                  className={
                    isPastEta(t.promisedEta as unknown as string | null, t.statusCategory)
                      ? "text-destructive"
                      : ""
                  }
                >
                  {t.promisedEta ? fmtDate(t.promisedEta as unknown as string) : "—"}
                </span>
              </td>
              <td className="px-3 py-2">{fmtCurrency(t.baselineArr)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
