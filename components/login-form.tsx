"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function LoginForm({
  from,
  initialError,
}: {
  from: string;
  initialError: boolean;
}) {
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(initialError ? "Invalid password." : "");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.href = from || "/";
        return;
      }
      setError("Invalid password.");
    } catch {
      setError("Network error. Try again.");
    }
    setPending(false);
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="w-full rounded border bg-background px-3 py-2 text-sm"
        autoFocus
        autoComplete="current-password"
      />
      <Button type="submit" disabled={pending || !password} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
