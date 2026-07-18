import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PlantDayPoint } from '../../lib/calc';

export function PlantTrendChart({
  trend,
  selectedDay,
  target = 100,
}: {
  trend: PlantDayPoint[];
  selectedDay: number;
  target?: number;
}) {
  const chartData = trend.map((p) => ({
    day: p.day,
    score: p.score !== null ? Math.round(p.score * 1000) / 10 : null,
    momentum: p.momentum3 !== null ? Math.round(p.momentum3 * 1000) / 10 : null,
  }));
  const selectedPoint = chartData.find((p) => p.day === selectedDay);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 12, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="plantScoreFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--series-blue)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--series-blue)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} stroke="var(--border-strong)" />
          <YAxis
            domain={[0, Math.max(130, target + 30)]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            stroke="var(--border-strong)"
            width={44}
          />
          <ReferenceLine
            y={target}
            stroke="var(--status-good)"
            strokeDasharray="3 3"
            strokeOpacity={0.6}
            label={{ value: `Target ${target}%`, position: 'insideTopLeft', fontSize: 10, fill: 'var(--status-good)' }}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value) => `${value}%`}
            labelFormatter={(l) => `Day ${l}${l === selectedDay ? ' (selected)' : ''}`}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="score"
            name="Daily score"
            stroke="var(--series-blue)"
            strokeWidth={2}
            fill="url(#plantScoreFill)"
            dot={{ r: 2 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="momentum"
            name="3-day momentum"
            stroke="var(--series-orange)"
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={false}
            connectNulls
          />
          {selectedPoint && selectedPoint.score !== null && (
            <ReferenceDot
              x={selectedPoint.day}
              y={selectedPoint.score}
              r={7}
              fill="var(--brand-accent)"
              stroke="var(--surface-1)"
              strokeWidth={2}
            />
          )}
          <ReferenceLine x={selectedDay} stroke="var(--brand-accent)" strokeDasharray="2 2" strokeOpacity={0.5} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
