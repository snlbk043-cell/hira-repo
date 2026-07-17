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
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = value === null ? 0 : Math.min(1, Math.max(0, value));
  const offset = circumference * (1 - pct);

  return (
    <div className="relative inline-flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular-nums text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          {label ?? (value === null ? '—' : `${Math.round(value * 100)}%`)}
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
