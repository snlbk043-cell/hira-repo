import { Search } from 'lucide-react';
import { useAppStore } from '../state/AppStore';
import { daysInMonth } from '../lib/calc';
import { TODAY } from '../lib/useComputed';

const STATUS_OPTIONS = ['All', 'Achieved', 'Watch', 'Action Needed', 'Support Required', 'No Data'];
const TREND_OPTIONS = ['All', 'Improving', 'Deteriorating', 'Stable', 'Insufficient Data'];

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
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
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function opts(values: string[]): { value: string; label: string }[] {
  return values.map((v) => ({ value: v, label: v }));
}

export function FilterBar() {
  const { filters, setFilters, state } = useAppStore();
  const monthNo = state.masterLists.months.indexOf(filters.month) + 1;
  const dim = daysInMonth(filters.year, monthNo || 7);

  const monthRecords = state.kpiRecords.filter((r) => r.year === filters.year && r.month === filters.month);
  const dayOptions = Array.from({ length: dim }, (_, i) => {
    const hasData = monthRecords.some((r) => r.days[i] !== null && r.days[i] !== undefined);
    return { value: String(i + 1), label: hasData ? `Day ${i + 1}` : `Day ${i + 1} (no data)` };
  });

  return (
    <div
      className="no-print flex flex-wrap items-end gap-3 rounded-xl border p-3"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
    >
      <Select
        label="Year"
        value={String(filters.year)}
        onChange={(v) => setFilters({ year: Number(v) })}
        options={opts(state.masterLists.years.map(String))}
      />
      <Select label="Month" value={filters.month} onChange={(v) => setFilters({ month: v })} options={opts(state.masterLists.months)} />
      <Select
        label="Department"
        value={filters.department}
        onChange={(v) => setFilters({ department: v })}
        options={opts(['All', ...state.masterLists.departments])}
      />
      <Select
        label="PQSDC"
        value={filters.pqsdc}
        onChange={(v) => setFilters({ pqsdc: v })}
        options={opts(['All', ...state.masterLists.pillars])}
      />
      <Select label="Day" value={String(filters.day)} onChange={(v) => setFilters({ day: Number(v) })} options={dayOptions} />
      <Select label="Status" value={filters.status} onChange={(v) => setFilters({ status: v })} options={opts(STATUS_OPTIONS)} />
      <Select label="Trend" value={filters.trend} onChange={(v) => setFilters({ trend: v })} options={opts(TREND_OPTIONS)} />
      <Select
        label="Owner"
        value={filters.owner}
        onChange={(v) => setFilters({ owner: v })}
        options={opts(['All', ...state.masterLists.owners])}
      />
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Search
        </span>
        <div
          className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
        >
          <Search size={14} color="var(--text-muted)" />
          <input
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            placeholder="KPI or ID…"
            className="w-32 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
      </label>
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
            owner: 'All',
            trend: 'All',
            search: '',
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
