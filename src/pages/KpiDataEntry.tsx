import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Sparkline } from '../components/ui/Sparkline';
import { Field } from '../components/AddKpiModal';
import { useAppStore } from '../state/AppStore';
import { useComputedKpis } from '../lib/useComputed';
import { fmtPercent, fmtUnitValue, scoreColor } from '../lib/format';
import type { ActionStatus, Priority } from '../types';

export function KpiDataEntry() {
  const { state, filters, setFilters, updateDay, updateRecord } = useAppStore();
  const { kpis } = useComputedKpis();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(() => {
    return kpis
      .filter((k) => k.rec.year === filters.year && k.rec.month === filters.month)
      .filter((k) => filters.department === 'All' || k.def.department === filters.department)
      .filter((k) => filters.pqsdc === 'All' || k.def.pqsdc === filters.pqsdc)
      .filter((k) => filters.status === 'All' || k.status === filters.status)
      .filter(
        (k) =>
          !search ||
          k.def.name.toLowerCase().includes(search.toLowerCase()) ||
          k.def.kpiId.toLowerCase().includes(search.toLowerCase()) ||
          k.def.owner.toLowerCase().includes(search.toLowerCase()),
      )
      .sort((a, b) => a.def.department.localeCompare(b.def.department) || a.def.name.localeCompare(b.def.name));
  }, [kpis, filters, search]);

  return (
    <div className="flex flex-col gap-5 pb-10">
      <PageHeader
        title="DMS KPI Data Entry — Master Table"
        subtitle="HODs: filter your department and month, enter Day 1–31 actuals, and update recovery / action details for exceptions. Adding or removing KPIs is done from Settings."
      />

      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect label="Year" value={String(filters.year)} onChange={(v) => setFilters({ year: Number(v) })} options={state.masterLists.years.map(String)} />
        <FilterSelect label="Month" value={filters.month} onChange={(v) => setFilters({ month: v })} options={state.masterLists.months} />
        <FilterSelect
          label="Department"
          value={filters.department}
          onChange={(v) => setFilters({ department: v })}
          options={['All', ...state.masterLists.departments]}
        />
        <FilterSelect
          label="PQSDC"
          value={filters.pqsdc}
          onChange={(v) => setFilters({ pqsdc: v })}
          options={['All', ...state.masterLists.pillars]}
        />
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(v) => setFilters({ status: v })}
          options={['All', 'Achieved', 'Watch', 'Action Needed', 'Support Required', 'No Data']}
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="KPI, ID or owner…"
              className="w-40 bg-transparent text-sm outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>
        </label>
        <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
          {rows.length} of {kpis.length} KPIs shown
        </span>
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr style={{ background: 'var(--brand-primary)' }}>
                <Th sticky className="w-6" />
                <Th sticky className="min-w-[190px]">KPI</Th>
                <Th className="min-w-[110px]">Department</Th>
                <Th className="min-w-[130px]">PQSDC</Th>
                <Th align="right" className="min-w-[80px]">Target</Th>
                {Array.from({ length: 31 }, (_, i) => (
                  <Th key={i} align="right" className="min-w-[64px]">
                    D{i + 1}
                  </Th>
                ))}
                <Th align="right" className="min-w-[90px]">MTD Actual</Th>
                <Th align="right" className="min-w-[90px]">Achv %</Th>
                <Th className="min-w-[90px]">Trend</Th>
                <Th className="min-w-[130px]">Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((k) => (
                <React.Fragment key={k.def.kpiId}>
                  <tr className="border-t" style={{ borderColor: 'var(--border)' }}>
                    <Td sticky>
                      <button
                        type="button"
                        onClick={() => setExpanded(expanded === k.def.kpiId ? null : k.def.kpiId)}
                        className="flex h-5 w-5 items-center justify-center rounded hover:opacity-70"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {expanded === k.def.kpiId ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    </Td>
                    <Td sticky className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {k.def.name}
                      <div className="text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>
                        {k.def.kpiId}
                      </div>
                    </Td>
                    <Td>{k.def.department}</Td>
                    <Td>{k.def.pqsdc}</Td>
                    <Td align="right" className="tabular-nums">
                      {fmtUnitValue(k.def.target, k.def.unit, 1)}
                    </Td>
                    {k.rec.days.map((val, i) => (
                      <Td key={i} align="right" className="p-0.5">
                        <input
                          type="number"
                          value={val ?? ''}
                          onChange={(e) =>
                            updateDay(k.rec.recordId, i, e.target.value === '' ? null : Number(e.target.value))
                          }
                          className="tabular-nums w-14 rounded border bg-transparent px-1 py-1 text-right text-xs outline-none focus:border-(--series-blue)"
                          style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                        />
                      </Td>
                    ))}
                    <Td align="right" className="tabular-nums font-medium" style={{ color: 'var(--text-primary)' }}>
                      {fmtUnitValue(k.mtdActual, k.def.unit, 1)}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {fmtPercent(k.achievementPct, 0)}
                    </Td>
                    <Td>
                      <Sparkline data={k.rec.days} color={scoreColor(k.mtdPaceScore)} />
                    </Td>
                    <Td>
                      <StatusBadge status={k.status} />
                    </Td>
                  </tr>
                  {expanded === k.def.kpiId && (
                    <tr>
                      <td colSpan={38} className="border-t p-0" style={{ borderColor: 'var(--border)' }}>
                        <DetailPanel kpiId={k.def.kpiId} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={38} className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No KPIs match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  function DetailPanel({ kpiId }: { kpiId: string }) {
    const rec = state.kpiRecords.find((r) => r.kpiId === kpiId);
    if (!rec) return null;
    return (
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4" style={{ background: 'var(--surface-2)' }}>
        <Field label="Challenge / Reason">
          <textarea
            value={rec.challengeReason}
            onChange={(e) => updateRecord(rec.recordId, { challengeReason: e.target.value })}
            className="w-full rounded border bg-transparent p-2 text-xs outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            rows={2}
          />
        </Field>
        <Field label="Recovery Plan">
          <textarea
            value={rec.recoveryPlan}
            onChange={(e) => updateRecord(rec.recordId, { recoveryPlan: e.target.value })}
            className="w-full rounded border bg-transparent p-2 text-xs outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            rows={2}
          />
        </Field>
        <Field label="HOD Remarks">
          <textarea
            value={rec.hodRemarks}
            onChange={(e) => updateRecord(rec.recordId, { hodRemarks: e.target.value })}
            className="w-full rounded border bg-transparent p-2 text-xs outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            rows={2}
          />
        </Field>
        <Field label="Support Required?">
          <select
            value={rec.supportRequired}
            onChange={(e) => updateRecord(rec.recordId, { supportRequired: e.target.value as 'Yes' | 'No' })}
            className="w-full rounded border bg-transparent p-2 text-xs outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >
            <option>No</option>
            <option>Yes</option>
          </select>
        </Field>
        <Field label="Support Department">
          <select
            value={rec.supportDepartment ?? ''}
            onChange={(e) => updateRecord(rec.recordId, { supportDepartment: e.target.value || null })}
            className="w-full rounded border bg-transparent p-2 text-xs outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >
            <option value="">—</option>
            {state.masterLists.departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Action Owner">
          <input
            value={rec.actionOwner ?? ''}
            onChange={(e) => updateRecord(rec.recordId, { actionOwner: e.target.value || null })}
            className="w-full rounded border bg-transparent p-2 text-xs outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          />
        </Field>
        <Field label="Due Date">
          <input
            type="date"
            value={rec.dueDate ? rec.dueDate.slice(0, 10) : ''}
            onChange={(e) => updateRecord(rec.recordId, { dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
            className="w-full rounded border bg-transparent p-2 text-xs outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          />
        </Field>
        <Field label="Action Status">
          <select
            value={rec.actionStatus ?? ''}
            onChange={(e) => updateRecord(rec.recordId, { actionStatus: (e.target.value || null) as ActionStatus | null })}
            className="w-full rounded border bg-transparent p-2 text-xs outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >
            <option value="">—</option>
            {state.masterLists.actionStatuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Priority">
          <select
            value={rec.priority ?? ''}
            onChange={(e) => updateRecord(rec.recordId, { priority: (e.target.value || null) as Priority | null })}
            className="w-full rounded border bg-transparent p-2 text-xs outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >
            <option value="">—</option>
            {state.masterLists.priorities.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
      </div>
    );
  }
}

function FilterSelect({
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

function Th({
  children,
  align = 'left',
  className,
  sticky,
}: {
  children?: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
  sticky?: boolean;
}) {
  return (
    <th
      className={`whitespace-nowrap px-2 py-2 text-[11px] font-semibold ${align === 'right' ? 'text-right' : 'text-left'} ${className ?? ''} ${sticky ? 'sticky left-0 z-10' : ''}`}
      style={{ color: '#fff', background: sticky ? 'var(--brand-primary)' : undefined }}
    >
      {children}
    </th>
  );
}
function Td({
  children,
  align = 'left',
  className,
  style,
  sticky,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
  style?: React.CSSProperties;
  sticky?: boolean;
}) {
  return (
    <td
      className={`px-2 py-1.5 ${align === 'right' ? 'text-right' : 'text-left'} ${className ?? ''} ${sticky ? 'sticky left-0 z-10' : ''}`}
      style={{ color: 'var(--text-secondary)', background: sticky ? 'var(--surface-1)' : undefined, ...style }}
    >
      {children}
    </td>
  );
}
