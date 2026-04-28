"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ClosureHistogram({ data }: { data: Array<{ bucket: string; count: number }> }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data}>
          <XAxis dataKey="bucket" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
