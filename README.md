# KPI & Action Tracker Dashboard (v2 — config-driven)

An executive, at-a-glance Excel dashboard for tracking department KPIs and
actions — built entirely with native Excel formulas, Tables, Conditional
Formatting and charts. **No VBA or macros.**

📄 **File:** [`dist/KPI_Dashboard.xlsx`](dist/KPI_Dashboard.xlsx)
🛠 **Generator:** [`tools/build_kpi_dashboard.py`](tools/build_kpi_dashboard.py) — re-run it any time to regenerate the workbook from scratch. It ends with a **self-check** that scans the generated file for known Excel-repair-triggering defects and fails loudly if it finds one.

Start on the **Read Me** sheet inside the workbook — it has the version,
change log, and step-by-step instructions for extending it.

## What's different in v2

The first version was too generic to actually use: departments and KPIs
were hardcoded, there was no way to tune RAG sensitivity per KPI, and
nothing tracked what changed over time. v2 fixes all three:

- **Config-driven, not hardcoded.** Every department and KPI — name, unit,
  target, direction, RAG threshold, owner, active/inactive — lives as a
  plain row in **Master Config**. No department or KPI name is baked into
  any formula or chart series; everything reads the config live, so
  renaming, adding, or retiring one is a single-cell edit.
- **Per-KPI RAG tuning.** Each KPI has its own Amber/Red threshold instead
  of one hardcoded rule for everything.
- **Headroom to grow.** Master Config is pre-wired for **15 departments**
  and **40 KPIs** — a handful are filled in as a starter set, the rest are
  blank rows ready to use. Add a row, it works; no formula surgery.
- **Sharper visuals.** A worst-first department ranking bar (the problem
  department reads first, not alphabetically), a Green/Amber/Red KPI
  detail table as the "index into detail," a status donut, and a weekly
  trend — designed for a 5-second read, not a data dump.
- **Won't go stale.** A new **Read Me** sheet carries the version number,
  a change log, and explicit "how to extend this" instructions — so the
  next edit gets logged instead of the workbook quietly rotting.

## How to use it

1. Open `dist/KPI_Dashboard.xlsx` in Excel.
2. To add/edit a KPI or department, or change a target or RAG threshold:
   go to **Master Config** and edit the row. That's the only place.
3. Type daily KPI readings into **KPI Data Entry** — only Date, KPI Name
   (dropdown) and Actual. Department, Target, Achievement % and Status
   auto-fill.
4. Type actions into **Action Tracker** — Department/Owner/Status/Priority
   are dropdowns; Overdue auto-flags from the Due Date.
5. Log manager reviews in **Review Log**.
6. **KPI Dashboard** and **Action Dashboard** update automatically. Use the
   Month and Department filters on KPI Dashboard to narrow the view —
   they drive every card, table and chart on that sheet.

## The 8 sheets

| # | Sheet | Purpose |
|---|---|---|
| 1 | **Read Me** | Version, change log, and how-to-extend instructions. Read this first. |
| 2 | **KPI Dashboard** | Month + Department filters, 6 at-a-glance scorecards, a worst-first department ranking chart, a weekly trend chart, a KPI status donut, and a RAG-coloured KPI Detail table. |
| 3 | **KPI Data Entry** | The only sheet for KPI readings. Pick KPI Name; Department/Target/Achievement %/Status auto-fill. |
| 4 | **Master Config** | **Edit KPIs and departments here.** Dept Config (15 slots) + KPI Config (40 slots: Department, KPI Name, Unit, Target, Direction, RAG Threshold %, Owner, Active, Display Order). |
| 5 | **Action Tracker** | Action ID, Issue, Action, Owner, Due Date, Status, Priority, Completion % — with an auto-computed Overdue flag. |
| 6 | **Action Dashboard** | Action summary cards, a department-wise action table with RAG status, and 3 charts. |
| 7 | **Review Log** | Manager's daily/weekly/monthly review notes. |
| 8 | **Tracker Dropdown Master** | Status/Priority lists for Action Tracker. Department & Owner lists link live to Master Config (single source of truth). |

Sample data included: 45 days × 15 KPIs in KPI Data Entry, 24 sample
actions, 5 sample review-log entries, so every card/table/chart works
immediately. Replace it whenever real entry begins.

## RAG logic

- **Achievement %** — `Actual/Target` for "Higher is Better" KPIs,
  `Target/Actual` for "Lower is Better" ones, so ≥100% always means "met
  or beat target."
- **Status** — Green if Achievement % ≥ 100%, Amber if ≥ that KPI's own
  **RAG Threshold %** (set per-KPI in Master Config), Red otherwise.

## How the "grows without breaking" part actually works

- Department and KPI dropdowns are **dynamic named ranges** (`OFFSET` +
  `COUNTA`) that automatically include new rows the moment you fill them
  in — not a fixed list that needs editing.
- The KPI Detail table and the department ranking chart are sized to the
  full 15/40-slot capacity and use `AGGREGATE`/`RANK.EQ` formulas that
  find and sort only the filled-in, active rows — unused capacity just
  shows nothing (via `NA()`), not clutter.
- If you outgrow 15 departments or 40 KPIs: extend the `DeptList` /
  `KPINameList` named ranges (Formulas → Name Manager) and the KPI Detail
  / department table row ranges on both dashboards to match. This is
  documented on the Read Me sheet.

## A note on file integrity

An earlier version of this workbook triggered Excel's "needs repair"
prompt on a company laptop, caused by a data-validation formula written
with an illegal leading `=` in the file's XML. That's fixed, and the
generator now runs an automated self-check — for that exact defect, plus
zip/XML integrity, unbalanced formulas, overlapping merged cells, and
(new in v2) accidental secondary-axis combo charts — every time it
builds the file, so this class of bug can't silently reappear.
