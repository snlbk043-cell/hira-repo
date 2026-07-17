# RCPL Factory DMS — Executive Dashboard

An interactive web application that replicates and extends the **RCPL Daily
Management System (DMS)** Excel workbook — a factory KPI dashboard covering
35 KPIs across 7 departments and the 5 PQSDC pillars (Productivity/People,
Quality, Safety, Delivery, Cost).

The workbook's five sheets map to the app's structure:

| Workbook sheet | App page | Route |
|---|---|---|
| DMS Dashboard | Executive Dashboard | `/` |
| KPI Data Entry | KPI Data Entry | `/data-entry` |
| Department Performance | Department Performance | `/departments` |
| Master Data | Master Data | `/master-data` |
| Calculation Engine | `src/lib/calc.ts` (not a page — the scoring logic) | — |

## What it does

- **Executive Dashboard** — MTD plant score, selected-day score, data
  completion, department & PQSDC pillar scorecards, a day-by-day plant score
  trend with 3-day momentum, a department × PQSDC heat map, a top-10 KPI
  exception list ranked by focus score, best/worst-10 tables for the
  selected day, and an open/overdue action register.
- **KPI Data Entry** — a 31-day editable grid for all 35 KPIs, with an
  expandable detail panel per KPI for challenge/reason, recovery plan,
  support routing, action owner, due date, status and priority. Add or
  remove KPIs from a modal form.
- **Department Performance** — MTD pace gauge, PQSDC pace cards, the same
  heat map filtered to a focus department, and a filtered KPI detail table
  showing effective daily target, expected MTD, forecast at end-of-month,
  and forecast/trend signals.
- **Master Data** — edit the departments, PQSDC pillars, units, owners,
  action statuses and priorities that drive every dropdown and filter in
  the app, plus the full KPI Definition Master (target, recovery limit,
  weight, direction, aggregation, owner per KPI).
- **Export / import** — JSON (full state), CSV and Excel (via SheetJS)
  export of the KPI data entry table, JSON import to restore a saved
  state, and a one-click reset back to the original workbook's sample data.

## Calculation engine

`src/lib/calc.ts` reimplements the workbook's formulas in TypeScript:
day and MTD scoring (capped 0–120%, direction-aware, with partial credit
near a zero target), status classification (Achieved / Watch / Action
Needed / Support Required), trend classification, end-of-month forecasting
and pace scoring, and the focus-score ranking used for the exception list.
Every number was cross-checked against the source workbook (e.g. MTD Plant
Score 85%, Achieved 3 / Watch 16 / Action Needed 9 / Support Required 7,
Open Actions 8 / Overdue 4 — all match the "Last data update: 17 Jul 2026"
snapshot in the original file).

## Tech stack

React 19 + TypeScript, Vite, Tailwind CSS v4, Recharts, React Router,
`xlsx` (SheetJS) for Excel export, `lucide-react` icons. State is held in
a React context and persisted to `localStorage`, seeded from the 35 real
KPIs and 17 days of July 2026 actuals extracted from the source workbook.

## Development

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check and build for production
npm run lint     # oxlint
```
