"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

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
        className="rounded border px-2 py-1 text-sm"
      />
      <Button size="sm" onClick={submit} disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
