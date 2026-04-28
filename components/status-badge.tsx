import { cn } from "@/lib/utils";

type StatusCategory = "done" | "in-progress" | "new" | string;

const STATUS_STYLES: Record<string, string> = {
  // Done / closed variants
  done: "bg-emerald-100 text-emerald-800 border-emerald-200",
  closed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  resolved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  // In-progress variants
  "in progress": "bg-blue-100 text-blue-800 border-blue-200",
  "in review": "bg-violet-100 text-violet-800 border-violet-200",
  "code review": "bg-violet-100 text-violet-800 border-violet-200",
  "on hold": "bg-amber-100 text-amber-800 border-amber-200",
  blocked: "bg-red-100 text-red-800 border-red-200",
  // New / open variants
  new: "bg-slate-100 text-slate-700 border-slate-200",
  open: "bg-slate-100 text-slate-700 border-slate-200",
  "new item": "bg-slate-100 text-slate-700 border-slate-200",
  backlog: "bg-slate-100 text-slate-700 border-slate-200",
  "to do": "bg-slate-100 text-slate-700 border-slate-200",
};

function getStatusStyle(status: string): string {
  const lower = status.toLowerCase();
  if (STATUS_STYLES[lower]) return STATUS_STYLES[lower];
  // Category-level fallbacks
  if (lower.includes("done") || lower.includes("closed") || lower.includes("resolved")) {
    return STATUS_STYLES.done;
  }
  if (lower.includes("progress") || lower.includes("review") || lower.includes("dev")) {
    return STATUS_STYLES["in progress"];
  }
  return STATUS_STYLES.new;
}

export function StatusBadge({
  status,
  className,
}: {
  status: string | null;
  className?: string;
}) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        getStatusStyle(status),
        className
      )}
    >
      {status}
    </span>
  );
}
