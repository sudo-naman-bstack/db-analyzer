"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, AlertCircle } from "lucide-react";

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
  const [showPassword, setShowPassword] = useState(false);

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
    <form onSubmit={submit} className="space-y-4">
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 pr-10 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          autoFocus
          autoComplete="current-password"
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          tabIndex={-1}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      <Button
        type="submit"
        disabled={pending || !password}
        className="h-10 w-full rounded-lg bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800"
      >
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </form>
  );
}
