import { useAppStore } from '../state/AppStore';
import { daysInMonth } from '../lib/calc';
import { TODAY } from '../lib/useComputed';

const STATUS_OPTIONS = ['All', 'Achieved', 'Watch', 'Action Needed', 'Support Required', 'No Data'];

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border px-2.5 py-1.5 text-sm outline-none"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterBar() {
  const { filters, setFilters, state } = useAppStore();
  const monthNo = state.masterLists.months.indexOf(filters.month) + 1;
  const dim = daysInMonth(filters.year, monthNo || 7);
  const dayOptions = Array.from({ length: dim }, (_, i) => String(i + 1));

  return (
    <div
      className="flex flex-wrap items-end gap-3 rounded-xl border p-3"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
    >
      <Select
        label="Year"
        value={String(filters.year)}
        onChange={(v) => setFilters({ year: Number(v) })}
        options={state.masterLists.years.map(String)}
      />
      <Select label="Month" value={filters.month} onChange={(v) => setFilters({ month: v })} options={state.masterLists.months} />
      <Select
        label="Department"
        value={filters.department}
        onChange={(v) => setFilters({ department: v })}
        options={['All', ...state.masterLists.departments]}
      />
      <Select
        label="PQSDC"
        value={filters.pqsdc}
        onChange={(v) => setFilters({ pqsdc: v })}
        options={['All', ...state.masterLists.pillars]}
      />
      <Select label="Day" value={String(filters.day)} onChange={(v) => setFilters({ day: Number(v) })} options={dayOptions} />
      <Select label="Status" value={filters.status} onChange={(v) => setFilters({ status: v })} options={STATUS_OPTIONS} />
      <div className="ml-auto flex flex-col gap-1 text-right">
        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Last data update
        </span>
        <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          {new Date(state.meta.lastDataUpdate).toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
      <button
        type="button"
        onClick={() =>
          setFilters({
            year: 2026,
            month: 'July',
            department: 'All',
            pqsdc: 'All',
            day: TODAY.getDate(),
            status: 'All',
          })
        }
        className="rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:opacity-80"
        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
      >
        Reset filters
      </button>
    </div>
  );
}
