import { db } from "@/lib/db/client";
import { tickets } from "@/lib/db/schema";
import { sql, desc, count } from "drizzle-orm";
import { fmtCurrency, fmtDate, isPastEta } from "@/lib/format";
import { ExpandOnHash } from "@/components/expand-on-hash";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const grouped = await db
    .select({
      customer: tickets.customer,
      n: count(),
      arr: sql<string>`COALESCE(MAX(${tickets.baselineArr}), 0)`,
      iacv: sql<string>`COALESCE(SUM(${tickets.incrementalAcv}), 0)`,
    })
    .from(tickets)
    .groupBy(tickets.customer)
    .orderBy(desc(count()), desc(sql`COALESCE(MAX(${tickets.baselineArr}), 0)`));

  const all = await db.select().from(tickets).orderBy(desc(tickets.updated));
  const byCustomer = new Map<string, typeof all>();
  for (const t of all) {
    const key = t.customer ?? "Unknown";
    if (!byCustomer.has(key)) byCustomer.set(key, []);
    byCustomer.get(key)!.push(t);
  }

  return (
    <div className="space-y-6">
      <ExpandOnHash />
      <h2 className="text-lg font-medium">By customer</h2>
      <div className="space-y-4">
        {grouped.map((g) => {
          const customer = g.customer ?? "Unknown";
          const rows = byCustomer.get(customer) ?? [];
          return (
            <details
              key={customer}
              id={encodeURIComponent(customer)}
              className="rounded-lg border bg-card open:shadow-sm"
            >
              <summary className="flex cursor-pointer items-center justify-between px-4 py-3">
                <div className="font-medium">{customer}</div>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>{g.n} tickets</span>
                  <span>ARR {fmtCurrency(g.arr)}</span>
                  <span>iACV {fmtCurrency(g.iacv)}</span>
                </div>
              </summary>
              <table className="w-full border-t text-sm">
                <thead className="bg-muted/30 text-left">
                  <tr>
                    <th className="px-3 py-2">Key</th>
                    <th className="px-3 py-2">Summary</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Promised ETA</th>
                    <th className="px-3 py-2">ARR</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.key} className="border-t">
                      <td className="px-3 py-2">
                        <Link href={`/ticket/${t.key}`} className="hover:underline">
                          {t.key}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{t.summary}</td>
                      <td className="px-3 py-2">{t.status}</td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            isPastEta(t.promisedEta as unknown as string | null, t.statusCategory)
                              ? "text-destructive"
                              : ""
                          }
                        >
                          {t.promisedEta ? fmtDate(t.promisedEta as unknown as string) : "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2">{fmtCurrency(t.baselineArr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          );
        })}
      </div>
    </div>
  );
}
