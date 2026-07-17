import type { ComputedKpi, DepartmentSummary, PillarSummary } from './calc';
import { fmtPercent } from './format';

export type InsightTone = 'positive' | 'risk' | 'warning' | 'neutral';

export interface Insight {
  tone: InsightTone;
  text: string;
}

function pct(n: number | null): string {
  return fmtPercent(n, 0);
}

export function generateInsights(params: {
  kpis: ComputedKpi[];
  deptSummaries: DepartmentSummary[];
  pillarSums: PillarSummary[];
  month: string;
  day: number;
}): Insight[] {
  const { kpis, deptSummaries, pillarSums, month, day } = params;
  const included = kpis.filter((k) => k.included);
  const insights: Insight[] = [];

  const scoredDepts = deptSummaries.filter((d) => d.score !== null && d.kpis > 0);
  if (scoredDepts.length > 0) {
    const best = [...scoredDepts].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
    const worst = [...scoredDepts].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
    insights.push({
      tone: 'positive',
      text:
        best.achieved > 0
          ? `${best.department} is the strongest department in ${month} at ${pct(best.score)} MTD pace score, with ${best.achieved} of ${best.kpis} KPIs already achieved.`
          : `${best.department} is the strongest department in ${month} at ${pct(best.score)} MTD pace score, tracking closest to target even though no KPI has formally crossed its achievement threshold yet.`,
    });
    if (worst.department !== best.department) {
      insights.push({
        tone: 'risk',
        text: `${worst.department} is the most at-risk department this month at ${pct(worst.score)} MTD pace score — ${worst.attention} of ${worst.kpis} KPIs need attention and ${worst.openActions} corrective action${worst.openActions === 1 ? ' is' : 's are'} still open.`,
      });
    }
  }

  const scoredPillars = pillarSums.filter((p) => p.score !== null && p.kpis > 0);
  if (scoredPillars.length > 0) {
    const worstPillar = [...scoredPillars].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
    insights.push({
      tone: worstPillar.score !== null && worstPillar.score < 0.9 ? 'warning' : 'neutral',
      text: `The ${worstPillar.pillar} pillar is the weakest across all departments at ${pct(worstPillar.score)} MTD pace, with ${worstPillar.attention} KPIs not yet at target.`,
    });
  }

  const topException = [...included]
    .filter((k) => k.status !== 'No Data')
    .sort((a, b) => b.focusScore - a.focusScore)[0];
  if (topException) {
    insights.push({
      tone: 'risk',
      text: `The single largest exception on Day ${day} is "${topException.def.name}" in ${topException.def.department} — currently ${topException.status}, MTD pace at ${pct(topException.mtdPaceScore)}${topException.rec.challengeReason ? `, attributed to ${topException.rec.challengeReason.toLowerCase()}` : ''}. ${topException.rec.recoveryPlan ? `Recovery plan: ${topException.rec.recoveryPlan.toLowerCase()}.` : 'No recovery plan has been logged yet.'}`,
    });
  }

  const overdue = included.filter((k) => k.overdueDays > 0);
  if (overdue.length > 0) {
    const avgOverdue = Math.round(overdue.reduce((a, k) => a + k.overdueDays, 0) / overdue.length);
    const worstDept = mostFrequent(overdue.map((k) => k.def.department));
    insights.push({
      tone: 'warning',
      text: `${overdue.length} corrective action${overdue.length === 1 ? ' is' : 's are'} currently overdue by an average of ${avgOverdue} day${avgOverdue === 1 ? '' : 's'}${worstDept ? `, concentrated in ${worstDept}` : ''} — leadership escalation is recommended.`,
    });
  } else {
    insights.push({ tone: 'positive', text: 'No corrective actions are currently overdue across any department.' });
  }

  const improving = included.filter((k) => k.trend === 'Improving').length;
  const deteriorating = included.filter((k) => k.trend === 'Deteriorating').length;
  if (improving + deteriorating > 0) {
    insights.push({
      tone: improving >= deteriorating ? 'positive' : 'warning',
      text: `${improving} KPI${improving === 1 ? ' is' : 's are'} trending upward day-on-day, while ${deteriorating} ${deteriorating === 1 ? 'is' : 'are'} trending downward — a net ${improving >= deteriorating ? 'improving' : 'deteriorating'} signal for the plant.`,
    });
  }

  const avgCompletion = included.length ? included.reduce((a, k) => a + k.completionPct, 0) / included.length : null;
  const incomplete = included.filter((k) => k.completionPct < 1).length;
  if (avgCompletion !== null) {
    insights.push({
      tone: avgCompletion >= 0.95 ? 'positive' : 'neutral',
      text: `Data completion stands at ${pct(avgCompletion)} for the review period; ${incomplete} KPI${incomplete === 1 ? '' : 's'} still ${incomplete === 1 ? 'has' : 'have'} unentered days that will affect the MTD picture once filled in.`,
    });
  }

  const supportReq = included.filter((k) => k.status === 'Support Required');
  if (supportReq.length > 0) {
    const depts = Array.from(new Set(supportReq.map((k) => k.rec.supportDepartment).filter((d): d is string => !!d)));
    insights.push({
      tone: 'warning',
      text: `${supportReq.length} KPI${supportReq.length === 1 ? ' is' : 's are'} flagged Support Required${depts.length ? `, needing cross-functional help from ${depts.join(', ')}` : ''}.`,
    });
  }

  return insights;
}

function mostFrequent(items: string[]): string | null {
  if (items.length === 0) return null;
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
