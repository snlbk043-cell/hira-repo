import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export function DrillDownModal({
  title,
  subtitle,
  onClose,
  children,
  wide,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-[1px]"
      style={{ animation: 'ddm-fade 0.15s ease' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`my-8 w-full ${wide ? 'max-w-5xl' : 'max-w-2xl'} overflow-hidden rounded-xl shadow-2xl`}
        style={{ background: 'var(--surface-1)', animation: 'ddm-pop 0.18s ease' }}
      >
        <div
          className="flex items-start justify-between gap-4 px-5 py-4"
          style={{ background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-primary-2))' }}
        >
          <div>
            <h2 className="text-base font-bold text-white">{title}</h2>
            {subtitle && <p className="mt-1 text-xs text-white/85">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
          >
            <X size={15} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
      </div>
      <style>{`
        @keyframes ddm-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ddm-pop { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </div>
  );
}

export function DrillDownSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--brand-primary)' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

export function DrillDownTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
      <table className="w-full min-w-[520px] border-collapse text-xs">
        <thead>
          <tr style={{ background: 'var(--brand-primary)' }}>
            {columns.map((c, i) => (
              <th
                key={c}
                className={`whitespace-nowrap px-2.5 py-2 font-semibold text-white ${i > 0 ? 'text-right' : 'text-left'}`}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-t" style={{ borderColor: 'var(--border)' }}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`px-2.5 py-1.5 ${ci > 0 ? 'text-right tabular-nums' : 'text-left'}`}
                  style={{ color: ci === 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="py-6 text-center" style={{ color: 'var(--text-muted)' }}>
                No matching data.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
