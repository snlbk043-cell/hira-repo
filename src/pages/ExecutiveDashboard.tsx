import { useMemo } from 'react';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { CheckCircle2, ListChecks, Printer, TimerReset } from 'lucide-react';
import { FilterBar } from '../components/FilterBar';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Gauge } from '../components/ui/Gauge';
import { StatusBadge, TrendBadge } from '../components/ui/StatusBadge';
import { useAppStore } from '../state/AppStore';
import { TODAY, useComputedKpis } from '../lib/useComputed';
import {
  departmentSummaries,
  heatmap,
  pillarSummaries,
  plantDayTrend,
  rankByFocusScore,
  scorecard,
} from '../lib/calc';
import { fmtPercent, fmtSignedNumber, fmtUnitValue, scoreColor } from '../lib/format';
import type { PQSDC } from '../types';

export function ExecutiveDashboard() {
  const { state, filters } = useAppStore();
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

  const included = useMemo(() => kpis.filter((k) => k.included), [kpis]);

  const top10Exceptions = useMemo(
    () =>
      [...included]
        .filter((k) => k.status !== 'No Data')
        .sort((a, b) => b.focusScore - a.focusScore)
        .slice(0, 10),
    [included],
  );

  const dayRanked = useMemo(
    () =>
      [...included]
        .filter((k) => k.selectedDayScore !== null)
        .sort((a, b) => (a.selectedDayScore! - b.selectedDayScore!)),
    [included],
  );
  const worst10 = dayRanked.slice(0, 10);
  const best10 = [...dayRanked].reverse().slice(0, 10);

  const openActionRows = useMemo(
    () => [...included].filter((k) => k.openAction).sort((a, b) => b.overdueDays - a.overdueDays),
    [included],
  );

  const chartData = trend.map((p) => ({
    day: p.day,
    score: p.score !== null ? Math.round(p.score * 1000) / 10 : null,
    momentum: p.momentum3 !== null ? Math.round(p.momentum3 * 1000) / 10 : null,
  }));

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

      {/* Department cards */}
      <Card title="EXECUTIVE SCORECARD — DEPARTMENT PERFORMANCE" subtitle="KPI count, weighted MTD pace score, completion and open actions by department">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {deptSummaries.map((d) => (
            <div
              key={d.department}
              className="rounded-lg border p-3"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
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
            </div>
          ))}
        </div>
      </Card>

      {/* PQSDC pillars */}
      <Card title="PQSDC PILLAR CARDS" subtitle="Weighted MTD pace score by pillar (Productivity, Quality, Safety, Delivery, Cost)">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {pillarSums.map((p) => (
            <div
              key={p.pillar}
              className="flex items-center gap-3 rounded-lg border p-3"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
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
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        {/* Plant score trend */}
        <Card
          className="xl:col-span-3"
          title="PLANT SCORE TREND — DAY BY DAY"
          subtitle="Weighted daily score vs 100% target, with 3-day momentum"
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} stroke="var(--border-strong)" />
                <YAxis
                  domain={[0, 130]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  stroke="var(--border-strong)"
                  width={44}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value) => `${value}%`}
                  labelFormatter={(l) => `Day ${l}`}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="score" name="Daily score" stroke="var(--series-blue)" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                <Line
                  type="monotone"
                  dataKey="momentum"
                  name="3-day momentum"
                  stroke="var(--series-orange)"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
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
          <DayRankTable rows={worst10} />
        </Card>
        <Card title={`SELECTED DAY ${filters.day} — BEST 10`} subtitle="Highest scoring KPIs for the selected day">
          <DayRankTable rows={best10} />
        </Card>
      </div>

      {/* Risk & action analysis */}
      <Card title="RISK, ACTION AND COMPLETION ANALYSIS" subtitle="Open corrective actions across departments, ranked by days overdue">
        {openActionRows.length === 0 ? (
          <p className="py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            No open actions for the current filter selection.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-xs">
              <thead>
                <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
                  <Th>KPI</Th>
                  <Th>Department</Th>
                  <Th>PQSDC</Th>
                  <Th>Status</Th>
                  <Th>Action Owner</Th>
                  <Th>Support Dept</Th>
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
                    <Td>{k.def.pqsdc}</Td>
                    <Td>
                      <StatusBadge status={k.status} />
                    </Td>
                    <Td>{k.rec.actionOwner ?? '—'}</Td>
                    <Td>{k.rec.supportDepartment ?? '—'}</Td>
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
  );
}

function ExceptionsTable({
  rows,
  ranks,
}: {
  rows: ReturnType<typeof useComputedKpis>['kpis'];
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
      <table className="w-full min-w-[980px] border-collapse text-xs">
        <thead>
          <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
            <Th>Rank</Th>
            <Th>Department</Th>
            <Th>PQSDC</Th>
            <Th>KPI</Th>
            <Th align="right">Daily Target</Th>
            <Th align="right">Day Actual</Th>
            <Th align="right">Day Score</Th>
            <Th align="right">MTD Actual</Th>
            <Th align="right">MTD Pace</Th>
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
              <Td>{k.def.pqsdc}</Td>
              <Td className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {k.def.name}
              </Td>
              <Td align="right" className="tabular-nums">
                {fmtUnitValue(k.effectiveDailyTarget, k.def.unit, 1)}
              </Td>
              <Td align="right" className="tabular-nums">
                {fmtUnitValue(k.selectedDayActual, k.def.unit, 1)}
              </Td>
              <Td align="right" className="tabular-nums" style={{ color: scoreColor(k.selectedDayScore) }}>
                {fmtPercent(k.selectedDayScore, 0)}
              </Td>
              <Td align="right" className="tabular-nums">
                {fmtUnitValue(k.mtdActual, k.def.unit, 1)}
              </Td>
              <Td align="right" className="tabular-nums" style={{ color: scoreColor(k.mtdPaceScore) }}>
                {fmtPercent(k.mtdPaceScore, 0)}
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

function DayRankTable({ rows }: { rows: ReturnType<typeof useComputedKpis>['kpis'] }) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        No data entered for the selected day.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-xs">
        <thead>
          <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
            <Th>Department</Th>
            <Th>KPI</Th>
            <Th align="right">Actual</Th>
            <Th align="right">Score</Th>
            <Th align="right">Gap</Th>
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
