import { Line, LineChart, ReferenceDot, ResponsiveContainer, XAxis, YAxis } from 'recharts';

export function Sparkline({
  data,
  color = 'var(--series-blue)',
  width = 76,
  height = 26,
  highlightIndex,
}: {
  data: (number | null)[];
  color?: string;
  width?: number;
  height?: number;
  highlightIndex?: number;
}) {
  const points = data.map((v, i) => ({ i, v }));
  const hasData = points.some((p) => p.v !== null);
  if (!hasData) {
    return (
      <div style={{ width, height }} className="flex items-center justify-center text-[10px]" >
        <span style={{ color: 'var(--text-muted)' }}>—</span>
      </div>
    );
  }
  const highlight = highlightIndex !== undefined ? points[highlightIndex] : undefined;
  return (
    <div style={{ width, height }}>
      <ResponsiveContainer>
        <LineChart data={points} margin={{ top: 3, right: 3, bottom: 3, left: 3 }}>
          <XAxis dataKey="i" type="number" domain={[0, points.length - 1]} hide />
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.6}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
          {highlight && highlight.v !== null && (
            <ReferenceDot x={highlight.i} y={highlight.v} r={2.6} fill={color} stroke="none" />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
