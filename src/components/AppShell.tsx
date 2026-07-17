import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Table2,
  Building2,
  Moon,
  Sun,
  Factory,
  ClipboardCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { useAppStore } from '../state/AppStore';

const NAV_ITEMS = [
  { to: '/', label: 'Executive Dashboard', icon: LayoutDashboard },
  { to: '/data-entry', label: 'KPI Data Entry', icon: Table2 },
  { to: '/departments', label: 'Department Performance', icon: Building2 },
  { to: '/leadership-review', label: 'Leadership Review', icon: ClipboardCheck },
  { to: '/settings', label: 'Settings', icon: SlidersHorizontal },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useAppStore();

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--surface-0)' }}>
      <aside
        className="no-print sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r"
        style={{ background: 'var(--surface-1)', borderColor: 'var(--border)', borderTop: '3px solid var(--brand-accent)' }}
      >
        <div className="flex items-center gap-2 px-5 py-5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-primary-2))' }}
          >
            <Factory size={18} color="#fff" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
              RCPL Factory DMS
            </p>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Executive Review
            </p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? '' : 'hover:opacity-80'
                }`
              }
              style={({ isActive }) => ({
                background: isActive ? 'color-mix(in srgb, var(--brand-primary) 12%, transparent)' : 'transparent',
                color: isActive ? 'var(--brand-primary)' : 'var(--text-secondary)',
                boxShadow: isActive ? 'inset 3px 0 0 var(--brand-accent)' : 'none',
              })}
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t px-3 py-3" style={{ borderColor: 'var(--border)' }}>
          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition hover:opacity-80"
            style={{ color: 'var(--text-secondary)' }}
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-6 py-6">{children}</main>
    </div>
  );
}
