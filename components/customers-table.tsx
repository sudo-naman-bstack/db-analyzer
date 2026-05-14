import Link from "next/link";
import { fmtCurrency } from "@/lib/format";

export interface CustomerRow {
  customer: string | null;
  n: number;
  openN: number;
  arr: string;
  iacv: string;
}

export function CustomersTable({ rows }: { rows: CustomerRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Customer</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Open</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Closed</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Total</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">ARR</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">iACV</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((r, i) => {
              const customer = r.customer ?? "Unknown";
              const closed = r.n - r.openN;
              return (
                <tr
                  key={customer}
                  className={`group transition-colors hover:bg-blue-50/40 ${i % 2 === 1 ? "bg-slate-50/40" : "bg-white"}`}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/customers/${encodeURIComponent(customer)}`}
                      className="font-medium text-slate-800 hover:text-blue-600 hover:underline"
                    >
                      {customer}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.openN > 0 ? (
                      <span className="inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-800 tabular-nums">
                        {r.openN}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                    {closed > 0 ? closed : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{r.n}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">{fmtCurrency(r.arr)}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">{fmtCurrency(r.iacv)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
