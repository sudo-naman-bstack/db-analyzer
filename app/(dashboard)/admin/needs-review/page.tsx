import { getNeedsReview } from "@/lib/db/queries";
import { OverrideForm } from "@/components/override-form";

export const dynamic = "force-dynamic";

export default async function NeedsReviewPage() {
  const tickets = await getNeedsReview();
  if (tickets.length === 0) {
    return <p className="text-muted-foreground">All tickets have a resolved customer.</p>;
  }
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Tickets needing customer review</h2>
      <div className="rounded-lg border divide-y">
        {tickets.map((t) => (
          <div key={t.key} className="flex items-start justify-between gap-4 p-4">
            <div>
              <div className="text-sm font-medium">{t.key}</div>
              <div className="text-sm text-muted-foreground">{t.summary}</div>
            </div>
            <OverrideForm issueKey={t.key} />
          </div>
        ))}
      </div>
    </div>
  );
}
