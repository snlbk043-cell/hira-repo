import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div
      className="flex flex-wrap items-start justify-between gap-4 rounded-xl px-6 py-5 text-white shadow-sm"
      style={{
        background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-primary-2))',
        borderBottom: '5px solid var(--brand-accent)',
      }}
    >
      <div>
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-3xl text-sm text-white/85">{subtitle}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
