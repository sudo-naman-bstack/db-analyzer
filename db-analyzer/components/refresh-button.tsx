"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

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
      <Button onClick={onClick} disabled={pending}>
        {pending ? "Refreshing…" : "Refresh now"}
      </Button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  );
}
