import { useMemo } from 'react';
import { CheckCircle2, ListChecks, Printer, TimerReset } from 'lucide-react';
import { FilterBar } from '../components/FilterBar';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Gauge } from '../components/ui/Gauge';
import { StatusBadge, TrendBadge } from '../components/ui/StatusBadge';
import { Sparkline } from '../components/ui/Sparkline';
import { InsightsCard } from '../components/ui/InsightsCard';
import { PillarRadarChart } from '../components/charts/PillarRadarChart';
import { StatusDonutChart } from '../components/charts/StatusDonutChart';
import { PlantTrendChart } from '../components/charts/PlantTrendChart';
import { ActionPipelineChart } from '../components/charts/ActionPipelineChart';
import { useAppStore } from '../state/AppStore';
import { TODAY, useComputedKpis } from '../lib/useComputed';
import {
  actionStatusCounts,
  departmentSummaries,
  heatmap,
  pillarSummaries,
  plantDayTrend,
  rankByFocusScore,
  scorecard,
} from '../lib/calc';
import { generateInsights } from '../lib/narrative';
import { fmtPercent, fmtSignedNumber, fmtUnitValue, scoreColor } from '../lib/format';
import type { ComputedKpi } from '../lib/calc';
import type { KpiStatus, PQSDC } from '../types';

export function ExecutiveDashboard() {
  const { state, filters, setFilters } = useAppStore();
  const { kpis, dim } = useComputedKpis();

  const sc = useMemo(() => scorecard(kpis), [kpis]);
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
  const trend = useMemo(() => plantDayTrend(kpis, dim), [kpis, dim]);
  const ranks = useMemo(() => rankByFocusScore(kpis), [kpis]);
  const pipelineCounts = useMemo(
    () => actionStatusCounts(kpis, state.masterLists.actionStatuses),
    [kpis, state.masterLists.actionStatuses],
  );
  const insights = useMemo(
    () => generateInsights({ kpis, deptSummaries, pillarSums, month: filters.month, day: filters.day }),
    [kpis, deptSummaries, pillarSums, filters.month, filters.day],
  );

  const search = filters.search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      kpis.filter(
        (k) =>
          k.included &&
          (filters.owner === 'All' || k.def.owner === filters.owner) &&
          (filters.trend === 'All' || k.trend === filters.trend) &&
          (!search || k.def.name.toLowerCase().includes(search) || k.def.kpiId.toLowerCase().includes(search)),
      ),
    [kpis, filters.owner, filters.trend, search],
  );

  const top10Exceptions = useMemo(
    () =>
      [...visible]
        .filter((k) => k.status !== 'No Data')
        .sort((a, b) => b.focusScore - a.focusScore)
        .slice(0, 10),
    [visible],
  );

  const dayRanked = useMemo(
    () =>
      [...visible]
        .filter((k) => k.selectedDayScore !== null)
        .sort((a, b) => a.selectedDayScore! - b.selectedDayScore!),
    [visible],
  );
  const worst10 = dayRanked.slice(0, 10);
  const best10 = [...dayRanked].reverse().slice(0, 10);

  const openActionRows = useMemo(
    () => [...visible].filter((k) => k.openAction).sort((a, b) => b.overdueDays - a.overdueDays),
    [visible],
  );

  const maxHeat = Math.max(0.01, ...heat.map((c) => c.score ?? 0));

  return (
    <div className="flex flex-col gap-5 pb-10">
      <PageHeader
        title="RCPL Factory Daily Management System — Executive Review"
        subtitle="Interactive day and month review · one master KPI entry table · deep performance, trend, exception and action analysis"
        actions={
          <button
            type="button"
            onClick={() => window.print()}
            className="no-print flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-white/25"
          >
            <Printer size={16} /> Print / Export PDF
          </button>
        }
      />

      <FilterBar />

      {/* Executive scorecard */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Card padded={false} className="flex flex-col items-center justify-center gap-2 py-4">
          <Gauge value={sc.mtdPlantScore} color={scoreColor(sc.mtdPlantScore)} />
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            MTD Plant Score
          </span>
        </Card>
        <Card padded={false} className="flex flex-col items-center justify-center gap-2 py-4">
          <Gauge value={sc.selectedDayScore} color={scoreColor(sc.selectedDayScore)} />
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Day {filters.day} Score
          </span>
        </Card>
        <Card padded={false} className="flex flex-col items-center justify-center gap-2 py-4">
          <Gauge value={sc.dataCompletion} color="var(--series-blue)" />
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Data Completion
          </span>
        </Card>
        <StatCard
          label="KPIs in Scope"
          value={sc.kpisInScope}
          sub={`${state.masterLists.departments.length} departments`}
          icon={<ListChecks size={16} />}
        />
        <StatCard
          label="Achieved"
          value={sc.statusCounts.Achieved}
          color="var(--status-good)"
          sub={`${sc.statusCounts.Watch} watch · ${sc.statusCounts['Action Needed']} action needed`}
          icon={<CheckCircle2 size={16} />}
        />
        <StatCard
          label="Open / Overdue Actions"
          value={`${sc.openActions} / ${sc.overdueActions}`}
          color={sc.overdueActions > 0 ? 'var(--status-critical)' : 'var(--text-primary)'}
          sub={`${sc.statusCounts['Support Required']} support required`}
          icon={<TimerReset size={16} />}
        />
      </div>

      {/* Performance intelligence: donut + radar */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card
          title="KPI STATUS MIX"
          subtitle="Click a segment to filter every table below by that status"
        >
          <StatusDonutChart counts={sc.statusCounts} onSliceClick={(status: KpiStatus) => setFilters({ status })} />
        </Card>
        <Card title="PQSDC PILLAR SHAPE" subtitle="MTD pace score across all five pillars at a glance">
          <PillarRadarChart data={pillarSums} />
        </Card>
      </div>

      {/* Department cards */}
      <Card title="EXECUTIVE SCORECARD — DEPARTMENT PERFORMANCE" subtitle="KPI count, weighted MTD pace score, completion and open actions by department">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {deptSummaries.map((d) => (
            <button
              type="button"
              key={d.department}
              onClick={() => setFilters({ department: filters.department === d.department ? 'All' : d.department })}
              className="rounded-lg border p-3 text-left transition hover:shadow-md"
              style={{
                borderColor: filters.department === d.department ? 'var(--brand-primary)' : 'var(--border)',
                background: 'var(--surface-2)',
              }}
            >
              <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {d.department}
              </p>
              <p className="tabular-nums mt-1 text-lg font-bold" style={{ color: scoreColor(d.score) }}>
                {fmtPercent(d.score, 0)}
              </p>
              <div className="mt-1 flex items-center justify-between text-[11px]" style={{ color: 'var(--text-muted)' }}>
                <span>{d.kpis} KPIs</span>
                <span>{d.achieved} achieved</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px]" style={{ color: 'var(--text-muted)' }}>
                <span>{fmtPercent(d.completion, 0)} complete</span>
                <span style={{ color: d.openActions > 0 ? 'var(--status-critical)' : 'var(--text-muted)' }}>
                  {d.openActions} open
                </span>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* PQSDC pillars */}
      <Card title="PQSDC PILLAR CARDS" subtitle="Weighted MTD pace score by pillar (Productivity, Quality, Safety, Delivery, Cost)">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {pillarSums.map((p) => (
            <button
              type="button"
              key={p.pillar}
              onClick={() => setFilters({ pqsdc: filters.pqsdc === p.pillar ? 'All' : p.pillar })}
              className="flex items-center gap-3 rounded-lg border p-3 text-left transition hover:shadow-md"
              style={{
                borderColor: filters.pqsdc === p.pillar ? 'var(--brand-primary)' : 'var(--border)',
                background: 'var(--surface-2)',
              }}
            >
              <Gauge value={p.score} size={56} strokeWidth={7} color={scoreColor(p.score)} />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {p.pillar}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {p.kpis} KPIs · {p.attention} attention
                </p>
              </div>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        {/* Plant score trend */}
        <Card
          className="xl:col-span-3"
          title="PLANT SCORE TREND — DAY BY DAY"
          subtitle={`Weighted daily score vs 100% target, with 3-day momentum — the red marker tracks your selected Day ${filters.day}`}
        >
          <PlantTrendChart trend={trend} selectedDay={filters.day} />
        </Card>

        {/* Heat map */}
        <Card className="xl:col-span-2" title="DYNAMIC HEAT MAP" subtitle="Department × PQSDC weighted MTD pace score">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-xs">
              <thead>
                <tr>
                  <th className="p-1 text-left" style={{ color: 'var(--text-muted)' }} />
                  {state.masterLists.pillars.map((p) => (
                    <th key={p} className="p-1 text-center font-medium" style={{ color: 'var(--text-muted)' }}>
                      {p.split(' ')[0]}
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
                      const bg =
                        s === null
                          ? 'transparent'
                          : `color-mix(in srgb, ${scoreColor(s)} ${Math.round(20 + intensity * 55)}%, var(--surface-1))`;
                      return (
                        <td key={pillar} className="p-1 text-center">
                          <div
                            className="tabular-nums flex h-9 items-center justify-center rounded-md text-[11px] font-semibold"
                            style={{ background: bg, color: s === null ? 'var(--text-muted)' : 'var(--text-primary)' }}
                            title={found ? `${dept} × ${pillar}: ${fmtPercent(s, 0)} (${found.kpis} KPIs)` : ''}
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
      </div>

      {/* Narrative review */}
      <Card title="REVIEW NARRATIVE — WHAT THE NUMBERS ARE SAYING" subtitle="Auto-written from the live data above, for meeting-ready reading">
        <InsightsCard insights={insights} />
      </Card>

      {/* Top 10 exceptions */}
      <Card
        title={`FACTORY MANAGER FOCUS — DAY ${filters.day} TOP 10 KPI EXCEPTIONS`}
        subtitle="Ranked by focus score: status severity + MTD pace gap + overdue action days"
      >
        <ExceptionsTable rows={top10Exceptions} day={filters.day} ranks={ranks} />
      </Card>

      {/* Best/worst 10 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title={`SELECTED DAY ${filters.day} — WORST 10`} subtitle="Lowest scoring KPIs for the selected day">
          <DayRankTable rows={worst10} day={filters.day} />
        </Card>
        <Card title={`SELECTED DAY ${filters.day} — BEST 10`} subtitle="Highest scoring KPIs for the selected day">
          <DayRankTable rows={best10} day={filters.day} />
        </Card>
      </div>

      {/* Risk & action analysis */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        <Card className="xl:col-span-2" title="ACTION STATUS PIPELINE" subtitle="Open corrective actions by stage">
          <ActionPipelineChart data={pipelineCounts} />
        </Card>
        <Card className="xl:col-span-3" title="RISK, ACTION AND COMPLETION ANALYSIS" subtitle="Open corrective actions across departments, ranked by days overdue">
          {openActionRows.length === 0 ? (
            <p className="py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No open actions for the current filter selection.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-xs">
                <thead>
                  <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
                    <Th>KPI</Th>
                    <Th>Department</Th>
                    <Th>Status</Th>
                    <Th>Action Owner</Th>
                    <Th>Due Date</Th>
                    <Th align="right">Overdue / Due Soon</Th>
                    <Th>Action Status</Th>
                    <Th>Priority</Th>
                  </tr>
                </thead>
                <tbody>
                  {openActionRows.map((k) => (
                    <tr key={k.def.kpiId} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <Td className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {k.def.name}
                      </Td>
                      <Td>{k.def.department}</Td>
                      <Td>
                        <StatusBadge status={k.status} />
                      </Td>
                      <Td>{k.rec.actionOwner ?? '—'}</Td>
                      <Td>{k.rec.dueDate ? new Date(k.rec.dueDate).toLocaleDateString('en-IN') : '—'}</Td>
                      <Td align="right" className="tabular-nums">
                        <DueCell dueDate={k.rec.dueDate} overdueDays={k.overdueDays} dueSoonDays={state.meta.dueSoonDays} />
                      </Td>
                      <Td>{k.rec.actionStatus ?? '—'}</Td>
                      <Td>{k.rec.priority ?? '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function ExceptionsTable({
  rows,
  ranks,
}: {
  rows: ComputedKpi[];
  day: number;
  ranks: Map<string, number>;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        No exceptions for the current filter selection.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] border-collapse text-xs">
        <thead>
          <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
            <Th>Rank</Th>
            <Th>Department</Th>
            <Th>KPI</Th>
            <Th align="right">Day Score</Th>
            <Th align="right">MTD Pace</Th>
            <Th>Month Trend</Th>
            <Th>Status</Th>
            <Th>Trend</Th>
            <Th>Challenge / Reason</Th>
            <Th>Recovery Plan</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((k) => (
            <tr key={k.def.kpiId} className="border-t" style={{ borderColor: 'var(--border)' }}>
              <Td className="tabular-nums font-semibold" style={{ color: 'var(--text-primary)' }}>
                {ranks.get(k.def.kpiId) ?? '—'}
              </Td>
              <Td>{k.def.department}</Td>
              <Td className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {k.def.name}
              </Td>
              <Td align="right" className="tabular-nums" style={{ color: scoreColor(k.selectedDayScore) }}>
                {fmtPercent(k.selectedDayScore, 0)}
              </Td>
              <Td align="right" className="tabular-nums" style={{ color: scoreColor(k.mtdPaceScore) }}>
                {fmtPercent(k.mtdPaceScore, 0)}
              </Td>
              <Td>
                <Sparkline data={k.rec.days} color={scoreColor(k.mtdPaceScore)} />
              </Td>
              <Td>
                <StatusBadge status={k.status} />
              </Td>
              <Td>
                <TrendBadge trend={k.trend} />
              </Td>
              <Td className="max-w-[160px] truncate" title={k.rec.challengeReason}>
                {k.rec.challengeReason || '—'}
              </Td>
              <Td className="max-w-[180px] truncate" title={k.rec.recoveryPlan}>
                {k.rec.recoveryPlan || '—'}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DayRankTable({ rows, day }: { rows: ComputedKpi[]; day: number }) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        No data entered for the selected day.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] border-collapse text-xs">
        <thead>
          <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
            <Th>Department</Th>
            <Th>KPI</Th>
            <Th align="right">Actual</Th>
            <Th align="right">Score</Th>
            <Th align="right">Gap</Th>
            <Th>Month</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((k) => (
            <tr key={k.def.kpiId} className="border-t" style={{ borderColor: 'var(--border)' }}>
              <Td>{k.def.department}</Td>
              <Td className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {k.def.name}
              </Td>
              <Td align="right" className="tabular-nums">
                {fmtUnitValue(k.selectedDayActual, k.def.unit, 1)}
              </Td>
              <Td align="right" className="tabular-nums" style={{ color: scoreColor(k.selectedDayScore) }}>
                {fmtPercent(k.selectedDayScore, 0)}
              </Td>
              <Td align="right" className="tabular-nums">
                {fmtSignedNumber(k.selectedDayGap, 1)}
              </Td>
              <Td>
                <Sparkline data={k.rec.days} color={scoreColor(k.mtdPaceScore)} highlightIndex={day - 1} />
              </Td>
              <Td>
                <StatusBadge status={k.selectedDayStatus} />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DueCell({
  dueDate,
  overdueDays,
  dueSoonDays,
}: {
  dueDate: string | null;
  overdueDays: number;
  dueSoonDays: number;
}) {
  if (overdueDays > 0) {
    return (
      <span className="font-semibold" style={{ color: 'var(--status-critical)' }}>
        {overdueDays}d overdue
      </span>
    );
  }
  if (dueDate) {
    const due = new Date(dueDate);
    const dueMidnight = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
    const todayMidnight = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate()).getTime();
    const daysUntil = Math.round((dueMidnight - todayMidnight) / 86400000);
    if (daysUntil >= 0 && daysUntil <= dueSoonDays) {
      return (
        <span className="font-semibold" style={{ color: 'var(--status-warning)' }}>
          Due in {daysUntil}d
        </span>
      );
    }
  }
  return <span style={{ color: 'var(--text-secondary)' }}>—</span>;
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={`sticky top-0 z-10 whitespace-nowrap px-2 py-2 text-xs font-semibold ${align === 'right' ? 'text-right' : 'text-left'}`}
      style={{ background: 'var(--brand-primary)', color: '#fff' }}
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
  title,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}) {
  return (
    <td
      title={title}
      className={`px-2 py-2 ${align === 'right' ? 'text-right' : 'text-left'} ${className ?? ''}`}
      style={{ color: 'var(--text-secondary)', ...style }}
    >
      {children}
    </td>
  );
}
