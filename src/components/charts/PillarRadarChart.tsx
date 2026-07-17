import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { PillarSummary } from '../../lib/calc';

export function PillarRadarChart({ data }: { data: PillarSummary[] }) {
  const chartData = data.map((p) => ({
    pillar: p.pillar.replace(' / ', '\n/ '),
    score: p.score !== null ? Math.round(p.score * 1000) / 10 : 0,
    fullMark: 120,
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={chartData} outerRadius="72%">
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey="pillar" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <PolarRadiusAxis angle={90} domain={[0, 120]} tick={{ fontSize: 9, fill: 'var(--text-muted)' }} tickCount={5} />
          <Radar name="MTD Pace Score" dataKey="score" stroke="var(--brand-primary)" fill="var(--brand-primary)" fillOpacity={0.35} strokeWidth={2} />
          <Tooltip
            contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
            formatter={(v) => [`${v}%`, 'MTD Pace Score']}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
