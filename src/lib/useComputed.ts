import { useMemo } from 'react';
import { useAppStore } from '../state/AppStore';
import { computeKpi, daysInMonth, type ComputedKpi, type EngineFilters } from './calc';

/** The real current date, captured once when the app loads. Drives "days elapsed
 * this month" (data completion) and overdue-action calculations. */
export const TODAY = new Date();

export function useComputedKpis(): { kpis: ComputedKpi[]; dim: number; engineFilters: EngineFilters } {
  const { state, filters } = useAppStore();

  const engineFilters: EngineFilters = useMemo(
    () => ({
      year: filters.year,
      month: filters.month,
      department: filters.department,
      pqsdc: filters.pqsdc,
      day: filters.day,
      today: TODAY,
      status: filters.status,
      owner: filters.owner,
      trend: filters.trend,
      search: filters.search,
    }),
    [
      filters.year,
      filters.month,
      filters.department,
      filters.pqsdc,
      filters.day,
      filters.status,
      filters.owner,
      filters.trend,
      filters.search,
    ],
  );

  const kpis = useMemo(() => {
    const defsById = new Map(state.kpiDefinitions.map((d) => [d.kpiId, d]));
    const out: ComputedKpi[] = [];
    for (const rec of state.kpiRecords) {
      const def = defsById.get(rec.kpiId);
      if (!def) continue;
      out.push(computeKpi(def, rec, engineFilters));
    }
    return out;
  }, [state.kpiDefinitions, state.kpiRecords, engineFilters]);

  const monthNo = useMemo(() => {
    const idx = state.masterLists.months.indexOf(filters.month);
    return idx >= 0 ? idx + 1 : 7;
  }, [state.masterLists.months, filters.month]);

  const dim = daysInMonth(filters.year, monthNo);

  return { kpis, dim, engineFilters };
}

/** Real timestamp of the most recent data edit across all KPI records, or the
 * workbook's original snapshot time if nothing has been edited yet. */
export function useLastDataUpdate(): Date {
  const { state } = useAppStore();
  return useMemo(() => {
    let max = new Date(state.meta.lastDataUpdate).getTime();
    for (const r of state.kpiRecords) {
      const t = new Date(r.lastUpdated).getTime();
      if (!Number.isNaN(t) && t > max) max = t;
    }
    return new Date(max);
  }, [state.meta.lastDataUpdate, state.kpiRecords]);
}
