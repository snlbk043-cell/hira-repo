import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Building2,
  Database,
  Download,
  FileSpreadsheet,
  Info,
  ListChecks,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Upload,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { AddKpiModal, Field } from '../components/AddKpiModal';
import { useAppStore } from '../state/AppStore';
import type { AppState, Direction, Aggregation, PQSDC } from '../types';

const LIST_KEYS = [
  { key: 'departments', label: 'Departments' },
  { key: 'pillars', label: 'PQSDC Pillars' },
  { key: 'units', label: 'Units' },
  { key: 'owners', label: 'KPI Owners' },
  { key: 'actionStatuses', label: 'Action Status' },
  { key: 'priorities', label: 'Priority' },
] as const;

const TABS = [
  { id: 'general', label: 'Company & Display', icon: SlidersHorizontal },
  { id: 'lists', label: 'Departments & Lists', icon: Building2 },
  { id: 'kpis', label: 'KPI Definitions', icon: ListChecks },
  { id: 'data', label: 'Data Management', icon: Database },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function Settings() {
  const [tab, setTab] = useState<TabId>('general');

  return (
    <div className="flex flex-col gap-5 pb-10">
      <PageHeader
        title="Settings"
        subtitle="Your full customization control center — company details, departments, PQSDC pillars, KPI definitions, master lists and data management. Everything the rest of the app reads from lives here."
      />

      <div className="no-print flex flex-wrap gap-1.5 rounded-xl border p-1.5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition"
            style={{
              background: tab === id ? 'var(--brand-primary)' : 'transparent',
              color: tab === id ? '#fff' : 'var(--text-secondary)',
            }}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'general' && <GeneralTab />}
      {tab === 'lists' && <ListsTab />}
      {tab === 'kpis' && <KpisTab />}
      {tab === 'data' && <DataTab />}
    </div>
  );
}

function GeneralTab() {
  const { state, updateMeta, theme, toggleTheme } = useAppStore();
  return (
    <div className="flex flex-col gap-5">
      <Card title="COMPANY & PLANT" subtitle="Used on report covers, PDF/PowerPoint/Word exports and leadership sign-off defaults">
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
          <Field label="Plant Score Target (%)" hint="The reference line on the Plant Score Trend chart. Individual KPI targets are set per-KPI on the KPI Definitions tab.">
            <input
              type="number"
              min={0}
              max={200}
              value={state.meta.plantScoreTarget}
              onChange={(e) => updateMeta({ plantScoreTarget: Math.max(0, Number(e.target.value)) })}
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
            All scores, statuses, forecasts and rankings are derived automatically from the daily actuals entered on{' '}
            <strong>KPI Data Entry</strong> — nothing else is manually maintained. Departments, PQSDC pillars, KPI
            targets/weights/definitions and every dropdown list live right here in <strong>Settings</strong>.
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

function ListsTab() {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {LIST_KEYS.map(({ key, label }) => (
        <ListEditor key={key} label={label} listKey={key} />
      ))}
    </div>
  );
}

function ListEditor({ label, listKey }: { label: string; listKey: (typeof LIST_KEYS)[number]['key'] }) {
  const { state, updateMasterLists } = useAppStore();
  const [draft, setDraft] = useState('');
  const items = state.masterLists[listKey] as string[];

  const add = () => {
    const v = draft.trim();
    if (!v || items.includes(v)) return;
    updateMasterLists({ [listKey]: [...items, v] } as never);
    setDraft('');
  };
  const remove = (v: string) => {
    updateMasterLists({ [listKey]: items.filter((i) => i !== v) } as never);
  };

  return (
    <Card title={label.toUpperCase()}>
      <div className="flex flex-wrap gap-1.5">
        {items.map((v) => (
          <span
            key={v}
            className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            {v}
            <button type="button" onClick={() => remove(v)} className="hover:opacity-70" style={{ color: 'var(--status-critical)' }}>
              <Trash2 size={11} />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder={`Add ${label.toLowerCase().slice(0, -1) || label.toLowerCase()}…`}
          className="flex-1 rounded-lg border px-2.5 py-1.5 text-xs outline-none"
          style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', background: 'var(--surface-2)' }}
        />
        <button
          type="button"
          onClick={add}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-sm transition hover:brightness-95"
          style={{ background: 'var(--brand-primary)' }}
        >
          <Plus size={14} />
        </button>
      </div>
    </Card>
  );
}

function KpisTab() {
  const { state, updateDefinition, addKpi, removeKpi } = useAppStore();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <Card
      title="KPI DEFINITION MASTER"
      subtitle={`${state.kpiDefinitions.length} KPIs across ${state.masterLists.departments.length} departments and ${state.masterLists.pillars.length} PQSDC pillars — add, edit or remove any KPI here`}
      actions={
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:brightness-95"
          style={{ background: 'var(--brand-primary)' }}
        >
          <Plus size={14} /> Add KPI
        </button>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] border-collapse text-xs">
          <thead>
            <tr className="sticky top-0 z-10 text-left text-xs" style={{ background: 'var(--brand-primary)', color: '#fff' }}>
              <th className="px-2 py-2 font-semibold">KPI ID</th>
              <th className="px-2 py-2 font-semibold">Department</th>
              <th className="px-2 py-2 font-semibold">PQSDC</th>
              <th className="px-2 py-2 font-semibold">Name</th>
              <th className="px-2 py-2 font-semibold">Unit</th>
              <th className="px-2 py-2 font-semibold">Direction</th>
              <th className="px-2 py-2 font-semibold">Aggregation</th>
              <th className="px-2 py-2 text-right font-semibold">Target</th>
              <th className="px-2 py-2 text-right font-semibold">Recovery Limit</th>
              <th className="px-2 py-2 text-right font-semibold">Weight</th>
              <th className="px-2 py-2 font-semibold">Owner</th>
              <th className="px-2 py-2 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {state.kpiDefinitions.map((d) => (
              <tr key={d.kpiId} className="border-t" style={{ borderColor: 'var(--border)' }}>
                <td className="px-2 py-1.5 font-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  {d.kpiId}
                </td>
                <td className="px-2 py-1.5">
                  <EditableSelect value={d.department} options={state.masterLists.departments} onChange={(v) => updateDefinition(d.kpiId, { department: v })} />
                </td>
                <td className="px-2 py-1.5">
                  <EditableSelect value={d.pqsdc} options={state.masterLists.pillars} onChange={(v) => updateDefinition(d.kpiId, { pqsdc: v as PQSDC })} />
                </td>
                <td className="px-2 py-1.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                  <EditableText value={d.name} onChange={(v) => updateDefinition(d.kpiId, { name: v })} />
                </td>
                <td className="px-2 py-1.5">
                  <EditableSelect value={d.unit} options={state.masterLists.units} onChange={(v) => updateDefinition(d.kpiId, { unit: v })} />
                </td>
                <td className="px-2 py-1.5">
                  <EditableSelect value={d.direction} options={state.masterLists.directions} onChange={(v) => updateDefinition(d.kpiId, { direction: v as Direction })} />
                </td>
                <td className="px-2 py-1.5">
                  <EditableSelect value={d.aggregation} options={state.masterLists.aggregations} onChange={(v) => updateDefinition(d.kpiId, { aggregation: v as Aggregation })} />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <EditableNumber value={d.target} onChange={(v) => updateDefinition(d.kpiId, { target: v })} />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <EditableNumber value={d.recoveryLimit} onChange={(v) => updateDefinition(d.kpiId, { recoveryLimit: v })} />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <EditableNumber value={d.weight} step={0.1} onChange={(v) => updateDefinition(d.kpiId, { weight: v })} />
                </td>
                <td className="px-2 py-1.5">
                  <EditableSelect value={d.owner} options={state.masterLists.owners} onChange={(v) => updateDefinition(d.kpiId, { owner: v })} />
                </td>
                <td className="px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Remove ${d.name}? This deletes all its recorded data too.`)) removeKpi(d.kpiId);
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded hover:opacity-70"
                    style={{ color: 'var(--status-critical)' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showAdd && (
        <AddKpiModal onClose={() => setShowAdd(false)} onAdd={addKpi} existingIds={state.kpiDefinitions.map((d) => d.kpiId)} />
      )}
    </Card>
  );
}

function DataTab() {
  const { state, resetToSeed, importState } = useAppStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `rcpl-dms-state-${Date.now()}.json`);
  };

  const exportCSV = () => {
    const defsById = new Map(state.kpiDefinitions.map((d) => [d.kpiId, d]));
    const headers = [
      'KPI ID', 'Department', 'PQSDC', 'KPI Name', 'Unit', 'Direction', 'Aggregation', 'Target', 'Recovery Limit', 'Weight', 'Owner',
      ...Array.from({ length: 31 }, (_, i) => `Day ${i + 1}`),
      'Challenge / Reason', 'Recovery Plan', 'Support Required?', 'Action Owner', 'Due Date', 'Action Status', 'Priority',
    ];
    const rows = state.kpiRecords.map((r) => {
      const d = defsById.get(r.kpiId);
      if (!d) return [];
      return [
        d.kpiId, d.department, d.pqsdc, d.name, d.unit, d.direction, d.aggregation, d.target, d.recoveryLimit, d.weight, d.owner,
        ...r.days.map((v) => v ?? ''),
        r.challengeReason, r.recoveryPlan, r.supportRequired, r.actionOwner ?? '', r.dueDate ?? '', r.actionStatus ?? '', r.priority ?? '',
      ];
    });
    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv' }), `rcpl-kpi-data-entry-${Date.now()}.csv`);
  };

  const exportExcel = () => {
    const defsById = new Map(state.kpiDefinitions.map((d) => [d.kpiId, d]));
    const entryRows = state.kpiRecords.map((r) => {
      const d = defsById.get(r.kpiId);
      const base: Record<string, unknown> = {
        'Record ID': r.recordId,
        Year: r.year,
        Month: r.month,
        Department: d?.department,
        PQSDC: d?.pqsdc,
        'KPI ID': d?.kpiId,
        'KPI Name': d?.name,
        Unit: d?.unit,
        Direction: d?.direction,
        Aggregation: d?.aggregation,
        Target: d?.target,
        'Recovery Limit': d?.recoveryLimit,
        Weight: d?.weight,
        Owner: d?.owner,
      };
      r.days.forEach((v, i) => (base[`Day ${i + 1}`] = v ?? ''));
      base['Challenge / Reason'] = r.challengeReason;
      base['Recovery Plan'] = r.recoveryPlan;
      base['Support Required?'] = r.supportRequired;
      base['Action Owner'] = r.actionOwner ?? '';
      base['Due Date'] = r.dueDate ?? '';
      base['Action Status'] = r.actionStatus ?? '';
      base['Priority'] = r.priority ?? '';
      return base;
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(entryRows), 'KPI Data Entry');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.kpiDefinitions), 'KPI Definition Master');
    XLSX.writeFile(wb, `rcpl-dms-export-${Date.now()}.xlsx`);
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as AppState;
        if (!parsed.kpiDefinitions || !parsed.kpiRecords || !parsed.masterLists) {
          alert('Invalid state file.');
          return;
        }
        importState(parsed);
      } catch {
        alert('Could not parse JSON file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <Card title="DATA MANAGEMENT" subtitle="Export or restore the full DMS state — all KPI definitions, records and master lists">
      <div className="flex flex-wrap gap-2">
        <ActionButton icon={<Download size={14} />} label="Export JSON" variant="success" onClick={exportJSON} />
        <ActionButton icon={<FileSpreadsheet size={14} />} label="Export Excel" variant="success" onClick={exportExcel} />
        <ActionButton icon={<Download size={14} />} label="Export CSV" variant="success" onClick={exportCSV} />
        <ActionButton icon={<Upload size={14} />} label="Import JSON" variant="secondary" onClick={() => fileRef.current?.click()} />
        <ActionButton
          icon={<RotateCcw size={14} />}
          label="Reset to Sample Data"
          variant="danger"
          onClick={() => {
            if (confirm('Reset all data back to the original workbook sample? This cannot be undone.')) resetToSeed();
          }}
        />
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImport(f);
            e.target.value = '';
          }}
        />
      </div>
      <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        Report-ready PDF, PowerPoint and Word exports (with the leadership sign-off) are on the Leadership Review page.
      </p>
    </Card>
  );
}

function EditableText({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-40 rounded border-none bg-transparent px-1 py-0.5 text-xs outline-none focus:ring-1"
      style={{ color: 'var(--text-primary)' }}
    />
  );
}
function EditableNumber({ value, onChange, step = 1 }: { value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <input
      type="number"
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="tabular-nums w-16 rounded border-none bg-transparent px-1 py-0.5 text-right text-xs outline-none focus:ring-1"
      style={{ color: 'var(--text-primary)' }}
    />
  );
}
function EditableSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border-none bg-transparent px-1 py-0.5 text-xs outline-none"
      style={{ color: 'var(--text-secondary)' }}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  variant = 'primary',
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'success' | 'secondary' | 'danger';
}) {
  const colors = { primary: 'var(--brand-primary)', success: '#15803d', secondary: '#334155', danger: '#b91c1c' };
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:brightness-95"
      style={{ background: colors[variant] }}
    >
      {icon}
      {label}
    </button>
  );
}

function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
