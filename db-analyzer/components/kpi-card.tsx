import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  variant?: "default" | "danger" | "warning" | "success" | "info";
}

const VARIANT_STYLES = {
  default: {
    card: "bg-white border-slate-200",
    icon: "bg-slate-100 text-slate-500",
    label: "text-slate-500",
    value: "text-slate-900",
  },
  danger: {
    card: "bg-red-50 border-red-200",
    icon: "bg-red-100 text-red-600",
    label: "text-red-600",
    value: "text-red-900",
  },
  warning: {
    card: "bg-amber-50 border-amber-200",
    icon: "bg-amber-100 text-amber-600",
    label: "text-amber-700",
    value: "text-amber-900",
  },
  success: {
    card: "bg-emerald-50 border-emerald-200",
    icon: "bg-emerald-100 text-emerald-600",
    label: "text-emerald-700",
    value: "text-emerald-900",
  },
  info: {
    card: "bg-blue-50 border-blue-200",
    icon: "bg-blue-100 text-blue-600",
    label: "text-blue-700",
    value: "text-blue-900",
  },
};

export function KpiCard({ label, value, hint, icon, variant = "default" }: KpiCardProps) {
  const styles = VARIANT_STYLES[variant];
  return (
    <div
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-xl border p-5 shadow-sm transition-shadow hover:shadow-md",
        styles.card
      )}
    >
      <div className="flex flex-1 items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <p className={cn("text-xs font-semibold uppercase tracking-wider", styles.label)}>
            {label}
          </p>
          <p className={cn("mt-2 text-3xl font-bold tabular-nums tracking-tight", styles.value)}>
            {value}
          </p>
          {/* Reserve hint row so cards align even when hint is empty */}
          <p className="mt-1 min-h-[1rem] text-xs text-muted-foreground">
            {hint ?? " "}
          </p>
        </div>
        {icon && (
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              styles.icon
            )}
          >
            {icon}
          </span>
        )}
      </div>
    </div>
  );
}
