import { useMemo, useState } from 'react';
import { Printer, Presentation, FileText } from 'lucide-react';
import { FilterBar } from '../components/FilterBar';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { Gauge } from '../components/ui/Gauge';
import { StatusBadge } from '../components/ui/StatusBadge';
import { InsightsCard } from '../components/ui/InsightsCard';
import { PillarRadarChart } from '../components/charts/PillarRadarChart';
import { useAppStore } from '../state/AppStore';
import { useComputedKpis } from '../lib/useComputed';
import { departmentSummaries, pillarSummaries, scorecard } from '../lib/calc';
import { generateInsights } from '../lib/narrative';
import { fmtPercent, scoreColor } from '../lib/format';
import { exportLeadershipDeck } from '../lib/exportPptx';
import { exportLeadershipDocx } from '../lib/exportWord';
import type { PQSDC } from '../types';

export function LeadershipReview() {
  const { state, filters, updateLeadershipReview } = useAppStore();
  const { kpis } = useComputedKpis();
  const [exporting, setExporting] = useState(false);

  const reviewKey = `${filters.year}-${filters.month}`;
  const review = state.leadershipReviews[reviewKey] ?? {
    reviewedBy: '',
    designation: '',
    reviewDate: null,
    comments: '',
    decision: '',
  };

  const sc = useMemo(() => scorecard(kpis), [kpis]);
  const deptSummaries = useMemo(
    () => departmentSummaries(kpis, state.masterLists.departments),
    [kpis, state.masterLists.departments],
  );
  const pillarSums = useMemo(
    () => pillarSummaries(kpis, state.masterLists.pillars as PQSDC[]),
    [kpis, state.masterLists.pillars],
  );
  const topExceptions = useMemo(
    () =>
      [...kpis]
        .filter((k) => k.included && k.status !== 'No Data')
        .sort((a, b) => b.focusScore - a.focusScore)
        .slice(0, 8),
    [kpis],
  );
  const insights = useMemo(
    () => generateInsights({ kpis, deptSummaries, pillarSums, month: filters.month, day: filters.day }),
    [kpis, deptSummaries, pillarSums, filters.month, filters.day],
  );

  const [exportingDocx, setExportingDocx] = useState(false);
  const handleExportDocx = async () => {
    setExportingDocx(true);
    try {
      await exportLeadershipDocx({
        state,
        filters,
        scorecard: sc,
        deptSummaries,
        pillarSums,
        topExceptions,
        insights,
        reviewedBy: review.reviewedBy,
        designation: review.designation,
        reviewDate: review.reviewDate,
        comments: review.comments,
        decision: review.decision,
      });
    } finally {
      setExportingDocx(false);
    }
  };

  const handleExportPptx = async () => {
    setExporting(true);
    try {
      await exportLeadershipDeck({
        state,
        filters,
        scorecard: sc,
        deptSummaries,
        pillarSums,
        topExceptions,
        reviewedBy: review.reviewedBy,
        designation: review.designation,
        reviewDate: review.reviewDate,
        comments: review.comments,
        decision: review.decision,
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-10">
      <PageHeader
        title="Leadership Review — Monthly Performance Sign-off"
        subtitle={`${state.meta.plantName} · consolidated executive summary for ${filters.month} ${filters.year}, reviewed against Day ${filters.day}`}
      />

      <FilterBar />

      <div className="no-print flex justify-end gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:brightness-95"
          style={{ background: '#334155' }}
        >
          <Printer size={16} /> Print / Export PDF
        </button>
        <button
          type="button"
          onClick={handleExportDocx}
          disabled={exportingDocx}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:brightness-95 disabled:opacity-60"
          style={{ background: '#2b579a' }}
        >
          <FileText size={16} /> {exportingDocx ? 'Building document…' : 'Export Word'}
        </button>
        <button
          type="button"
          onClick={handleExportPptx}
          disabled={exporting}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:brightness-95 disabled:opacity-60"
          style={{ background: '#15803d' }}
        >
          <Presentation size={16} /> {exporting ? 'Building deck…' : 'Export PowerPoint'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Card padded={false} className="flex flex-col items-center justify-center gap-2 py-4">
          <Gauge value={sc.mtdPlantScore} color={scoreColor(sc.mtdPlantScore)} />
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            MTD Plant Score
          </span>
        </Card>
        <Card padded={false} className="flex flex-col items-center justify-center gap-2 py-4">
          <Gauge value={sc.dataCompletion} color="var(--series-blue)" />
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Data Completion
          </span>
        </Card>
        <div className="col-span-2 flex flex-col items-center justify-center gap-1 rounded-xl border p-4 sm:col-span-4 lg:col-span-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
          <div className="grid w-full grid-cols-4 gap-4 text-center">
            <Stat label="Achieved" value={sc.statusCounts.Achieved} color="var(--status-good)" />
            <Stat label="Watch" value={sc.statusCounts.Watch} color="var(--status-warning)" />
            <Stat label="Action Needed" value={sc.statusCounts['Action Needed']} color="var(--status-serious)" />
            <Stat label="Support Required" value={sc.statusCounts['Support Required']} color="var(--status-critical)" />
          </div>
        </div>
      </div>

      <Card title="REVIEW NARRATIVE" subtitle="Auto-written summary for meeting-ready reading — hand this straight to leadership">
        <InsightsCard insights={insights} />
      </Card>

      <Card title="DEPARTMENT PERFORMANCE SUMMARY">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-xs">
            <thead>
              <tr className="text-left text-xs" style={{ background: 'var(--brand-primary)', color: '#fff' }}>
                <th className="px-2 py-2 font-semibold">Department</th>
                <th className="px-2 py-2 text-right font-semibold">KPIs</th>
                <th className="px-2 py-2 text-right font-semibold">MTD Score</th>
                <th className="px-2 py-2 text-right font-semibold">Completion</th>
                <th className="px-2 py-2 text-right font-semibold">Achieved</th>
                <th className="px-2 py-2 text-right font-semibold">Open Actions</th>
              </tr>
            </thead>
            <tbody>
              {deptSummaries.map((d) => (
                <tr key={d.department} className="border-t" style={{ borderColor: 'var(--border)' }}>
                  <td className="px-2 py-1.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                    {d.department}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{d.kpis}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: scoreColor(d.score) }}>
                    {fmtPercent(d.score, 0)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtPercent(d.completion, 0)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{d.achieved}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{d.openActions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="PQSDC PILLAR SUMMARY">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-xs">
              <thead>
                <tr className="text-left text-xs" style={{ background: 'var(--brand-primary)', color: '#fff' }}>
                  <th className="px-2 py-2 font-semibold">Pillar</th>
                  <th className="px-2 py-2 text-right font-semibold">KPIs</th>
                  <th className="px-2 py-2 text-right font-semibold">MTD Pace Score</th>
                  <th className="px-2 py-2 text-right font-semibold">Attention</th>
                </tr>
              </thead>
              <tbody>
                {pillarSums.map((p) => (
                  <tr key={p.pillar} className="border-t" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-2 py-1.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                      {p.pillar}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{p.kpis}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: scoreColor(p.score) }}>
                      {fmtPercent(p.score, 0)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{p.attention}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="PQSDC PILLAR SHAPE">
          <PillarRadarChart data={pillarSums} />
        </Card>
      </div>

      <Card title="TOP EXCEPTIONS FOR LEADERSHIP ATTENTION" subtitle="Ranked by focus score — status severity, MTD pace gap and overdue action days">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-xs">
            <thead>
              <tr className="text-left text-xs" style={{ background: 'var(--brand-primary)', color: '#fff' }}>
                <th className="px-2 py-2 font-semibold">KPI</th>
                <th className="px-2 py-2 font-semibold">Department</th>
                <th className="px-2 py-2 text-right font-semibold">MTD Pace</th>
                <th className="px-2 py-2 font-semibold">Status</th>
                <th className="px-2 py-2 font-semibold">Challenge / Reason</th>
                <th className="px-2 py-2 font-semibold">Recovery Plan</th>
              </tr>
            </thead>
            <tbody>
              {topExceptions.map((k) => (
                <tr key={k.def.kpiId} className="border-t" style={{ borderColor: 'var(--border)' }}>
                  <td className="px-2 py-1.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                    {k.def.name}
                  </td>
                  <td className="px-2 py-1.5">{k.def.department}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: scoreColor(k.mtdPaceScore) }}>
                    {fmtPercent(k.mtdPaceScore, 0)}
                  </td>
                  <td className="px-2 py-1.5">
                    <StatusBadge status={k.status} />
                  </td>
                  <td className="px-2 py-1.5">{k.rec.challengeReason || '—'}</td>
                  <td className="px-2 py-1.5">{k.rec.recoveryPlan || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="LEADERSHIP SIGN-OFF" subtitle="Recorded per review period and included in the PDF / PowerPoint export">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Reviewed By">
            <input
              value={review.reviewedBy}
              onChange={(e) => updateLeadershipReview(reviewKey, { reviewedBy: e.target.value })}
              className="w-full rounded border bg-transparent p-2 text-xs outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              placeholder={state.meta.preparedBy}
            />
          </Field>
          <Field label="Designation">
            <input
              value={review.designation}
              onChange={(e) => updateLeadershipReview(reviewKey, { designation: e.target.value })}
              className="w-full rounded border bg-transparent p-2 text-xs outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              placeholder="Plant Head / Factory Manager"
            />
          </Field>
          <Field label="Review Date">
            <input
              type="date"
              value={review.reviewDate ? review.reviewDate.slice(0, 10) : ''}
              onChange={(e) =>
                updateLeadershipReview(reviewKey, { reviewDate: e.target.value ? new Date(e.target.value).toISOString() : null })
              }
              className="w-full rounded border bg-transparent p-2 text-xs outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
          </Field>
          <Field label="Decision">
            <select
              value={review.decision}
              onChange={(e) => updateLeadershipReview(reviewKey, { decision: e.target.value })}
              className="w-full rounded border bg-transparent p-2 text-xs outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            >
              <option value="">—</option>
              <option value="Approved">Approved</option>
              <option value="Approved with Actions">Approved with Actions</option>
              <option value="Escalated">Escalated</option>
              <option value="Under Review">Under Review</option>
            </select>
          </Field>
          <div className="sm:col-span-2 lg:col-span-4">
            <Field label="Comments">
              <textarea
                value={review.comments}
                onChange={(e) => updateLeadershipReview(reviewKey, { comments: e.target.value })}
                rows={3}
                className="w-full rounded border bg-transparent p-2 text-xs outline-none"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </Field>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="tabular-nums text-2xl font-bold" style={{ color }}>
        {value}
      </span>
      <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      {children}
    </label>
  );
}
