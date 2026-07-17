import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
  Legend,
} from 'recharts';
import { scoreColor } from '../../lib/format';
import type { DepartmentSummary } from '../../lib/calc';

export function DepartmentComposedChart({
  data,
  selectedDept,
  onBarClick,
}: {
  data: DepartmentSummary[];
  selectedDept?: string;
  onBarClick?: (dept: string) => void;
}) {
  const chartData = data.map((d) => ({
    department: d.department,
    score: d.score !== null ? Math.round(d.score * 1000) / 10 : 0,
    completion: d.completion !== null ? Math.round(d.completion * 1000) / 10 : 0,
    target: 100,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 5, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="department"
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            stroke="var(--border-strong)"
            interval={0}
            angle={-20}
            textAnchor="end"
            height={50}
          />
          <YAxis domain={[0, 120]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} stroke="var(--border-strong)" width={44} />
          <Tooltip
            contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
            formatter={(v, name) => [`${v}%`, name === 'score' ? 'MTD Score' : name === 'completion' ? 'Completion' : 'Target']}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => (v === 'score' ? 'MTD Score' : v === 'completion' ? 'Completion' : v)} />
          <Bar
            dataKey="score"
            name="score"
            radius={[4, 4, 0, 0]}
            maxBarSize={38}
            onClick={(d: unknown) => {
              const dept = (d as { department?: string; payload?: { department?: string } })?.department ??
                (d as { payload?: { department?: string } })?.payload?.department;
              if (dept) onBarClick?.(dept);
            }}
            cursor={onBarClick ? 'pointer' : 'default'}
          >
            {chartData.map((d) => (
              <Cell key={d.department} fill={scoreColor(d.score / 100)} fillOpacity={!selectedDept || selectedDept === 'All' || d.department === selectedDept ? 1 : 0.45} />
            ))}
          </Bar>
          <Line type="monotone" dataKey="completion" name="completion" stroke="var(--series-violet)" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="target" name="target" stroke="var(--text-muted)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
