"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";

interface BatchResult {
  ticketCount: number;
  newOrChanged: number;
  llmCalls: number;
  errors: number;
  hasMore: boolean;
  remainingLlm: number;
}

const MAX_BATCHES = 20;

export function RefreshButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<string>("");
  const [processed, setProcessed] = useState(0);
  const [total, setTotal] = useState(0);
  const router = useRouter();

  const onClick = () => {
    setError(null);
    setProcessed(0);
    setTotal(0);
    setPhase("Refreshing tickets…");
    startTransition(async () => {
      try {
        let cumulativeProcessed = 0;
        let estimatedTotal = 0;
        let batchCount = 0;
        for (; batchCount < MAX_BATCHES; batchCount++) {
          const res = await fetch("/api/refresh?trigger=manual", { method: "POST" });
          if (!res.ok) throw new Error(`Refresh failed (${res.status})`);
          const data = (await res.json()) as BatchResult;
          cumulativeProcessed += data.newOrChanged;
          // First batch sets the estimated total; later batches update only if higher.
          const batchTotal = data.ticketCount + data.remainingLlm;
          estimatedTotal = Math.max(estimatedTotal, batchTotal, cumulativeProcessed);
          setProcessed(cumulativeProcessed);
          setTotal(estimatedTotal);
          setPhase(
            data.hasMore
              ? `Resolving customers… (batch ${batchCount + 2})`
              : "Finalising…",
          );
          if (!data.hasMore) break;
        }
        setPhase("Done");
        router.refresh();
      } catch (err) {
        setError((err as Error).message);
      } finally {
        // Clear progress after a short delay so the user sees "Done"
        setTimeout(() => {
          setPhase("");
          setProcessed(0);
          setTotal(0);
        }, 1500);
      }
    });
  };

  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-3">
        <Button
          onClick={onClick}
          disabled={pending}
          className="gap-2"
        >
          <RotateCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
          {pending ? "Refreshing…" : "Refresh now"}
        </Button>
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
      {pending && total > 0 && (
        <div className="w-64 space-y-1">
          <div className="flex justify-between text-xs text-slate-500">
            <span>{phase}</span>
            <span className="tabular-nums">{processed}/{total}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
