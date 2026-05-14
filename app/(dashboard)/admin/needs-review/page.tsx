import { getNeedsReview } from "@/lib/db/queries";
import { OverrideForm } from "@/components/override-form";
import { SectionHeader } from "@/components/section-header";
import { ClipboardCheck, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function NeedsReviewPage() {
  const tickets = await getNeedsReview();

  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <h3 className="text-base font-semibold text-slate-900">All clear!</h3>
        <p className="mt-1.5 text-sm text-slate-500">
          All tickets have a resolved customer — nothing needs review.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={<ClipboardCheck className="h-4 w-4" />}
        title="Tickets needing customer review"
        description={`${tickets.length} ticket${tickets.length === 1 ? "" : "s"} with unresolved customer`}
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="divide-y divide-slate-100">
          {tickets.map((t) => (
            <div
              key={t.key}
              className="flex items-start justify-between gap-6 px-5 py-4 transition-colors hover:bg-slate-50"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 font-mono text-xs font-semibold text-blue-600">{t.key}</div>
                <div className="line-clamp-2 text-sm text-slate-700">{t.summary}</div>
              </div>
              <div className="shrink-0">
                <OverrideForm issueKey={t.key} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
