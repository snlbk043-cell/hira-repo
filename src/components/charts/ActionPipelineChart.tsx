import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';

const STAGE_COLORS: Record<string, string> = {
  'Not Started': '#898781',
  'In Progress': 'var(--series-blue)',
  'Pending Support': 'var(--status-warning)',
  'On Hold': 'var(--status-serious)',
  Completed: 'var(--status-good)',
};

export function ActionPipelineChart({ data }: { data: { status: string; count: number }[] }) {
  const chartData = data.map((d) => ({ name: d.status, value: d.count }));
  const total = chartData.reduce((a, b) => a + b.value, 0);

  if (total === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
        No open actions to visualize.
      </div>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 28, left: 0, bottom: 5 }}>
          <XAxis type="number" hide domain={[0, Math.max(1, ...chartData.map((d) => d.value)) * 1.15]} />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
            axisLine={false}
            tickLine={false}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={26}>
            {chartData.map((d) => (
              <Cell key={d.name} fill={STAGE_COLORS[d.name] ?? 'var(--series-blue)'} />
            ))}
            <LabelList dataKey="value" position="right" fill="var(--text-primary)" fontSize={12} fontWeight={700} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
