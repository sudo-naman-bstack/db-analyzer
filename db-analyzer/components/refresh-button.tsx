"use client";

import { useState, useTransition } from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function RefreshButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/refresh?trigger=manual", { method: "POST" });
        if (!res.ok) throw new Error(`Refresh failed (${res.status})`);
        router.refresh();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  };

  return (
    <div className="flex items-center gap-3">
      <Button
        onClick={onClick}
        disabled={pending}
        variant="outline"
        size="sm"
        className={cn(
          "gap-1.5 transition-colors",
          pending && "border-blue-200 bg-blue-50 text-blue-700"
        )}
      >
        <RotateCw
          className={cn("h-3.5 w-3.5", pending && "animate-spin")}
        />
        {pending ? "Refreshing…" : "Refresh"}
      </Button>
      {error && (
        <span className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">{error}</span>
      )}
    </div>
  );
}
