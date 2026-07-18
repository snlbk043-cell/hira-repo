import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { useCountUp } from '../../lib/useCountUp';

function AnimatedNumber({ value }: { value: number }) {
  const animated = useCountUp(value, 700);
  return <>{Math.round(animated ?? value)}</>;
}

export function StatCard({
  label,
  value,
  sub,
  color,
  icon,
  onClick,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  color?: string;
  icon?: ReactNode;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`flex flex-col gap-1 rounded-xl border p-4 text-left transition duration-300 ${onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5' : ''}`}
      style={{ background: 'linear-gradient(160deg, var(--surface-1) 55%, var(--surface-2) 100%)', borderColor: 'var(--border)' }}
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
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </span>
      {sub && (
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {sub}
        </span>
      )}
      {onClick && (
        <span className="mt-0.5 flex items-center gap-1 text-[10px] font-medium" style={{ color: 'var(--brand-primary)' }}>
          <Info size={11} /> Click for details
        </span>
      )}
    </Tag>
  );
}
