import { Info } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { useAppStore } from '../state/AppStore';

export function Settings() {
  const { state, updateMeta, theme, toggleTheme } = useAppStore();

  return (
    <div className="flex flex-col gap-5 pb-10">
      <PageHeader
        title="Settings"
        subtitle="Company and plant details, review configuration and display preferences used across the DMS."
      />

      <Card title="COMPANY & PLANT" subtitle="Used on report covers, PDF/PowerPoint exports and leadership sign-off defaults">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Company Name">
            <input
              value={state.meta.companyName}
              onChange={(e) => updateMeta({ companyName: e.target.value })}
              className="w-full rounded border bg-transparent p-2 text-sm outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
          </Field>
          <Field label="Plant / Site Name">
            <input
              value={state.meta.plantName}
              onChange={(e) => updateMeta({ plantName: e.target.value })}
              className="w-full rounded border bg-transparent p-2 text-sm outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
          </Field>
          <Field label="Prepared By (default)" hint="Pre-fills the Leadership Review 'Reviewed By' field">
            <input
              value={state.meta.preparedBy}
              onChange={(e) => updateMeta({ preparedBy: e.target.value })}
              className="w-full rounded border bg-transparent p-2 text-sm outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
          </Field>
          <Field label="Due-Soon Alert Threshold (days)" hint="Actions due within this many days are flagged in the Risk & Action table">
            <input
              type="number"
              min={0}
              max={30}
              value={state.meta.dueSoonDays}
              onChange={(e) => updateMeta({ dueSoonDays: Math.max(0, Number(e.target.value)) })}
              className="w-full rounded border bg-transparent p-2 text-sm outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
          </Field>
        </div>
      </Card>

      <Card title="DISPLAY">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Theme
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Switch between light and dark mode across the whole app.
            </p>
          </div>
          <div className="flex gap-1.5">
            <ThemeButton label="Light" active={theme === 'light'} onClick={() => theme === 'dark' && toggleTheme()} />
            <ThemeButton label="Dark" active={theme === 'dark'} onClick={() => theme === 'light' && toggleTheme()} />
          </div>
        </div>
      </Card>

      <Card title="ABOUT THIS SYSTEM">
        <div className="flex gap-3 rounded-lg border-l-4 p-3 text-sm" style={{ borderColor: 'var(--brand-primary)', background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
          <Info size={18} className="mt-0.5 shrink-0" color="var(--brand-primary)" />
          <p>
            All scores, statuses, forecasts and rankings across this DMS are derived automatically from the daily
            actuals entered on <strong>KPI Data Entry</strong> — nothing else is manually maintained. KPI targets,
            weights and definitions live in <strong>Master Data</strong>. Use <strong>Data Management</strong> on the
            Master Data page to export or import the full dataset, or reset back to the original sample.
          </p>
        </div>
      </Card>
    </div>
  );
}

function ThemeButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg px-3 py-1.5 text-xs font-bold transition"
      style={{
        background: active ? 'var(--brand-primary)' : 'transparent',
        color: active ? '#fff' : 'var(--text-secondary)',
        border: active ? 'none' : '1px solid var(--border)',
      }}
    >
      {label}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      {children}
      {hint && (
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {hint}
        </span>
      )}
    </label>
  );
}
