# KPI & Action Tracker Dashboard

A simple, interactive Excel dashboard for tracking department KPIs and
actions — built with native Excel formulas, Tables, Conditional Formatting
and charts. **No VBA or macros.**

📄 **File:** [`dist/KPI_Dashboard.xlsx`](dist/KPI_Dashboard.xlsx)
🛠 **Generator:** [`tools/build_kpi_dashboard.py`](tools/build_kpi_dashboard.py) — re-run it any time to regenerate the workbook from scratch. It ends with a **self-check** that scans the generated file for the exact defect class that can trigger Excel's "needs repair" prompt, and fails the build loudly if it finds one.

## How to use it

1. Open `dist/KPI_Dashboard.xlsx` in Excel.
2. Type KPI data into **KPI Data Entry** — only Date, Department and Actual.
   Everything else (Month, Week, KPI Name, Target, Achievement %, Status)
   fills itself in.
3. Type actions into **Action Tracker** — pick Department, Owner, Status
   and Priority from dropdowns; Overdue? fills itself in.
4. Log manager reviews in **Review Log**.
5. **KPI Dashboard** and **Action Dashboard** update automatically — nothing
   to refresh. Use the Month filter on KPI Dashboard to narrow the view.

## The 7 sheets

| # | Sheet | Purpose |
|---|---|---|
| 1 | **KPI Dashboard** | Month filter, 9 KPI scorecards (Overall + 8 departments), department performance table with Green/Amber/Red status, a department-wise bar chart, a weekly trend bar chart, and a donut chart of KPI status distribution. |
| 2 | **KPI Data Entry** | The only sheet for KPI data. Type Date/Department/Actual; KPI Name, Target, Achievement % and Status auto-fill from Master Dropdown. |
| 3 | **Master Dropdown** | One KPI per department (Target, Direction, Owner) plus the Department list used by every dropdown. Add a row here to track more KPIs. |
| 4 | **Action Tracker** | Action ID, Issue, Action, Owner, Due Date, Status, Priority, Completion % — with an auto-computed Overdue flag. |
| 5 | **Action Dashboard** | Action summary cards (Total/Open/In Progress/Closed/Overdue), a department-wise action table with RAG status, an open-actions bar chart, an overdue-by-department bar chart, and an action-status donut chart. |
| 6 | **Review Log** | Manager's daily/weekly/monthly review notes — Date, Review Type, Department, Discussion Points, Action Points, Status. |
| 7 | **Tracker Dropdown Master** | Department/Owner/Status/Priority lists used by Action Tracker's dropdowns. |

Sample data included: 45 days × 8 departments in KPI Data Entry, 24 sample
actions, 5 sample review-log entries — enough to see every card, table and
chart working immediately. Replace it whenever real entry begins.

## RAG logic (kept simple)

- **Achievement %** — `Actual/Target` for "Higher is Better" KPIs,
  `Target/Actual` for "Lower is Better" ones, so ≥100% always means "met
  or beat target."
- **Status** — Green if Achievement % ≥ 100%, Amber if ≥ 85%, Red otherwise.
  One rule, used consistently on both dashboards.

## A note on file integrity

An earlier version of this workbook triggered Excel's "needs repair"
prompt on a company laptop. The cause was a data-validation dropdown
formula written with an illegal leading `=` inside the file's XML — valid
when openpyxl loads it back, but rejected by Excel's stricter validator,
which then stripped content during repair. That bug is fixed here, and the
generator script now runs an automated check for that exact pattern (plus
zip/XML integrity, unbalanced formulas, and overlapping merged cells)
every time it builds the file, so it can't silently reappear.
