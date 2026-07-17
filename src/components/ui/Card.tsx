import type { ReactNode } from 'react';
import clsx from 'clsx';

export function Card({
  children,
  className,
  title,
  subtitle,
  actions,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  padded?: boolean;
}) {
  return (
    <div
      className={clsx(
        'rounded-xl border shadow-sm',
        className,
      )}
      style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 px-4 pt-4">
          <div>
            {title && (
              <h3 className="text-sm font-bold" style={{ color: 'var(--brand-primary)' }}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                {subtitle}
              </p>
            )}
          </div>
          {actions}
        </div>
      )}
      <div className={padded ? 'p-4' : ''}>{children}</div>
    </div>
  );
}
