import { useState, type ReactNode } from 'react';
import { useAppStore } from '../state/AppStore';
import type { Aggregation, Direction, KpiDefinition, PQSDC } from '../types';

export function AddKpiModal({
  onClose,
  onAdd,
  existingIds,
}: {
  onClose: () => void;
  onAdd: ReturnType<typeof useAppStore>['addKpi'];
  existingIds: string[];
}) {
  const { state, filters } = useAppStore();
  const [form, setForm] = useState({
    kpiId: '',
    department: state.masterLists.departments[0],
    pqsdc: state.masterLists.pillars[0] as PQSDC,
    name: '',
    unit: '%',
    direction: 'Higher Better' as Direction,
    aggregation: 'Average' as Aggregation,
    target: 100,
    recoveryLimit: 90,
    weight: 1,
    owner: '',
  });
  const [error, setError] = useState('');

  const submit = () => {
    if (!form.kpiId.trim() || !form.name.trim()) {
      setError('KPI ID and Name are required.');
      return;
    }
    if (existingIds.includes(form.kpiId.trim())) {
      setError('KPI ID already exists.');
      return;
    }
    const def: KpiDefinition = { ...form, kpiId: form.kpiId.trim(), owner: form.owner || `${form.department} Manager` };
    onAdd(def, {
      recordId: `KPI-${Date.now()}`,
      year: filters.year,
      month: filters.month,
      monthNo: state.masterLists.months.indexOf(filters.month) + 1,
      days: Array(31).fill(null),
      challengeReason: '',
      recoveryPlan: '',
      supportRequired: 'No',
      supportDepartment: null,
      actionOwner: null,
      dueDate: null,
      actionStatus: null,
      priority: null,
      hodRemarks: '',
      lastUpdated: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl border p-5 shadow-xl"
        style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
      >
        <h2 className="text-base font-bold" style={{ color: 'var(--brand-primary)' }}>
          Add new KPI
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="KPI ID">
            <input
              value={form.kpiId}
              onChange={(e) => setForm({ ...form, kpiId: e.target.value.toUpperCase() })}
              className="w-full rounded border bg-transparent p-2 text-xs outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              placeholder="e.g. PROD-S-002"
            />
          </Field>
          <Field label="KPI Name">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded border bg-transparent p-2 text-xs outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
          </Field>
          <Field label="Department">
            <select
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="w-full rounded border bg-transparent p-2 text-xs outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            >
              {state.masterLists.departments.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </Field>
          <Field label="PQSDC">
            <select
              value={form.pqsdc}
              onChange={(e) => setForm({ ...form, pqsdc: e.target.value as PQSDC })}
              className="w-full rounded border bg-transparent p-2 text-xs outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            >
              {state.masterLists.pillars.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label="Unit">
            <select
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="w-full rounded border bg-transparent p-2 text-xs outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            >
              {state.masterLists.units.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </Field>
          <Field label="Direction">
            <select
              value={form.direction}
              onChange={(e) => setForm({ ...form, direction: e.target.value as Direction })}
              className="w-full rounded border bg-transparent p-2 text-xs outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            >
              {state.masterLists.directions.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </Field>
          <Field label="Aggregation">
            <select
              value={form.aggregation}
              onChange={(e) => setForm({ ...form, aggregation: e.target.value as Aggregation })}
              className="w-full rounded border bg-transparent p-2 text-xs outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            >
              {state.masterLists.aggregations.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </Field>
          <Field label="Weight">
            <input
              type="number"
              step="0.1"
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
              className="w-full rounded border bg-transparent p-2 text-xs outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
          </Field>
          <Field label="Target">
            <input
              type="number"
              value={form.target}
              onChange={(e) => setForm({ ...form, target: Number(e.target.value) })}
              className="w-full rounded border bg-transparent p-2 text-xs outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
          </Field>
          <Field label="Recovery Limit">
            <input
              type="number"
              value={form.recoveryLimit}
              onChange={(e) => setForm({ ...form, recoveryLimit: Number(e.target.value) })}
              className="w-full rounded border bg-transparent p-2 text-xs outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
          </Field>
          <Field label="Owner">
            <input
              value={form.owner}
              onChange={(e) => setForm({ ...form, owner: e.target.value })}
              placeholder={`${form.department} Manager`}
              className="w-full rounded border bg-transparent p-2 text-xs outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
          </Field>
        </div>
        {error && (
          <p className="mt-2 text-xs" style={{ color: 'var(--status-critical)' }}>
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="rounded-lg px-3 py-1.5 text-sm font-bold text-white shadow-sm transition hover:brightness-95"
            style={{ background: 'var(--brand-primary)' }}
          >
            Add KPI
          </button>
        </div>
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
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
