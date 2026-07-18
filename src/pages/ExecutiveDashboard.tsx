import { useMemo, useState } from 'react';
import { CheckCircle2, Info, ListChecks, Printer, TimerReset } from 'lucide-react';
import { FilterBar } from '../components/FilterBar';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Gauge } from '../components/ui/Gauge';
import { StatusBadge, TrendBadge } from '../components/ui/StatusBadge';
import { Sparkline } from '../components/ui/Sparkline';
import { InsightsCard } from '../components/ui/InsightsCard';
import { DrillDownModal, DrillDownSection, DrillDownTable } from '../components/ui/DrillDownModal';
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
import { fmtPercent, fmtUnitValue, scoreColor } from '../lib/format';
import type { ComputedKpi } from '../lib/calc';
import type { KpiStatus, PQSDC } from '../types';

type ModalState =
  | { kind: 'mtd' }
  | { kind: 'day' }
  | { kind: 'completion' }
  | { kind: 'scope' }
  | { kind: 'statusMix' }
  | { kind: 'actions' }
  | { kind: 'department'; dept: string }
  | { kind: 'pillar'; pillar: string };

export function ExecutiveDashboard() {
  const { state, filters, setFilters } = useAppStore();
  const { kpis, dim } = useComputedKpis();
  const [modal, setModal] = useState<ModalState | null>(null);

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

  const visible = useMemo(() => kpis.filter((k) => k.included), [kpis]);

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

  const trendSummary = useMemo(() => buildTrendSummary(trend, filters.day), [trend, filters.day]);

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
        <GaugeTile label="MTD Plant Score" value={sc.mtdPlantScore} onClick={() => setModal({ kind: 'mtd' })} />
        <GaugeTile label={`Day ${filters.day} Score`} value={sc.selectedDayScore} onClick={() => setModal({ kind: 'day' })} />
        <GaugeTile label="Data Completion" value={sc.dataCompletion} color="var(--series-blue)" onClick={() => setModal({ kind: 'completion' })} />
        <StatCard
          label="KPIs in Scope"
          value={sc.kpisInScope}
          sub={`${state.masterLists.departments.length} departments`}
          icon={<ListChecks size={16} />}
          onClick={() => setModal({ kind: 'scope' })}
        />
        <StatCard
          label="Achieved"
          value={sc.statusCounts.Achieved}
          color="var(--status-good)"
          sub={`${sc.statusCounts.Watch} watch · ${sc.statusCounts['Action Needed']} action needed`}
          icon={<CheckCircle2 size={16} />}
          onClick={() => setModal({ kind: 'statusMix' })}
        />
        <StatCard
          label="Open / Overdue Actions"
          value={`${sc.openActions} / ${sc.overdueActions}`}
          color={sc.overdueActions > 0 ? 'var(--status-critical)' : 'var(--text-primary)'}
          sub={`${sc.statusCounts['Support Required']} support required`}
          icon={<TimerReset size={16} />}
          onClick={() => setModal({ kind: 'actions' })}
        />
      </div>

      {/* Performance intelligence: donut + radar */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="KPI STATUS MIX" subtitle="Click a segment to filter every table below by that status">
          <StatusDonutChart counts={sc.statusCounts} onSliceClick={(status: KpiStatus) => setFilters({ status })} />
        </Card>
        <Card title="PQSDC PILLAR SHAPE" subtitle="MTD pace score across all five pillars at a glance">
          <PillarRadarChart data={pillarSums} />
        </Card>
      </div>

      {/* Department cards */}
      <Card title="EXECUTIVE SCORECARD — DEPARTMENT PERFORMANCE" subtitle="Click a card to filter, or the ⓘ icon to see exactly how its score was calculated">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {deptSummaries.map((d) => (
            <div
              key={d.department}
              className="relative rounded-lg border p-3 transition hover:shadow-md"
              style={{
                borderColor: filters.department === d.department ? 'var(--brand-primary)' : 'var(--border)',
                background: 'var(--surface-2)',
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setModal({ kind: 'department', dept: d.department });
                }}
                className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full transition hover:bg-black/10"
                style={{ color: 'var(--brand-primary)' }}
                title="How was this calculated?"
              >
                <Info size={13} />
              </button>
              <button
                type="button"
                onClick={() => setFilters({ department: filters.department === d.department ? 'All' : d.department })}
                className="w-full text-left"
              >
                <p className="truncate pr-5 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
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
            </div>
          ))}
        </div>
      </Card>

      {/* PQSDC pillars */}
      <Card title="PQSDC PILLAR CARDS" subtitle="Weighted MTD pace score by pillar — click a card to filter, or the ⓘ icon for the breakdown">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {pillarSums.map((p) => (
            <div
              key={p.pillar}
              className="relative flex items-center gap-3 rounded-lg border p-3 transition hover:shadow-md"
              style={{
                borderColor: filters.pqsdc === p.pillar ? 'var(--brand-primary)' : 'var(--border)',
                background: 'var(--surface-2)',
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setModal({ kind: 'pillar', pillar: p.pillar });
                }}
                className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full transition hover:bg-black/10"
                style={{ color: 'var(--brand-primary)' }}
                title="How was this calculated?"
              >
                <Info size={13} />
              </button>
              <button
                type="button"
                onClick={() => setFilters({ pqsdc: filters.pqsdc === p.pillar ? 'All' : p.pillar })}
                className="flex w-full items-center gap-3 text-left"
              >
                <Gauge value={p.score} size={56} strokeWidth={7} color={scoreColor(p.score)} />
                <div className="min-w-0 pr-4">
                  <p className="truncate text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {p.pillar}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {p.kpis} KPIs · {p.attention} attention
                  </p>
                </div>
              </button>
            </div>
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
          <PlantTrendChart trend={trend} selectedDay={filters.day} target={state.meta.plantScoreTarget} />
          <div
            className="mt-3 rounded-lg border-l-4 p-3 text-xs leading-relaxed"
            style={{ borderColor: 'var(--brand-primary)', background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
          >
            <strong style={{ color: 'var(--text-primary)' }}>Trend summary: </strong>
            {trendSummary}
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

      {/* Narrative review */}
      <Card title="REVIEW NARRATIVE — WHAT THE NUMBERS ARE SAYING" subtitle="Auto-written from the live data above, for meeting-ready reading">
        <InsightsCard insights={insights} />
      </Card>

      {/* Top 10 exceptions */}
      <Card
        title={`FACTORY MANAGER FOCUS — DAY ${filters.day} TOP 10 KPI EXCEPTIONS`}
        subtitle="Ranked by focus score: status severity + MTD pace gap + overdue action days"
      >
        <ExceptionsTable rows={top10Exceptions} ranks={ranks} />
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
              <table className="w-full min-w-[860px] border-collapse text-xs">
                <thead>
                  <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
                    <Th>KPI</Th>
                    <Th>Department</Th>
                    <Th>PQSDC</Th>
                    <Th>Status</Th>
                    <Th>Support Needed</Th>
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
                      <Td>{k.def.pqsdc}</Td>
                      <Td>
                        <StatusBadge status={k.status} />
                      </Td>
                      <Td>
                        {k.rec.supportRequired === 'Yes'
                          ? k.rec.supportDepartment
                            ? `${k.rec.supportDepartment} support`
                            : 'Support required'
                          : '—'}
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

      {modal && (
        <ExecutiveModal
          modal={modal}
          onClose={() => setModal(null)}
          visible={visible}
          deptSummaries={deptSummaries}
          pillarSums={pillarSums}
          sc={sc}
          trend={trend}
          filters={filters}
          openActionRows={openActionRows}
        />
      )}
    </div>
  );
}

function GaugeTile({
  label,
  value,
  color,
  onClick,
}: {
  label: string;
  value: number | null;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 rounded-xl border py-4 text-center transition duration-300 hover:shadow-lg hover:-translate-y-0.5"
      style={{
        background: 'linear-gradient(160deg, var(--surface-1) 55%, var(--surface-2) 100%)',
        borderColor: 'var(--border)',
      }}
    >
      <Gauge value={value} color={color ?? scoreColor(value)} />
      <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: 'var(--brand-primary)' }}>
        <Info size={11} /> Click for details
      </span>
    </button>
  );
}

function buildTrendSummary(trend: ReturnType<typeof plantDayTrend>, selectedDay: number): string {
  const points = trend.filter((p) => p.score !== null);
  if (points.length === 0) return 'No daily scores have been entered yet this month.';
  const selected = trend.find((p) => p.day === selectedDay);
  const last3 = points.filter((p) => p.day <= selectedDay).slice(-3);
  const first = last3[0];
  const last = last3[last3.length - 1];
  const direction =
    last3.length >= 2 && first.score !== null && last.score !== null
      ? last.score > first.score
        ? 'climbing'
        : last.score < first.score
          ? 'slipping'
          : 'flat'
      : 'not yet established';
  const dayScoreText =
    selected?.score !== null && selected?.score !== undefined ? `${Math.round(selected.score * 100)}%` : 'not entered';
  const momentumText =
    selected?.momentum3 !== null && selected?.momentum3 !== undefined ? `${Math.round(selected.momentum3 * 100)}%` : '—';
  return `Day ${selectedDay}'s daily score is ${dayScoreText}, while the 3-day momentum line (the trailing average of the last up-to-3 entered days) sits at ${momentumText}. The daily score reacts immediately to that single day's entries and can swing sharply; momentum smooths that noise so you can see the underlying direction. Over the last three entered days the trend is ${direction} — read the daily line for "what happened today" and the momentum line for "which way we're really heading."`;
}

function ExecutiveModal({
  modal,
  onClose,
  visible,
  deptSummaries,
  pillarSums,
  sc,
  trend,
  filters,
  openActionRows,
}: {
  modal: ModalState;
  onClose: () => void;
  visible: ComputedKpi[];
  deptSummaries: ReturnType<typeof departmentSummaries>;
  pillarSums: ReturnType<typeof pillarSummaries>;
  sc: ReturnType<typeof scorecard>;
  trend: ReturnType<typeof plantDayTrend>;
  filters: { day: number };
  openActionRows: ComputedKpi[];
}) {
  if (modal.kind === 'mtd') {
    const rows = visible
      .filter((k) => k.mtdPaceScore !== null)
      .map((k) => ({ k, contribution: k.mtdPaceScore! * k.def.weight }))
      .sort((a, b) => b.contribution - a.contribution);
    const totalWeight = rows.reduce((a, r) => a + r.k.def.weight, 0);
    return (
      <DrillDownModal title={`MTD Plant Score — ${fmtPercent(sc.mtdPlantScore, 1)}`} onClose={onClose} wide>
        <DrillDownSection title="How this number is calculated">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Each in-scope KPI has an <strong>MTD Pace Score</strong> — its month-to-date actual measured against the
            target expected by this point in the month, capped at 120%. The Plant Score is the{' '}
            <strong>weight-average of every KPI's pace score</strong>: Σ(pace score × weight) ÷ Σ(weight), across all{' '}
            {rows.length} scored KPIs (total weight {totalWeight.toFixed(1)}). Rows below are sorted by how much each
            KPI is pulling the average up or down.
          </p>
        </DrillDownSection>
        <DrillDownSection title={`Contributing KPIs (${rows.length})`}>
          <DrillDownTable
            columns={['KPI', 'Department', 'Weight', 'MTD Pace', 'Weighted']}
            rows={rows.map(({ k, contribution }) => [
              k.def.name,
              k.def.department,
              k.def.weight.toFixed(1),
              fmtPercent(k.mtdPaceScore, 0),
              contribution.toFixed(2),
            ])}
          />
        </DrillDownSection>
      </DrillDownModal>
    );
  }

  if (modal.kind === 'day') {
    const rows = visible
      .filter((k) => k.selectedDayScore !== null)
      .map((k) => ({ k, contribution: k.selectedDayScore! * k.def.weight }))
      .sort((a, b) => b.contribution - a.contribution);
    const last3days = trend.filter((p) => p.day <= filters.day).slice(-3);
    return (
      <DrillDownModal title={`Day ${filters.day} Score — ${fmtPercent(sc.selectedDayScore, 1)}`} onClose={onClose} wide>
        <DrillDownSection title="How this number is calculated">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            For the selected day, every KPI's single-day actual is scored against its <strong>effective daily
            target</strong> (the monthly target prorated to a day for cumulative metrics, or the target itself for
            average-type metrics). The Day Score is the weight-average of those {rows.length} day scores.
          </p>
        </DrillDownSection>
        <DrillDownSection title="Last 3 entered days — plant score momentum">
          <div className="flex gap-3">
            {last3days.map((p, i) => {
              const prev = last3days[i - 1];
              const arrow =
                !prev || prev.score === null || p.score === null
                  ? '—'
                  : p.score > prev.score
                    ? '▲'
                    : p.score < prev.score
                      ? '▼'
                      : '●';
              return (
                <div
                  key={p.day}
                  className="flex-1 rounded-lg border p-3 text-center"
                  style={{ borderColor: p.day === filters.day ? 'var(--brand-primary)' : 'var(--border)', background: 'var(--surface-2)' }}
                >
                  <p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>
                    Day {p.day} {p.day === filters.day ? '(selected)' : ''}
                  </p>
                  <p className="tabular-nums mt-1 text-lg font-bold" style={{ color: scoreColor(p.score) }}>
                    {p.score !== null ? `${Math.round(p.score * 100)}%` : '—'} <span className="text-sm">{arrow}</span>
                  </p>
                </div>
              );
            })}
          </div>
        </DrillDownSection>
        <DrillDownSection title={`Contributing KPIs (${rows.length})`}>
          <DrillDownTable
            columns={['KPI', 'Department', 'Day Actual', 'Daily Target', 'Day Score']}
            rows={rows.map(({ k }) => [
              k.def.name,
              k.def.department,
              fmtUnitValue(k.selectedDayActual, k.def.unit, 1),
              fmtUnitValue(k.effectiveDailyTarget, k.def.unit, 1),
              fmtPercent(k.selectedDayScore, 0),
            ])}
          />
        </DrillDownSection>
      </DrillDownModal>
    );
  }

  if (modal.kind === 'completion') {
    const rows = [...visible].sort((a, b) => a.completionPct - b.completionPct);
    return (
      <DrillDownModal title={`Data Completion — ${fmtPercent(sc.dataCompletion, 1)}`} onClose={onClose} wide>
        <DrillDownSection title="How this number is calculated">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            For each KPI: days actually entered ÷ days elapsed so far this month (not the full month — a KPI with
            every day filled in up to today is 100% complete even mid-month). Data Completion is the plain average of
            that ratio across all {visible.length} in-scope KPIs. KPIs with the most missing days are listed first.
          </p>
        </DrillDownSection>
        <DrillDownSection title="Completion by KPI">
          <DrillDownTable
            columns={['KPI', 'Department', 'Days Entered', 'Completion']}
            rows={rows.map((k) => [k.def.name, k.def.department, String(k.daysEntered), fmtPercent(k.completionPct, 0)])}
          />
        </DrillDownSection>
      </DrillDownModal>
    );
  }

  if (modal.kind === 'scope') {
    return (
      <DrillDownModal title={`${sc.kpisInScope} KPIs in Scope`} onClose={onClose} wide>
        <DrillDownSection title="How this is counted">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Every KPI whose Department, PQSDC pillar, Status, Owner, Trend and search filters currently match is "in
            scope." Here's the breakdown by department, including how many have already reached Achieved status.
          </p>
        </DrillDownSection>
        <DrillDownTable
          columns={['Department', 'KPIs', 'Achieved', 'Watch', 'Action Needed', 'Support Required']}
          rows={deptSummaries.map((d) => {
            const rows = visible.filter((k) => k.def.department === d.department);
            return [
              d.department,
              String(d.kpis),
              String(rows.filter((k) => k.status === 'Achieved').length),
              String(rows.filter((k) => k.status === 'Watch').length),
              String(rows.filter((k) => k.status === 'Action Needed').length),
              String(rows.filter((k) => k.status === 'Support Required').length),
            ];
          })}
        />
      </DrillDownModal>
    );
  }

  if (modal.kind === 'statusMix') {
    const order: KpiStatus[] = ['Support Required', 'Action Needed', 'Watch', 'Achieved', 'No Data'];
    const rows = [...visible].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
    return (
      <DrillDownModal
        title="KPI Status Mix — full list"
        subtitle={`${sc.statusCounts.Achieved} Achieved · ${sc.statusCounts.Watch} Watch · ${sc.statusCounts['Action Needed']} Action Needed · ${sc.statusCounts['Support Required']} Support Required`}
        onClose={onClose}
        wide
      >
        <DrillDownSection title="How status is decided">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Achieved = MTD actual meets target. Watch = missed target but still within the recovery limit. Action
            Needed = outside the recovery limit. Support Required = the KPI owner has flagged it as needing
            cross-functional help, regardless of score. Every KPI below is exactly one of those.
          </p>
        </DrillDownSection>
        <DrillDownTable
          columns={['KPI', 'Department', 'MTD Actual', 'MTD Pace', 'Status']}
          rows={rows.map((k) => [
            k.def.name,
            k.def.department,
            fmtUnitValue(k.mtdActual, k.def.unit, 1),
            fmtPercent(k.mtdPaceScore, 0),
            <StatusBadge key="s" status={k.status} />,
          ])}
        />
      </DrillDownModal>
    );
  }

  if (modal.kind === 'actions') {
    return (
      <DrillDownModal
        title={`${sc.openActions} Open Actions · ${sc.overdueActions} Overdue`}
        onClose={onClose}
        wide
      >
        <DrillDownSection title="What counts as open">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            A KPI has an open action when it has a due date logged and its Action Status isn't Completed. It's
            overdue once that due date has passed.
          </p>
        </DrillDownSection>
        <DrillDownTable
          columns={['KPI', 'Department', 'Status', 'Owner', 'Due Date', 'Overdue Days', 'Action Status']}
          rows={openActionRows.map((k) => [
            k.def.name,
            k.def.department,
            <StatusBadge key="s" status={k.status} />,
            k.rec.actionOwner ?? '—',
            k.rec.dueDate ? new Date(k.rec.dueDate).toLocaleDateString('en-IN') : '—',
            k.overdueDays > 0 ? String(k.overdueDays) : '—',
            k.rec.actionStatus ?? '—',
          ])}
        />
      </DrillDownModal>
    );
  }

  if (modal.kind === 'department') {
    const rows = visible.filter((k) => k.def.department === modal.dept);
    const summary = deptSummaries.find((d) => d.department === modal.dept);
    return (
      <DrillDownModal title={`${modal.dept} — ${fmtPercent(summary?.score ?? null, 1)} MTD Pace Score`} onClose={onClose} wide>
        <DrillDownSection title="How this department's score is calculated">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Weight-average of the MTD Pace Score of {modal.dept}'s {rows.length} KPIs — the same formula as the Plant
            Score, scoped to this department only.
          </p>
        </DrillDownSection>
        <DrillDownTable
          columns={['KPI', 'PQSDC', 'MTD Actual', 'Target', 'Weight', 'MTD Pace', 'Status']}
          rows={rows.map((k) => [
            k.def.name,
            k.def.pqsdc,
            fmtUnitValue(k.mtdActual, k.def.unit, 1),
            fmtUnitValue(k.def.target, k.def.unit, 1),
            k.def.weight.toFixed(1),
            fmtPercent(k.mtdPaceScore, 0),
            <StatusBadge key="s" status={k.status} />,
          ])}
        />
      </DrillDownModal>
    );
  }

  // pillar
  const rows = visible.filter((k) => k.def.pqsdc === modal.pillar);
  const summary = pillarSums.find((p) => p.pillar === modal.pillar);
  return (
    <DrillDownModal title={`${modal.pillar} — ${fmtPercent(summary?.score ?? null, 1)} MTD Pace Score`} onClose={onClose} wide>
      <DrillDownSection title="How this pillar's score is calculated">
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Weight-average of the MTD Pace Score of every KPI tagged {modal.pillar} across all departments —{' '}
          {rows.length} KPIs, weighted the same way as the Plant Score.
        </p>
      </DrillDownSection>
      <DrillDownTable
        columns={['KPI', 'Department', 'MTD Actual', 'Target', 'Weight', 'MTD Pace', 'Status']}
        rows={rows.map((k) => [
          k.def.name,
          k.def.department,
          fmtUnitValue(k.mtdActual, k.def.unit, 1),
          fmtUnitValue(k.def.target, k.def.unit, 1),
          k.def.weight.toFixed(1),
          fmtPercent(k.mtdPaceScore, 0),
          <StatusBadge key="s" status={k.status} />,
        ])}
      />
    </DrillDownModal>
  );
}

function ExceptionsTable({ rows, ranks }: { rows: ComputedKpi[]; ranks: Map<string, number> }) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        No exceptions for the current filter selection.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1360px] border-collapse text-xs">
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
            <Th>Month</Th>
            <Th>Status</Th>
            <Th>Trend</Th>
            <Th>Challenge / Reason</Th>
            <Th>Recovery Plan</Th>
            <Th>Action Owner</Th>
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
                <Sparkline data={k.rec.days} color={scoreColor(k.mtdPaceScore)} />
              </Td>
              <Td>
                <StatusBadge status={k.status} />
              </Td>
              <Td>
                <TrendBadge trend={k.trend} />
              </Td>
              <Td className="max-w-[150px] truncate" title={k.rec.challengeReason}>
                {k.rec.challengeReason || '—'}
              </Td>
              <Td className="max-w-[160px] truncate" title={k.rec.recoveryPlan}>
                {k.rec.recoveryPlan || '—'}
              </Td>
              <Td>{k.rec.actionOwner ?? '—'}</Td>
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
      <table className="w-full min-w-[900px] border-collapse text-xs">
        <thead>
          <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
            <Th>Department</Th>
            <Th>PQSDC</Th>
            <Th>KPI</Th>
            <Th align="right">Day Target</Th>
            <Th align="right">Day Actual</Th>
            <Th align="right">Day Score</Th>
            <Th align="right">MTD Actual</Th>
            <Th align="right">MTD Target</Th>
            <Th align="right">MTD Pace</Th>
            <Th>Month</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((k) => (
            <tr key={k.def.kpiId} className="border-t" style={{ borderColor: 'var(--border)' }}>
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
              <Td align="right" className="tabular-nums">
                {fmtUnitValue(k.def.target, k.def.unit, 1)}
              </Td>
              <Td align="right" className="tabular-nums" style={{ color: scoreColor(k.mtdPaceScore) }}>
                {fmtPercent(k.mtdPaceScore, 0)}
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
