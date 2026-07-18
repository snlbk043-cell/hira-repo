import { useCountUp } from '../../lib/useCountUp';

export function Gauge({
  value,
  size = 96,
  strokeWidth = 10,
  color = 'var(--series-blue)',
  trackColor = 'var(--border)',
  label,
  sublabel,
}: {
  /** 0..1+ (values above 1 are clamped visually but shown in label) */
  value: number | null;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
}) {
  const animated = useCountUp(value === null ? null : value * 100, 700);
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = animated === null ? 0 : Math.min(1, Math.max(0, animated / 100));
  const offset = circumference * (1 - pct);
  const gradientId = `gauge-grad-${color.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div className="relative inline-flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.65} />
            <stop offset="100%" stopColor={color} stopOpacity={1} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular-nums text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          {label ?? (animated === null ? '—' : `${Math.round(animated)}%`)}
        </span>
        {sublabel && (
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}
