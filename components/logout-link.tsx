"use client";

import { LogOut } from "lucide-react";

export function LogoutLink() {
  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  };
  return (
    <a
      href="/api/logout"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
    >
      <LogOut className="h-3.5 w-3.5" />
      Sign out
    </a>
  );
}
