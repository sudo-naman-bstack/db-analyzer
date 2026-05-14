"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";

const COLORS = [
  "#10b981", // 0-7d: emerald (fast closures)
  "#34d399",
  "#6ee7b7",
  "#fbbf24", // 31-60d: amber (slower)
  "#f97316", // 61-120d: orange
  "#ef4444", // 120d+: red (stale)
];

interface TooltipPayload {
  value: number;
  payload: { bucket: string };
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-slate-700">{payload[0].payload.bucket}</p>
      <p className="text-slate-500">
        <span className="font-semibold text-slate-800">{payload[0].value}</span> tickets
      </p>
    </div>
  );
}

export function ClosureHistogram({ data }: { data: Array<{ bucket: string; count: number }> }) {
  return (
    <div className="h-64 w-full rounded-xl border border-slate-100 bg-white p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="bucket"
            tick={{ fontSize: 12, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
