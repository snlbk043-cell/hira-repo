import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppState, Filters, KpiDefinition, KpiRecord, LeadershipReview } from '../types';
import { initialState } from '../data/seed';

const STORAGE_KEY = 'rcpl-dms-state-v1';
const FILTERS_KEY = 'rcpl-dms-filters-v1';
const THEME_KEY = 'rcpl-dms-theme-v1';
const DEFAULT_REVIEW: LeadershipReview = { reviewedBy: '', designation: '', reviewDate: null, comments: '', decision: '' };

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      // Merge in any fields added since this state was last saved.
      return {
        ...initialState,
        ...parsed,
        meta: { ...initialState.meta, ...parsed.meta },
        leadershipReviews: { ...initialState.leadershipReviews, ...parsed.leadershipReviews },
      };
    }
  } catch {
    /* ignore corrupt storage */
  }
  return initialState;
}

const DEFAULT_FILTERS: Filters = {
  year: 2026,
  month: 'July',
  department: 'All',
  pqsdc: 'All',
  day: 17,
  status: 'All',
  owner: 'All',
  trend: 'All',
  search: '',
};

function loadFilters(): Filters {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (raw) return { ...DEFAULT_FILTERS, ...(JSON.parse(raw) as Partial<Filters>) };
  } catch {
    /* ignore */
  }
  return DEFAULT_FILTERS;
}

interface AppContextValue {
  state: AppState;
  filters: Filters;
  setFilters: (f: Partial<Filters>) => void;
  updateRecord: (recordId: string, patch: Partial<KpiRecord>) => void;
  updateDay: (recordId: string, dayIndex: number, value: number | null) => void;
  addKpi: (def: KpiDefinition, initialRecord: Omit<KpiRecord, 'kpiId'>) => void;
  removeKpi: (kpiId: string) => void;
  updateDefinition: (kpiId: string, patch: Partial<KpiDefinition>) => void;
  updateMasterLists: (patch: Partial<AppState['masterLists']>) => void;
  updateMeta: (patch: Partial<AppState['meta']>) => void;
  updateLeadershipReview: (key: string, patch: Partial<LeadershipReview>) => void;
  resetToSeed: () => void;
  importState: (s: AppState) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);
  const [filters, setFiltersState] = useState<Filters>(loadFilters);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const setFilters = useCallback((f: Partial<Filters>) => {
    setFiltersState((prev) => ({ ...prev, ...f }));
  }, []);

  const updateRecord = useCallback((recordId: string, patch: Partial<KpiRecord>) => {
    setState((prev) => ({
      ...prev,
      kpiRecords: prev.kpiRecords.map((r) =>
        r.recordId === recordId ? { ...r, ...patch, lastUpdated: new Date().toISOString() } : r,
      ),
    }));
  }, []);

  const updateDay = useCallback((recordId: string, dayIndex: number, value: number | null) => {
    setState((prev) => ({
      ...prev,
      kpiRecords: prev.kpiRecords.map((r) => {
        if (r.recordId !== recordId) return r;
        const days = [...r.days];
        days[dayIndex] = value;
        return { ...r, days, lastUpdated: new Date().toISOString() };
      }),
    }));
  }, []);

  const addKpi = useCallback((def: KpiDefinition, initialRecord: Omit<KpiRecord, 'kpiId'>) => {
    setState((prev) => ({
      ...prev,
      kpiDefinitions: [...prev.kpiDefinitions, def],
      kpiRecords: [...prev.kpiRecords, { ...initialRecord, kpiId: def.kpiId }],
    }));
  }, []);

  const removeKpi = useCallback((kpiId: string) => {
    setState((prev) => ({
      ...prev,
      kpiDefinitions: prev.kpiDefinitions.filter((d) => d.kpiId !== kpiId),
      kpiRecords: prev.kpiRecords.filter((r) => r.kpiId !== kpiId),
    }));
  }, []);

  const updateDefinition = useCallback((kpiId: string, patch: Partial<KpiDefinition>) => {
    setState((prev) => ({
      ...prev,
      kpiDefinitions: prev.kpiDefinitions.map((d) => (d.kpiId === kpiId ? { ...d, ...patch } : d)),
    }));
  }, []);

  const updateMasterLists = useCallback((patch: Partial<AppState['masterLists']>) => {
    setState((prev) => ({ ...prev, masterLists: { ...prev.masterLists, ...patch } }));
  }, []);

  const updateMeta = useCallback((patch: Partial<AppState['meta']>) => {
    setState((prev) => ({ ...prev, meta: { ...prev.meta, ...patch } }));
  }, []);

  const updateLeadershipReview = useCallback((key: string, patch: Partial<LeadershipReview>) => {
    setState((prev) => ({
      ...prev,
      leadershipReviews: {
        ...prev.leadershipReviews,
        [key]: { ...DEFAULT_REVIEW, ...prev.leadershipReviews[key], ...patch },
      },
    }));
  }, []);

  const resetToSeed = useCallback(() => {
    setState(initialState);
  }, []);

  const importState = useCallback((s: AppState) => {
    setState(s);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      filters,
      setFilters,
      updateRecord,
      updateDay,
      addKpi,
      removeKpi,
      updateDefinition,
      updateMasterLists,
      updateMeta,
      updateLeadershipReview,
      resetToSeed,
      importState,
      theme,
      toggleTheme,
    }),
    [
      state,
      filters,
      setFilters,
      updateRecord,
      updateDay,
      addKpi,
      removeKpi,
      updateDefinition,
      updateMasterLists,
      updateMeta,
      updateLeadershipReview,
      resetToSeed,
      importState,
      theme,
      toggleTheme,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppStore(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used within AppProvider');
  return ctx;
}
