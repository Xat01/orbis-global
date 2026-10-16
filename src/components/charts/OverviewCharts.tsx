"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function ArticlesOverTimeChart({ series }: { series: Array<{ hour: string; count: number }> }) {
  if (series.length === 0) {
    return <p className="py-6 text-center text-xs text-muted">No reporting in the last 48 hours.</p>;
  }
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="#dde1dd" vertical={false} />
          <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={7} stroke="#5c6660" />
          <YAxis tick={{ fontSize: 10 }} stroke="#5c6660" allowDecimals={false} />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #dde1dd" }}
            labelStyle={{ fontSize: 11 }}
          />
          <Area
            type="monotone"
            dataKey="count"
            name="reports retrieved"
            stroke="#059669"
            fill="#059669"
            fillOpacity={0.15}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EventsByRegionChart({
  byRegion,
}: {
  byRegion: Array<{ region: string; count: number }>;
}) {
  const data = byRegion
    .slice()
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((r) => ({ region: r.region.replace(/-/g, " "), count: r.count }));

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="#dde1dd" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10 }} stroke="#5c6660" allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="region"
            width={92}
            tick={{ fontSize: 10 }}
            stroke="#5c6660"
          />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #dde1dd" }} />
          <Bar dataKey="count" name="events" fill="#14332a" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
