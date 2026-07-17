import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FilterBar } from '../components/FilterBar';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { Gauge } from '../components/ui/Gauge';
import { ForecastBadge, StatusBadge, TrendBadge } from '../components/ui/StatusBadge';
import { useAppStore } from '../state/AppStore';
import { useComputedKpis } from '../lib/useComputed';
import { departmentSummaries, pillarSummaries, heatmap } from '../lib/calc';
import { fmtPercent, fmtUnitValue, scoreColor } from '../lib/format';
import type { PQSDC } from '../types';

export function DepartmentPerformance() {
  const { state } = useAppStore();
  const { kpis } = useComputedKpis();
  const [selectedDept, setSelectedDept] = useState('All');

  const deptSummaries = useMemo(
    () => departmentSummaries(kpis, state.masterLists.departments),
    [kpis, state.masterLists.departments],
  );
  const pillarSums = useMemo(
    () => pillarSummaries(kpis, state.masterLists.pillars as PQSDC[]),
    [kpis, state.masterLists.pillars],
  );
  const heat = useMemo(
    () => heatmap(kpis, state.masterLists.departments, state.masterLists.pillars as PQSDC[]),
    [kpis, state.masterLists.departments, state.masterLists.pillars],
  );

  const scopedKpis = useMemo(
    () =>
      kpis.filter(
        (k) => k.included && (selectedDept === 'All' || k.def.department === selectedDept),
      ),
    [kpis, selectedDept],
  );

  const plantPace = useMemo(() => {
    const rows = kpis.filter((k) => k.included && (selectedDept === 'All' || k.def.department === selectedDept));
    let num = 0;
    let den = 0;
    for (const r of rows) {
      if (r.mtdPaceScore === null) continue;
      num += r.mtdPaceScore * r.def.weight;
      den += r.def.weight;
    }
    return den === 0 ? null : num / den;
  }, [kpis, selectedDept]);

  const barData = deptSummaries.map((d) => ({
    department: d.department,
    score: d.score !== null ? Math.round(d.score * 1000) / 10 : 0,
  }));

  const maxHeat = Math.max(0.01, ...heat.map((c) => c.score ?? 0));

  return (
    <div className="flex flex-col gap-5 pb-10">
      <PageHeader
        title="Enterprise Department Performance — KPI Pace, Forecast & Control"
        subtitle="Lean daily management view · daily target breakdown · MTD pace · end-of-month forecast · heat map · exception control"
      />

      <FilterBar />

      <div className="no-print flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Focus Department
          </span>
          <div className="flex flex-wrap gap-1.5">
            {['All', ...state.masterLists.departments].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDept(d)}
                className="rounded-full border px-3 py-1 text-xs font-medium transition"
                style={{
                  borderColor: selectedDept === d ? 'var(--brand-primary)' : 'var(--border)',
                  background: selectedDept === d ? 'var(--brand-primary)' : 'transparent',
                  color: selectedDept === d ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="flex flex-col items-center justify-center gap-2 py-6" title="MTD PACE SCORE">
          <Gauge value={plantPace} size={120} strokeWidth={12} color={scoreColor(plantPace)} />
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {selectedDept === 'All' ? 'All departments' : selectedDept} · weighted vs expected MTD target
          </p>
        </Card>

        <Card className="lg:col-span-2" title="DEPARTMENT MTD SCORE COMPARISON">
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 5, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="department" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} stroke="var(--border-strong)" interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis domain={[0, 120]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} stroke="var(--border-strong)" width={44} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [`${v}%`, 'MTD Score']}
                />
                <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {barData.map((d) => (
                    <Cell key={d.department} fill={scoreColor(d.score / 100)} fillOpacity={d.department === selectedDept ? 1 : 0.55} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="PQSDC PILLAR CARDS — SPECIFIC MTD PACE TO EXPECTED TARGET">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {pillarSums.map((p) => (
            <div key={p.pillar} className="flex items-center gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
              <Gauge value={p.score} size={52} strokeWidth={6} color={scoreColor(p.score)} />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {p.pillar}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {p.kpis} KPIs · {p.attention} attention
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="DYNAMIC HEAT MAP — DEPARTMENT × PQSDC" subtitle="Master-data driven, weighted MTD pace score">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-xs">
            <thead>
              <tr style={{ background: 'var(--brand-primary)' }}>
                <th className="p-1.5 text-left" />
                {state.masterLists.pillars.map((p) => (
                  <th key={p} className="p-1.5 text-center text-xs font-semibold" style={{ color: '#fff' }}>
                    {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.masterLists.departments.map((dept) => (
                <tr key={dept}>
                  <td className="whitespace-nowrap p-1 pr-2 font-medium" style={{ color: 'var(--text-primary)' }}>
                    {dept}
                  </td>
                  {state.masterLists.pillars.map((pillar) => {
                    const found = heat.find((c) => c.department === dept && c.pillar === pillar);
                    const s = found?.score ?? null;
                    const intensity = s === null ? 0 : Math.min(1, s / Math.max(maxHeat, 1));
                    const bg = s === null ? 'transparent' : `color-mix(in srgb, ${scoreColor(s)} ${Math.round(20 + intensity * 55)}%, var(--surface-1))`;
                    return (
                      <td key={pillar} className="p-1 text-center">
                        <div
                          className="tabular-nums flex h-10 items-center justify-center rounded-md text-xs font-semibold"
                          style={{ background: bg, color: s === null ? 'var(--text-muted)' : 'var(--text-primary)' }}
                        >
                          {s === null ? '—' : fmtPercent(s, 0)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="FILTERED KPI MASTER DETAIL"
        subtitle="Powered by the calculation engine — effective daily target, forecast at end-of-month, and trend/forecast signal"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-xs">
            <thead>
              <tr className="sticky top-0 z-10 text-left text-xs" style={{ background: 'var(--brand-primary)', color: '#fff' }}>
                <th className="px-2 py-2 font-semibold">KPI</th>
                <th className="px-2 py-2 font-semibold">Department</th>
                <th className="px-2 py-2 font-semibold">PQSDC</th>
                <th className="px-2 py-2 text-right font-semibold">Daily Target</th>
                <th className="px-2 py-2 text-right font-semibold">MTD Actual</th>
                <th className="px-2 py-2 text-right font-semibold">Expected MTD</th>
                <th className="px-2 py-2 text-right font-semibold">Forecast EOM</th>
                <th className="px-2 py-2 text-right font-semibold">MTD Pace</th>
                <th className="px-2 py-2 font-semibold">Forecast Signal</th>
                <th className="px-2 py-2 font-semibold">Trend</th>
                <th className="px-2 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {[...scopedKpis]
                .sort((a, b) => (a.mtdPaceScore ?? 0) - (b.mtdPaceScore ?? 0))
                .map((k) => (
                  <tr key={k.def.kpiId} className="border-t" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-2 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>
                      {k.def.name}
                    </td>
                    <td className="px-2 py-2" style={{ color: 'var(--text-secondary)' }}>
                      {k.def.department}
                    </td>
                    <td className="px-2 py-2" style={{ color: 'var(--text-secondary)' }}>
                      {k.def.pqsdc}
                    </td>
                    <td className="tabular-nums px-2 py-2 text-right" style={{ color: 'var(--text-secondary)' }}>
                      {fmtUnitValue(k.effectiveDailyTarget, k.def.unit, 1)}
                    </td>
                    <td className="tabular-nums px-2 py-2 text-right" style={{ color: 'var(--text-secondary)' }}>
                      {fmtUnitValue(k.mtdActual, k.def.unit, 1)}
                    </td>
                    <td className="tabular-nums px-2 py-2 text-right" style={{ color: 'var(--text-secondary)' }}>
                      {fmtUnitValue(k.expectedMtdTarget, k.def.unit, 1)}
                    </td>
                    <td className="tabular-nums px-2 py-2 text-right" style={{ color: 'var(--text-secondary)' }}>
                      {fmtUnitValue(k.forecastEom, k.def.unit, 1)}
                    </td>
                    <td className="tabular-nums px-2 py-2 text-right" style={{ color: scoreColor(k.mtdPaceScore) }}>
                      {fmtPercent(k.mtdPaceScore, 0)}
                    </td>
                    <td className="px-2 py-2">
                      <ForecastBadge signal={k.forecastSignal} />
                    </td>
                    <td className="px-2 py-2">
                      <TrendBadge trend={k.trend} />
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={k.status} />
                    </td>
                  </tr>
                ))}
              {scopedKpis.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>
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
}
