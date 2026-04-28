import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dealblocker Dashboard",
  description: "BrowserStack TM dealblocker triage view",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground antialiased">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <header className="mb-8 flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">Dealblocker Dashboard</h1>
            <nav className="flex gap-4 text-sm text-muted-foreground">
              <a href="/" className="hover:text-foreground">Overview</a>
              <a href="/customers" className="hover:text-foreground">Customers</a>
              <a href="/closures" className="hover:text-foreground">Closures</a>
              <a href="/admin/needs-review" className="hover:text-foreground">Needs review</a>
            </nav>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
