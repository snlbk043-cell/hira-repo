import type { ReactNode } from 'react';

export function StatCard({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  color?: string;
  icon?: ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-1 rounded-xl border p-4"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: 'var(--text-muted)' }}
        >
          {label}
        </span>
        {icon && (
          <span style={{ color: color ?? 'var(--text-muted)' }}>{icon}</span>
        )}
      </div>
      <span
        className="tabular-nums text-2xl font-bold leading-tight"
        style={{ color: color ?? 'var(--brand-primary)' }}
      >
        {value}
      </span>
      {sub && (
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {sub}
        </span>
      )}
    </div>
  );
}
