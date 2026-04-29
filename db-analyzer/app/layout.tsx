import type { Metadata } from "next";
import { ShieldAlert, LayoutDashboard, Users, TrendingUp, ClipboardCheck, Flame } from "lucide-react";
import { LogoutLink } from "@/components/logout-link";
import { NavLink } from "@/components/nav-link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dealblocker Dashboard",
  description: "BrowserStack TM dealblocker triage view",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-foreground antialiased">
        {/* Top nav bar */}
        <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
            {/* Logo + wordmark */}
            <div className="flex items-center gap-2.5 text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white">
                <ShieldAlert className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold tracking-tight">Dealblocker</span>
            </div>

            {/* Divider */}
            <span className="h-5 w-px bg-slate-200" />

            {/* Nav links — icons are rendered here in the server component */}
            <nav className="flex flex-1 items-center gap-0.5">
              <NavLink href="/">
                <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />
                Overview
              </NavLink>
              <NavLink href="/customers">
                <Users className="h-3.5 w-3.5 shrink-0" />
                Customers
              </NavLink>
              <NavLink href="/closures">
                <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                Closures
              </NavLink>
              <NavLink href="/risk">
                <Flame className="h-3.5 w-3.5 shrink-0" />
                Top risk
              </NavLink>
              <NavLink href="/admin/needs-review">
                <ClipboardCheck className="h-3.5 w-3.5 shrink-0" />
                Needs review
              </NavLink>
            </nav>

            {/* Sign out — pushed right */}
            <LogoutLink />
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
