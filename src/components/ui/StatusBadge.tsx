import type { ForecastSignal, KpiStatus, TrendDirection } from '../../types';
import { FORECAST_COLORS, STATUS_COLORS, TREND_COLORS, trendArrow } from '../../lib/format';

export function StatusBadge({ status }: { status: KpiStatus }) {
  const color = STATUS_COLORS[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap"
      style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {status}
    </span>
  );
}

export function ForecastBadge({ signal }: { signal: ForecastSignal }) {
  const color = FORECAST_COLORS[signal];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap"
      style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {signal}
    </span>
  );
}

export function TrendBadge({ trend }: { trend: TrendDirection }) {
  const color = TREND_COLORS[trend];
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap" style={{ color }}>
      <span>{trendArrow(trend)}</span>
      {trend}
    </span>
  );
}
