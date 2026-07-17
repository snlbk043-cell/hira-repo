import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { STATUS_COLORS } from '../../lib/format';
import type { KpiStatus } from '../../types';

const ORDER: KpiStatus[] = ['Achieved', 'Watch', 'Action Needed', 'Support Required', 'No Data'];

export function StatusDonutChart({
  counts,
  onSliceClick,
}: {
  counts: Record<KpiStatus, number>;
  onSliceClick?: (status: KpiStatus) => void;
}) {
  const data = ORDER.filter((s) => counts[s] > 0).map((status) => ({ status, value: counts[status] }));
  const total = data.reduce((a, b) => a + b.value, 0);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="status"
            innerRadius="58%"
            outerRadius="85%"
            paddingAngle={2}
            cornerRadius={4}
            onClick={(entry: unknown) => {
              const status = (entry as { status?: string; payload?: { status?: string } })?.status ??
                (entry as { payload?: { status?: string } })?.payload?.status;
              if (status) onSliceClick?.(status as KpiStatus);
            }}
            cursor={onSliceClick ? 'pointer' : 'default'}
          >
            {data.map((d) => (
              <Cell key={d.status} fill={STATUS_COLORS[d.status]} stroke="var(--surface-1)" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
            formatter={(value, name) => [`${value} KPIs (${((Number(value) / Math.max(1, total)) * 100).toFixed(0)}%)`, name]}
          />
          <Legend
            verticalAlign="bottom"
            height={48}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value) => <span style={{ color: 'var(--text-secondary)' }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
