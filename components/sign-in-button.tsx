"use client";

import { useTransition } from "react";
import { signIn } from "next-auth/react";

export function SignInButton({ from }: { from: string }) {
  const [pending, startTransition] = useTransition();
  const onClick = () => {
    startTransition(() => {
      void signIn("google", { callbackUrl: from || "/" });
    });
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M21.8 12.2c0-.8-.1-1.5-.2-2.2H12v4.3h5.5c-.2 1.3-1 2.4-2.1 3.1v2.6h3.4c2-1.8 3-4.5 3-7.8z" fill="#4285F4"/>
        <path d="M12 22c2.7 0 5-.9 6.7-2.4l-3.4-2.6c-.9.6-2.1 1-3.3 1-2.6 0-4.7-1.7-5.5-4.1H2.9v2.6C4.6 19.9 8.1 22 12 22z" fill="#34A853"/>
        <path d="M6.5 13.9c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9V7.5H2.9C2.3 8.9 2 10.4 2 12s.4 3.1 1 4.5l3.5-2.6z" fill="#FBBC04"/>
        <path d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9C16.9 2.9 14.7 2 12 2 8.1 2 4.6 4.1 2.9 7.5l3.5 2.6C7.3 7.7 9.4 6 12 6z" fill="#EA4335"/>
      </svg>
      {pending ? "Redirecting…" : "Sign in with Google"}
    </button>
  );
}
