# Advanced Daily Management System (DMS) Dashboard

An executive, TV-friendly Excel dashboard for a manufacturing plant's daily
DMS review meeting. Built entirely with native Excel formulas, Tables,
Conditional Formatting and Charts — **no VBA or macros**.

📄 **File:** [`dist/DMS_Dashboard.xlsx`](dist/DMS_Dashboard.xlsx)
🛠 **Generator:** [`tools/build_dashboard.py`](tools/build_dashboard.py) (Python + openpyxl — re-run it any time to regenerate the workbook from scratch)

## How to use it

1. Open `dist/DMS_Dashboard.xlsx` in Excel (2016+; a few formulas use
   `AGGREGATE`/`RANK.EQ`, widely available since Excel 2010).
2. **Only type data into the "Master KPI" sheet.** Everything else
   (Dashboard, Trend Analysis, Monthly Summary) recalculates automatically.
3. On a new row in Master KPI, you only need to fill: **Date, Department,
   KPI Name, Actual, Remarks, Support Required, Priority, Status, Notes**.
   Month, Week, Day, Unit, Target, Tolerance, Responsible HOD, Achievement %,
   Variance and Traffic Light are all formulas that fill themselves in from
   the **KPI Master** sheet definitions.
4. The Master KPI, Action Tracker and Challenges Register are real Excel
   Tables (`Tbl_MasterKPI`, `Tbl_ActionTracker`, `Tbl_Challenges`) with 25–40
   pre-formatted blank buffer rows beneath the sample data — type into the
   row right below the table and it auto-expands, formulas and all, no
   copy/paste required.
5. Use the **filter panel** at the top of the Dashboard (Review Period,
   Department, Owner, Status, Priority) to change what the scorecards and
   action tiles show — pick from the dropdowns, everything recalculates
   instantly.

## Workbook structure

| Sheet | Purpose |
|---|---|
| **Dashboard** | Executive view: filter panel, 10 KPI scorecards, department performance table with RAG status, Top 10 Issues (Pareto-ranked), action/escalation tiles, today's escalations list, and 7 charts. Print area is set for **A3 landscape**. |
| **Master KPI** | The only data-entry sheet. 20 columns per the spec; most are auto-filled formulas keyed off KPI Name. |
| **KPI Master** | KPI definitions/config: Department, KPI, Frequency, Unit, Owner, Min/Max Target, Tolerance, Display Order, plus **Direction** (Higher/Lower is Better) and **Category** (Leading/Lagging) — needed to compute RAG status and Achievement % correctly for both "higher is better" and "lower is better" KPIs. Add a new KPI here and it's immediately available in Master KPI's dropdowns. |
| **Action Tracker** | CAPA-style action list with auto-computed Overdue flag and Days Overdue. |
| **Challenges Register** | Cross-functional issues escalated to the Factory Manager. |
| **Trend Analysis** | Rolling 7-day / 30-day / month-to-date / YTD performance by department, plus a 90-day line chart for each of the 10 departments. |
| **Monthly Summary** | Month-selectable department roll-up (Target/Actual/Achievement %, Red/Amber/Green KPI-day counts, Actions Closed/Pending) with 3 charts. |

Sample data: ~90 days × 20 KPIs (1,800 rows) in Master KPI, 45 sample
actions, 10 sample challenges — enough to see every formula, chart and
conditional format working out of the box. Delete/replace it whenever real
data entry begins (formulas stay intact).

## RAG logic

- **Achievement %** — `Actual/Target` for "Higher is Better" KPIs,
  `Target/Actual` for "Lower is Better" ones (so ≥100% always means "met or
  beat target" either way).
- **Traffic Light** — Green if target met; Amber if within the KPI's
  Tolerance band; Red otherwise. Tolerance is read as a % of Target, except
  for zero-target KPIs (e.g. safety incidents, complaints) where it's an
  absolute allowed count.

## What's approximated (and why)

This workbook was generated headlessly (no interactive Excel available to
build it), so a few items in the brief are implemented as the closest
faithful equivalent rather than the literal Excel feature:

- **Slicers** → a **filter panel** of data-validation dropdowns (Period,
  Department, Owner, Status, Priority) driving `SUMIFS`/`COUNTIFS`/`AVERAGEIFS`
  formulas. Native Slicers only attach to PivotTables/Tables created inside
  a running Excel session — if you'd like real slicers, select any table,
  Insert → Table → Insert Slicer, and it will filter that table's rows
  directly (won't drive the dashboard cards, which are formula-based).
- **Pivot Tables** → the Dashboard, Trend Analysis and Monthly Summary use
  `SUMIFS`/`AVERAGEIFS`/`COUNTIFS` over the Master KPI Table instead of
  PivotTables/PivotCharts. This is more robust to generate correctly
  outside Excel and — importantly — auto-recalculates the instant a new row
  is added, with no "Refresh" click required. You're welcome to build
  PivotTables from `Tbl_MasterKPI` yourself for ad-hoc analysis; they'll
  sit alongside the formula-driven dashboard without conflict.
- **Gauge chart** → a doughnut chart with a large hole (Overall Plant
  Score vs. remainder) — Excel has no native gauge chart type; this is the
  standard technique.
- **Bullet chart** → a horizontal bar of Achievement % per department —
  Excel has no native bullet chart type either.
- **Sparklines** → openpyxl (the library used to generate this file) can't
  create native Excel Sparklines, so the Department Performance table and
  Trend Analysis use ▲/▼ arrows (comparing the current period average to
  the prior equivalent period) instead. To add real sparklines, select a
  KPI's history in Master KPI and use Insert → Sparklines.
- **Shift** was listed as a slicer target but isn't one of the specified
  Master KPI columns, so it's not modeled — add a "Shift" column to Master
  KPI (and a matching lookup in KPI Master) if you need it.

## Rendering/validation note

This workbook was generated and validated with Python (openpyxl) in a
sandboxed environment without a working Excel or LibreOffice renderer
available, so it could not be visually screenshotted before delivery.
Validation performed instead: every formula's parentheses are balanced
(21,000+ formula cells checked), all Tables/named ranges/merged cell
ranges resolve without conflicts, and the zip/XML structure is well-formed.
Please open it in Excel and do a quick visual pass — if anything looks off
(a chart slightly overlapping a card, a column too narrow), it's almost
always a one-drag fix, and I'm happy to adjust the generator script if you
report back what you see.
