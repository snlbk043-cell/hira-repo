import type { ForecastSignal, KpiStatus, TrendDirection } from '../types';

export function fmtNumber(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function fmtPercent(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${(n * 100).toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`;
}

export function fmtUnitValue(n: number | null | undefined, unit: string, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const num = fmtNumber(n, digits);
  if (unit === '%') return `${num}%`;
  if (unit === 'INR') return `₹${num}`;
  return `${num} ${unit}`;
}

export function fmtSignedNumber(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const s = n > 0 ? '+' : '';
  return `${s}${fmtNumber(n, digits)}`;
}

export const STATUS_COLORS: Record<KpiStatus, string> = {
  Achieved: 'var(--status-good)',
  Watch: 'var(--status-warning)',
  'Action Needed': 'var(--status-serious)',
  'Support Required': 'var(--status-critical)',
  'No Data': 'var(--text-muted)',
};

export const FORECAST_COLORS: Record<ForecastSignal, string> = {
  'On Track': 'var(--status-good)',
  'At Risk': 'var(--status-serious)',
  'Off Track': 'var(--status-critical)',
  'No Data': 'var(--text-muted)',
};

export const TREND_COLORS: Record<TrendDirection, string> = {
  Improving: 'var(--status-good)',
  Deteriorating: 'var(--status-critical)',
  Stable: 'var(--series-blue)',
  'Insufficient Data': 'var(--text-muted)',
};

export function trendArrow(t: TrendDirection): string {
  if (t === 'Improving') return '▲';
  if (t === 'Deteriorating') return '▼';
  if (t === 'Stable') return '●';
  return '◆';
}

export function scoreColor(score: number | null): string {
  if (score === null) return 'var(--text-muted)';
  if (score >= 1) return 'var(--status-good)';
  if (score >= 0.9) return 'var(--status-warning)';
  if (score >= 0.75) return 'var(--status-serious)';
  return 'var(--status-critical)';
}
