import { HashRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './state/AppStore';
import { AppShell } from './components/AppShell';
import { ExecutiveDashboard } from './pages/ExecutiveDashboard';
import { KpiDataEntry } from './pages/KpiDataEntry';
import { DepartmentPerformance } from './pages/DepartmentPerformance';
import { MasterData } from './pages/MasterData';
import { LeadershipReview } from './pages/LeadershipReview';
import { Settings } from './pages/Settings';

function App() {
  return (
    <AppProvider>
      <HashRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<ExecutiveDashboard />} />
            <Route path="/data-entry" element={<KpiDataEntry />} />
            <Route path="/departments" element={<DepartmentPerformance />} />
            <Route path="/leadership-review" element={<LeadershipReview />} />
            <Route path="/master-data" element={<MasterData />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </AppShell>
      </HashRouter>
    </AppProvider>
  );
}

export default App;
