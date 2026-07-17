import type {
  ActionStatus,
  Direction,
  ForecastSignal,
  KpiDefinition,
  KpiRecord,
  KpiStatus,
  PQSDC,
  TrendDirection,
} from '../types';

/** ---------------------------------------------------------------------
 * RCPL Factory DMS — Calculation Engine
 *
 * Reimplements, in TypeScript, the formula logic of the "Calculation
 * Engine" / "DMS Dashboard" sheets from the source workbook:
 *   - per-day and MTD scoring (capped 0–1.2, direction-aware)
 *   - status classification (Achieved / Watch / Action Needed / Support Required)
 *   - trend classification (Improving / Deteriorating / Stable)
 *   - end-of-month forecasting and pace scoring
 *   - focus-score ranking for exception management
 * ------------------------------------------------------------------- */

export const SCORE_CAP = 1.2;

export function daysInMonth(year: number, monthNo: number): number {
  return new Date(year, monthNo, 0).getDate();
}

function clamp01_2(n: number): number {
  return Math.min(SCORE_CAP, Math.max(0, n));
}

/**
 * Score with partial "recovery" credit when target is zero. Mirrors the
 * per-day score (CD) and Achievement% (AV) formulas in KPI Data Entry.
 */
export function scoreWithRecovery(
  actual: number | null,
  target: number,
  recoveryLimit: number,
  direction: Direction,
): number | null {
  if (actual === null) return null;
  if (direction === 'Higher Better') {
    if (target === 0) return actual >= 0 ? 1 : 0;
    return clamp01_2(actual / target);
  }
  // Lower Better
  if (target === 0) {
    if (actual === 0) return 1;
    if (recoveryLimit === 0) return 0;
    return Math.max(0, 1 - actual / recoveryLimit);
  }
  if (actual === 0) return SCORE_CAP;
  return clamp01_2(target / actual);
}

/**
 * Score against an "expected" value with no recovery credit — used for
 * MTD pace scoring (CC), where the expected value is already prorated.
 */
export function scoreVsExpected(
  actual: number | null,
  expected: number | null,
  direction: Direction,
): number | null {
  if (actual === null || expected === null) return null;
  if (direction === 'Higher Better') {
    if (expected === 0) return 1;
    return clamp01_2(actual / expected);
  }
  if (expected === 0) return actual === 0 ? 1 : 0;
  if (actual === 0) return SCORE_CAP;
  return clamp01_2(expected / actual);
}

export function meetsTarget(actual: number, target: number, direction: Direction): boolean {
  return direction === 'Higher Better' ? actual >= target : actual <= target;
}

export function withinRecovery(actual: number, recoveryLimit: number, direction: Direction): boolean {
  return direction === 'Higher Better' ? actual >= recoveryLimit : actual <= recoveryLimit;
}

export function computeStatus(
  actual: number | null,
  target: number,
  recoveryLimit: number,
  direction: Direction,
  supportRequired: 'Yes' | 'No',
): KpiStatus {
  if (actual === null) return 'No Data';
  const met = meetsTarget(actual, target, direction);
  if (supportRequired === 'Yes' && !met) return 'Support Required';
  if (met) return 'Achieved';
  if (withinRecovery(actual, recoveryLimit, direction)) return 'Watch';
  return 'Action Needed';
}

export function computeTrend(
  daysEntered: number,
  dayChange: number | null,
  direction: Direction,
): TrendDirection {
  if (daysEntered < 2 || dayChange === null) return 'Insufficient Data';
  if (Math.abs(dayChange) <= 0.01) return 'Stable';
  if (direction === 'Higher Better') return dayChange > 0 ? 'Improving' : 'Deteriorating';
  return dayChange < 0 ? 'Improving' : 'Deteriorating';
}

export function trendSignalSymbol(trend: TrendDirection): string {
  switch (trend) {
    case 'Improving':
      return '▲ Improving';
    case 'Deteriorating':
      return '▼ Deteriorating';
    case 'Stable':
      return '● Stable';
    default:
      return '◆ Insufficient Data';
  }
}

export function computeForecastSignal(
  forecast: number | null,
  target: number,
  recoveryLimit: number,
  direction: Direction,
): ForecastSignal {
  if (forecast === null) return 'No Data';
  if (meetsTarget(forecast, target, direction)) return 'On Track';
  if (withinRecovery(forecast, recoveryLimit, direction)) return 'At Risk';
  return 'Off Track';
}

function aggregate(values: number[], aggregation: KpiDefinition['aggregation']): number {
  switch (aggregation) {
    case 'Sum':
      return values.reduce((a, b) => a + b, 0);
    case 'Average':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'Latest Value':
      return values[values.length - 1];
    case 'Minimum':
      return Math.min(...values);
    case 'Maximum':
      return Math.max(...values);
    case 'Count':
      return values.length;
    default:
      return values.reduce((a, b) => a + b, 0) / values.length;
  }
}

const PRORATED_AGGREGATIONS = new Set(['Sum', 'Count']);

export interface ComputedKpi {
  def: KpiDefinition;
  rec: KpiRecord;
  daysInMonth: number;
  daysEntered: number;
  daysMet: number;
  daysMissed: number;
  completionPct: number;
  mtdActual: number | null;
  achievementPct: number | null;
  gap: number | null;
  latestActual: number | null;
  previousActual: number | null;
  dayChange: number | null;
  status: KpiStatus;
  trend: TrendDirection;
  effectiveDailyTarget: number;
  effectiveDailyRecovery: number;
  expectedMtdTarget: number;
  forecastEom: number | null;
  mtdPaceScore: number | null;
  forecastSignal: ForecastSignal;
  selectedDayActual: number | null;
  selectedDayScore: number | null;
  selectedDayWeighted: number | null;
  selectedDayStatus: KpiStatus;
  selectedDayGap: number | null;
  focusScore: number;
  openAction: boolean;
  overdueDays: number;
  dueToday: boolean;
  included: boolean;
}

export interface EngineFilters {
  year: number;
  month: string;
  department: string;
  pqsdc: string;
  day: number;
  today: Date;
}

export function computeKpi(def: KpiDefinition, rec: KpiRecord, filters: EngineFilters): ComputedKpi {
  const dim = daysInMonth(rec.year, rec.monthNo);
  const enteredDays = rec.days.slice(0, dim).filter((v): v is number => v !== null && v !== undefined);
  const daysEntered = enteredDays.length;
  const mtdActual = daysEntered > 0 ? aggregate(enteredDays, def.aggregation) : null;

  const daysMet = rec.days
    .slice(0, dim)
    .filter((v): v is number => v !== null && meetsTarget(v, def.target, def.direction)).length;
  const daysMissed = daysEntered - daysMet;

  const completionPctFinal = dim > 0 ? Math.min(1, daysEntered / dim) : 0;

  const achievementPct = scoreWithRecovery(mtdActual, def.target, def.recoveryLimit, def.direction);
  const gap =
    mtdActual === null
      ? null
      : def.direction === 'Higher Better'
        ? mtdActual - def.target
        : def.target - mtdActual;

  let latestActual: number | null = null;
  let previousActual: number | null = null;
  for (let i = dim - 1; i >= 0; i--) {
    const v = rec.days[i];
    if (v !== null && v !== undefined) {
      if (latestActual === null) latestActual = v;
      else if (previousActual === null) {
        previousActual = v;
        break;
      }
    }
  }
  const dayChange = latestActual !== null && previousActual !== null ? latestActual - previousActual : null;

  const status = computeStatus(mtdActual, def.target, def.recoveryLimit, def.direction, rec.supportRequired);
  const trend = computeTrend(daysEntered, dayChange, def.direction);

  const prorate = PRORATED_AGGREGATIONS.has(def.aggregation);
  const effectiveDailyTarget = prorate ? def.target / dim : def.target;
  const effectiveDailyRecovery = prorate ? def.recoveryLimit / dim : def.recoveryLimit;
  const expectedMtdTarget = prorate ? (def.target * daysEntered) / dim : def.target;
  const forecastEom =
    mtdActual === null ? null : prorate && daysEntered > 0 ? (mtdActual / daysEntered) * dim : mtdActual;

  const mtdPaceScore = scoreVsExpected(mtdActual, daysEntered > 0 ? expectedMtdTarget : null, def.direction);
  const forecastSignal = computeForecastSignal(forecastEom, def.target, def.recoveryLimit, def.direction);

  const dayIdx = filters.day - 1;
  const selectedDayActual = dayIdx >= 0 && dayIdx < dim ? (rec.days[dayIdx] ?? null) : null;
  const selectedDayScore = scoreWithRecovery(
    selectedDayActual,
    effectiveDailyTarget,
    effectiveDailyRecovery,
    def.direction,
  );
  const selectedDayWeighted = selectedDayScore === null ? null : selectedDayScore * def.weight;
  const selectedDayStatus = computeStatus(
    selectedDayActual,
    effectiveDailyTarget,
    effectiveDailyRecovery,
    def.direction,
    rec.supportRequired,
  );
  const selectedDayGap =
    selectedDayActual === null
      ? null
      : def.direction === 'Higher Better'
        ? selectedDayActual - effectiveDailyTarget
        : effectiveDailyTarget - selectedDayActual;

  const today = filters.today;
  const dueDate = rec.dueDate ? new Date(rec.dueDate) : null;
  const openAction = !!(dueDate && rec.actionStatus !== 'Completed');
  const overdueDays = openAction && dueDate! < startOfDay(today) ? diffDays(today, dueDate!) : 0;
  const dueToday = openAction && sameDay(dueDate!, today);

  const statusBase: Record<KpiStatus, number> = {
    'Support Required': 500,
    'Action Needed': 400,
    Watch: 300,
    Achieved: 100,
    'No Data': 0,
  };
  const focusScore =
    statusBase[status] + (1 - (mtdPaceScore ?? 0)) * 100 + (openAction && dueDate! < today ? Math.max(0, diffDays(today, dueDate!)) : 0);

  const included =
    rec.year === filters.year &&
    rec.month === filters.month &&
    (filters.department === 'All' || def.department === filters.department) &&
    (filters.pqsdc === 'All' || def.pqsdc === filters.pqsdc);

  return {
    def,
    rec,
    daysInMonth: dim,
    daysEntered,
    daysMet,
    daysMissed,
    completionPct: completionPctFinal,
    mtdActual,
    achievementPct,
    gap,
    latestActual,
    previousActual,
    dayChange,
    status,
    trend,
    effectiveDailyTarget,
    effectiveDailyRecovery,
    expectedMtdTarget,
    forecastEom,
    mtdPaceScore,
    forecastSignal,
    selectedDayActual,
    selectedDayScore,
    selectedDayWeighted,
    selectedDayStatus,
    selectedDayGap,
    focusScore,
    openAction,
    overdueDays,
    dueToday,
    included,
  };
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function diffDays(a: Date, b: Date): number {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000);
}
function sameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function weightedAverage(items: { value: number | null; weight: number }[]): number | null {
  let num = 0;
  let den = 0;
  for (const it of items) {
    if (it.value === null) continue;
    num += it.value * it.weight;
    den += it.weight;
  }
  return den === 0 ? null : num / den;
}

export function plainAverage(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function rankByFocusScore(kpis: ComputedKpi[]): Map<string, number> {
  const included = kpis.filter((k) => k.included && k.status !== 'No Data');
  const sorted = [...included].sort((a, b) => b.focusScore - a.focusScore);
  const ranks = new Map<string, number>();
  sorted.forEach((k, i) => ranks.set(k.def.kpiId, i + 1));
  return ranks;
}

export interface DepartmentSummary {
  department: string;
  kpis: number;
  score: number | null;
  completion: number | null;
  achieved: number;
  attention: number;
  openActions: number;
}

export function departmentSummaries(kpis: ComputedKpi[], departments: string[]): DepartmentSummary[] {
  return departments.map((department) => {
    const rows = kpis.filter((k) => k.included && k.def.department === department);
    const achieved = rows.filter((k) => k.status === 'Achieved').length;
    return {
      department,
      kpis: rows.length,
      score: weightedAverage(rows.map((k) => ({ value: k.mtdPaceScore, weight: k.def.weight }))),
      completion: plainAverage(rows.map((k) => k.completionPct)),
      achieved,
      attention: rows.length - achieved,
      openActions: rows.filter((k) => k.openAction).length,
    };
  });
}

export interface PillarSummary {
  pillar: PQSDC;
  kpis: number;
  score: number | null;
  attention: number;
}

export function pillarSummaries(kpis: ComputedKpi[], pillars: PQSDC[]): PillarSummary[] {
  return pillars.map((pillar) => {
    const rows = kpis.filter((k) => k.included && k.def.pqsdc === pillar);
    const achieved = rows.filter((k) => k.status === 'Achieved').length;
    return {
      pillar,
      kpis: rows.length,
      score: weightedAverage(rows.map((k) => ({ value: k.mtdPaceScore, weight: k.def.weight }))),
      attention: rows.length - achieved,
    };
  });
}

export interface HeatCell {
  department: string;
  pillar: PQSDC;
  score: number | null;
  kpis: number;
}

export function heatmap(kpis: ComputedKpi[], departments: string[], pillars: PQSDC[]): HeatCell[] {
  const cells: HeatCell[] = [];
  for (const department of departments) {
    for (const pillar of pillars) {
      const rows = kpis.filter((k) => k.included && k.def.department === department && k.def.pqsdc === pillar);
      cells.push({
        department,
        pillar,
        score: weightedAverage(rows.map((k) => ({ value: k.mtdPaceScore, weight: k.def.weight }))),
        kpis: rows.length,
      });
    }
  }
  return cells;
}

export interface PlantDayPoint {
  day: number;
  score: number | null;
  momentum3: number | null;
}

export function plantDayTrend(kpis: ComputedKpi[], dim: number): PlantDayPoint[] {
  const included = kpis.filter((k) => k.included);
  const points: PlantDayPoint[] = [];
  for (let day = 1; day <= dim; day++) {
    const items = included
      .map((k) => {
        const actual = k.rec.days[day - 1];
        if (actual === null || actual === undefined) return null;
        const score = scoreWithRecovery(actual, k.effectiveDailyTarget, k.effectiveDailyRecovery, k.def.direction);
        return { value: score, weight: k.def.weight };
      })
      .filter((v): v is { value: number | null; weight: number } => v !== null);
    const score = items.length ? weightedAverage(items) : null;
    points.push({ day, score, momentum3: null });
  }
  // trailing 3-day momentum over available points
  for (let i = 0; i < points.length; i++) {
    const window = points.slice(Math.max(0, i - 2), i + 1).map((p) => p.score).filter((s): s is number => s !== null);
    points[i].momentum3 = window.length ? window.reduce((a, b) => a + b, 0) / window.length : null;
  }
  return points;
}

export function scorecard(kpis: ComputedKpi[]) {
  const included = kpis.filter((k) => k.included);
  const mtdPlantScore = weightedAverage(included.map((k) => ({ value: k.mtdPaceScore, weight: k.def.weight })));
  const dayItems = included
    .filter((k) => k.selectedDayScore !== null)
    .map((k) => ({ value: k.selectedDayScore, weight: k.def.weight }));
  const selectedDayScore = weightedAverage(dayItems);
  const dataCompletion = plainAverage(included.map((k) => k.completionPct));
  const kpisInScope = included.length;
  const statusCounts: Record<KpiStatus, number> = {
    Achieved: 0,
    Watch: 0,
    'Action Needed': 0,
    'Support Required': 0,
    'No Data': 0,
  };
  for (const k of included) statusCounts[k.status]++;
  const openActions = included.filter((k) => k.openAction).length;
  const overdueActions = included.filter((k) => k.overdueDays > 0).length;
  return {
    mtdPlantScore,
    selectedDayScore,
    dataCompletion,
    kpisInScope,
    statusCounts,
    openActions,
    overdueActions,
  };
}

export function actionStatusCounts(kpis: ComputedKpi[], statuses: ActionStatus[]): { status: ActionStatus; count: number }[] {
  const included = kpis.filter((k) => k.included && k.openAction);
  return statuses.map((status) => ({
    status,
    count: included.filter((k) => k.rec.actionStatus === status).length,
  }));
}
