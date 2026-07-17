import { useMemo } from 'react';
import { useAppStore } from '../state/AppStore';
import { computeKpi, daysInMonth, type ComputedKpi, type EngineFilters } from './calc';

export const TODAY = new Date(2026, 6, 17); // matches "Last data update" in source workbook

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
    }),
    [filters.year, filters.month, filters.department, filters.pqsdc, filters.day],
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
