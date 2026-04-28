"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export function OverrideForm({ issueKey }: { issueKey: string }) {
  const [customer, setCustomer] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const submit = () => {
    if (!customer.trim()) return;
    startTransition(async () => {
      await fetch("/api/override", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: issueKey, customer }),
      });
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-2">
      <input
        value={customer}
        onChange={(e) => setCustomer(e.target.value)}
        placeholder="Customer name"
        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      <Button
        size="sm"
        onClick={submit}
        disabled={pending || !customer.trim()}
        className="gap-1"
      >
        <Check className="h-3.5 w-3.5" />
        {pending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
