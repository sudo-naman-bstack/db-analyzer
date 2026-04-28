import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";

function daysUntil(eta: string): number {
  return Math.ceil((new Date(eta).getTime() - Date.now()) / 86400000);
}

export function EtaBadge({
  eta,
  statusCategory,
  className,
}: {
  eta: string | null | Date;
  statusCategory: string;
  className?: string;
}) {
  const etaStr = eta ? (typeof eta === "string" ? eta : eta.toISOString()) : null;

  if (!etaStr) return <span className="text-muted-foreground">—</span>;

  const isDone = statusCategory === "done";
  const days = daysUntil(etaStr);
  const isPast = days < 0;
  const isNear = !isPast && days <= 7;

  let style = "bg-slate-100 text-slate-700 border-slate-200";
  if (!isDone && isPast) {
    style = "bg-red-100 text-red-800 border-red-200";
  } else if (!isDone && isNear) {
    style = "bg-amber-100 text-amber-800 border-amber-200";
  } else if (isDone) {
    style = "bg-slate-100 text-slate-500 border-slate-200";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        style,
        className
      )}
    >
      {fmtDate(etaStr)}
      {!isDone && isPast && (
        <span className="ml-1 font-semibold">({Math.abs(days)}d late)</span>
      )}
    </span>
  );
}
