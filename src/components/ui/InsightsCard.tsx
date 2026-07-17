import { AlertTriangle, CheckCircle2, Info, TrendingDown } from 'lucide-react';
import type { Insight, InsightTone } from '../../lib/narrative';

const TONE_STYLE: Record<InsightTone, { color: string; icon: typeof Info }> = {
  positive: { color: 'var(--status-good)', icon: CheckCircle2 },
  risk: { color: 'var(--status-critical)', icon: AlertTriangle },
  warning: { color: 'var(--status-serious)', icon: TrendingDown },
  neutral: { color: 'var(--series-blue)', icon: Info },
};

export function InsightsCard({ insights }: { insights: Insight[] }) {
  return (
    <ol className="flex flex-col gap-2.5">
      {insights.map((insight, i) => {
        const { color, icon: Icon } = TONE_STYLE[insight.tone];
        return (
          <li
            key={i}
            className="flex gap-3 rounded-lg border-l-4 p-3 text-sm leading-relaxed"
            style={{ borderColor: color, background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
          >
            <Icon size={17} className="mt-0.5 shrink-0" color={color} />
            <span>{insight.text}</span>
          </li>
        );
      })}
    </ol>
  );
}
