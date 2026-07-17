"""
Generator for a config-driven, interactive KPI + Action Tracker dashboard.
Run: python3 tools/build_kpi_dashboard.py
Produces: dist/KPI_Dashboard.xlsx

Design goals (v2):
  - Config-driven: every KPI/department/target/threshold lives in "Master
    Config" as plain editable rows. No department/KPI name is hardcoded
    into a formula or chart series — everything reads the config via
    lookups, so adding/renaming/retiring a KPI or department never
    requires touching a formula.
  - Headroom to grow: Department Config provisions 15 slots, KPI Config
    provisions 40 slots (pre-filled with a realistic starter set; the
    rest blank and ready to use). Dashboards are sized to that full
    capacity and blank slots resolve to NA() so charts/tables show
    nothing for unused capacity instead of clutter.
  - No VBA. Only formulas, Excel Tables, Conditional Formatting and
    native charts (Bar/Doughnut only — no combo/secondary-axis charts).
  - Self-checking: the script ends by scanning the generated file for the
    exact XML defect (a data-validation formula with a stray leading "=")
    that broke an earlier version of this workbook in real Excel, plus
    other structural sanity checks. The build fails loudly if any are
    found, instead of shipping a file that might need "repair".
"""
import random
import datetime as dt
import zipfile
import re

from openpyxl import Workbook
from openpyxl.worksheet.table import Table, TableStyleInfo
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.formatting.rule import CellIsRule, FormulaRule
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.chart import BarChart, DoughnutChart, Reference
from openpyxl.chart.label import DataLabelList
from openpyxl.chart.marker import DataPoint
from openpyxl.worksheet.page import PageMargins
from openpyxl.worksheet.properties import PageSetupProperties

random.seed(7)
WORKBOOK_VERSION = "2.0"
BUILD_DATE = dt.date(2026, 7, 17)

# ----------------------------------------------------------------------------
# THEME
# ----------------------------------------------------------------------------
NAVY = "1F2A44"
NAVY_DARK = "141B2D"
STEEL = "3A5A7D"
ACCENT_BLUE = "2E75B6"
ACCENT_TEAL = "16A085"
GREEN = "2E7D32"
GREEN_FILL = "C6EFCE"
AMBER = "B7791F"
AMBER_FILL = "FFEB9C"
RED = "C0392B"
RED_FILL = "FFC7CE"
LIGHT_GREY = "F2F3F5"
MID_GREY = "D9DCE1"
WHITE = "FFFFFF"
TEXT_DARK = "1B1F27"
FONT_NAME = "Segoe UI"

TITLE_FONT = Font(name=FONT_NAME, size=20, bold=True, color=WHITE)
SUBTITLE_FONT = Font(name=FONT_NAME, size=10.5, color="C7D1E0")
SECTION_FONT = Font(name=FONT_NAME, size=12, bold=True, color=WHITE)
CARD_LABEL_FONT = Font(name=FONT_NAME, size=9, bold=True, color="C7D1E0")
CARD_VALUE_FONT = Font(name=FONT_NAME, size=18, bold=True, color=WHITE)
HEADER_FONT = Font(name=FONT_NAME, size=10.5, bold=True, color=WHITE)
BODY_FONT = Font(name=FONT_NAME, size=10, color=TEXT_DARK)
BOLD_BODY_FONT = Font(name=FONT_NAME, size=10, bold=True, color=TEXT_DARK)

HEADER_FILL = PatternFill("solid", fgColor=NAVY)
SECTION_FILL = PatternFill("solid", fgColor=STEEL)
TITLE_FILL = PatternFill("solid", fgColor=NAVY_DARK)
CARD_FILL = PatternFill("solid", fgColor=NAVY)
ALT_ROW_FILL = PatternFill("solid", fgColor=LIGHT_GREY)

THIN = Side(style="thin", color=MID_GREY)
BORDER_ALL = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)
LEFT = Alignment(horizontal="left", vertical="center", wrap_text=True)


def style_header_row(ws, row, first_col, last_col, height=26):
    ws.row_dimensions[row].height = height
    for c in range(first_col, last_col + 1):
        cell = ws.cell(row=row, column=c)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = CENTER
        cell.border = BORDER_ALL


def autosize(ws, widths):
    for col, w in widths.items():
        ws.column_dimensions[col].width = w


def section_banner(ws, row, col1, col2, text, height=20):
    ws.merge_cells(start_row=row, start_column=col1, end_row=row, end_column=col2)
    c = ws.cell(row=row, column=col1, value=text)
    c.font = SECTION_FONT
    c.fill = SECTION_FILL
    c.alignment = LEFT
    ws.row_dimensions[row].height = height


def add_list_validation(ws, sqref, formula, allow_blank=True, error=None, error_title=None):
    """Create a list DataValidation, defensively stripping any leading '='
    a caller might mistakenly include — that exact mistake once produced a
    workbook Excel refused to open cleanly, so this helper makes the whole
    class of bug impossible instead of relying on remembering not to."""
    clean = formula.lstrip()
    if clean.startswith("="):
        clean = clean[1:]
    dv = DataValidation(type="list", formula1=clean, allow_blank=allow_blank, showDropDown=False)
    if error:
        dv.error = error
        dv.errorTitle = error_title or "Invalid entry"
    ws.add_data_validation(dv)
    dv.add(sqref)
    return dv


# ----------------------------------------------------------------------------
# WORKBOOK
# ----------------------------------------------------------------------------
wb = Workbook()
wb.remove(wb.active)

ws_read = wb.create_sheet("Read Me")
ws_dash = wb.create_sheet("KPI Dashboard")
ws_entry = wb.create_sheet("KPI Data Entry")
ws_config = wb.create_sheet("Master Config")
ws_action = wb.create_sheet("Action Tracker")
ws_adash = wb.create_sheet("Action Dashboard")
ws_review = wb.create_sheet("Review Log")
ws_tmaster = wb.create_sheet("Tracker Dropdown Master")

for ws in (ws_read, ws_dash, ws_entry, ws_config, ws_action, ws_adash, ws_review, ws_tmaster):
    ws.sheet_view.showGridLines = False

print("Sheets created:", wb.sheetnames)

# ----------------------------------------------------------------------------
# DATA MODEL / STARTER CONTENT
# ----------------------------------------------------------------------------
DEPARTMENTS = ["Safety", "Production", "Quality", "Maintenance",
               "Utilities", "Warehouse", "HR", "Engineering"]
DEPT_CAPACITY = 15  # provisioned slots; add more departments in the blank rows below

# Department, KPI Name, Unit, Target, Direction, RAG Threshold %, Owner, Active, Display Order
KPI_DEFS = [
    ("Safety", "Safety Incidents (LTI)", "Count", 0, "Lower is Better", 0.0, "Safety Officer", "Yes", 1),
    ("Safety", "Near Miss Reports", "Count", 2, "Higher is Better", 0.5, "Safety Officer", "Yes", 2),
    ("Production", "Production Output", "Units", 1000, "Higher is Better", 0.9, "Production Manager", "Yes", 1),
    ("Production", "OEE %", "%", 0.85, "Higher is Better", 0.9, "Production Manager", "Yes", 2),
    ("Quality", "Defect Rate %", "%", 0.02, "Lower is Better", 0.75, "Quality Manager", "Yes", 1),
    ("Quality", "Customer Complaints", "Count", 0, "Lower is Better", 1.0, "Quality Manager", "Yes", 2),
    ("Maintenance", "Unplanned Downtime (Hrs)", "Hours", 1, "Lower is Better", 0.6, "Maintenance Manager", "Yes", 1),
    ("Maintenance", "PM Compliance %", "%", 0.95, "Higher is Better", 0.9, "Maintenance Manager", "Yes", 2),
    ("Utilities", "Power Consumption (kWh)", "kWh", 4500, "Lower is Better", 0.9, "Utilities Engineer", "Yes", 1),
    ("Warehouse", "On-Time Dispatch %", "%", 0.95, "Higher is Better", 0.9, "Warehouse Manager", "Yes", 1),
    ("Warehouse", "Inventory Accuracy %", "%", 0.98, "Higher is Better", 0.95, "Warehouse Manager", "Yes", 2),
    ("HR", "Absenteeism %", "%", 0.03, "Lower is Better", 0.6, "HR Manager", "Yes", 1),
    ("HR", "Training Hours", "Hours", 2, "Higher is Better", 0.5, "HR Manager", "Yes", 2),
    ("Engineering", "Milestone Adherence %", "%", 0.9, "Higher is Better", 0.85, "Engineering Manager", "Yes", 1),
    ("Engineering", "Breakdown Resolution (Hrs)", "Hours", 2, "Lower is Better", 0.75, "Engineering Manager", "Yes", 2),
]
KPI_CAPACITY = 40  # provisioned slots; add more KPIs in the blank rows below

# ----------------------------------------------------------------------------
# SHEET 4 : MASTER CONFIG — the ONLY place departments/KPIs/targets are defined
# ----------------------------------------------------------------------------
ws_config["A1"] = "MASTER CONFIG — edit departments and KPIs here. Every dashboard reads from this sheet."
ws_config.merge_cells("A1:C1")
ws_config["A1"].font = Font(name=FONT_NAME, size=12, bold=True, color=WHITE)
ws_config["A1"].fill = TITLE_FILL
ws_config["A1"].alignment = LEFT
ws_config.row_dimensions[1].height = 26

# --- Department Config (col A), capacity 15 ---
ws_config.cell(row=2, column=1, value="Department").font = HEADER_FONT
ws_config.cell(row=2, column=1).fill = HEADER_FILL
ws_config.cell(row=2, column=1).alignment = CENTER
ws_config.cell(row=2, column=1).border = BORDER_ALL
ws_config.row_dimensions[2].height = 24
for i in range(DEPT_CAPACITY):
    r = 3 + i
    if i < len(DEPARTMENTS):
        ws_config.cell(row=r, column=1, value=DEPARTMENTS[i])
    cell = ws_config.cell(row=r, column=1)
    cell.font = BODY_FONT
    cell.border = BORDER_ALL
    cell.alignment = CENTER
    if i % 2 == 1:
        cell.fill = ALT_ROW_FILL
DEPT_TOP, DEPT_BOTTOM = 3, 2 + DEPT_CAPACITY

dept_tab = Table(displayName="Tbl_DeptConfig", ref=f"A2:A{DEPT_BOTTOM}")
dept_tab.tableStyleInfo = TableStyleInfo(name="TableStyleMedium2", showRowStripes=True)
ws_config.add_table(dept_tab)

# Dynamic named range: grows/shrinks automatically as department rows are
# filled in from the top (no gaps) — this is what every Department dropdown
# and dashboard reads, so renaming/adding a department needs no formula edits.
wb.defined_names["DeptList"] = DefinedName(
    "DeptList", attr_text=f"OFFSET('Master Config'!$A${DEPT_TOP},0,0,COUNTA('Master Config'!$A${DEPT_TOP}:$A${DEPT_BOTTOM}),1)")

# --- KPI Config (cols C:K), capacity 40 ---
kpi_headers = ["Department", "KPI Name", "Unit", "Target", "Direction",
               "RAG Threshold %", "Owner", "Active", "Display Order"]
KPI_HDR_ROW = 2
for j, h in enumerate(kpi_headers, start=3):
    ws_config.cell(row=KPI_HDR_ROW, column=j, value=h)
style_header_row(ws_config, KPI_HDR_ROW, 3, 3 + len(kpi_headers) - 1, height=32)

KPI_TOP = KPI_HDR_ROW + 1
for i in range(KPI_CAPACITY):
    r = KPI_TOP + i
    if i < len(KPI_DEFS):
        rec = KPI_DEFS[i]
        for j, val in enumerate(rec, start=3):
            cell = ws_config.cell(row=r, column=j, value=val)
    for j in range(3, 3 + len(kpi_headers)):
        cell = ws_config.cell(row=r, column=j)
        cell.font = BODY_FONT
        cell.border = BORDER_ALL
        cell.alignment = CENTER if j != 4 else LEFT
        if j == 6 and i < len(KPI_DEFS) and KPI_DEFS[i][2] == "%":
            cell.number_format = "0%"
        if j == 8:
            cell.number_format = "0%"
        if i % 2 == 1:
            cell.fill = ALT_ROW_FILL
KPI_BOTTOM = KPI_TOP + KPI_CAPACITY - 1

kpi_tab = Table(displayName="Tbl_KPIConfig", ref=f"C{KPI_HDR_ROW}:K{KPI_BOTTOM}")
kpi_tab.tableStyleInfo = TableStyleInfo(name="TableStyleMedium2", showRowStripes=True)
ws_config.add_table(kpi_tab)

wb.defined_names["KPINameList"] = DefinedName(
    "KPINameList", attr_text=f"OFFSET('Master Config'!$D${KPI_TOP},0,0,COUNTA('Master Config'!$D${KPI_TOP}:$D${KPI_BOTTOM}),1)")
wb.defined_names["OwnerList"] = DefinedName(
    "OwnerList", attr_text=f"OFFSET('Master Config'!$I${KPI_TOP},0,0,COUNTA('Master Config'!$I${KPI_TOP}:$I${KPI_BOTTOM}),1)")

add_list_validation(ws_config, f"C{KPI_TOP}:C{KPI_BOTTOM}", "DeptList", allow_blank=True,
                     error="Choose a department from Dept Config.", error_title="Invalid Department")
add_list_validation(ws_config, f"G{KPI_TOP}:G{KPI_BOTTOM}", '"Higher is Better,Lower is Better"', allow_blank=True)
add_list_validation(ws_config, f"J{KPI_TOP}:J{KPI_BOTTOM}", '"Yes,No"', allow_blank=True)

ws_config.cell(row=1, column=4, value=(
    "Tip: keep rows for the same Department grouped together, and add new KPIs at the end of the list "
    "(or within your department's block) rather than leaving blank rows in between.")).font = Font(
    name=FONT_NAME, size=9, italic=True, color="8A93A6")
ws_config.merge_cells("D1:K1")

autosize(ws_config, {"A": 14, "B": 3, "C": 15, "D": 26, "E": 9, "F": 10, "G": 16,
                      "H": 14, "I": 20, "J": 9, "K": 12})
ws_config.freeze_panes = "C3"

print(f"Master Config built. Departments rows {DEPT_TOP}-{DEPT_BOTTOM} ({len(DEPARTMENTS)} filled). "
      f"KPIs rows {KPI_TOP}-{KPI_BOTTOM} ({len(KPI_DEFS)} filled).")

# ----------------------------------------------------------------------------
# SHEET 3 : KPI DATA ENTRY  (the only sheet users type KPI data into)
# ----------------------------------------------------------------------------
KC = "Tbl_KPIConfig"
entry_headers = ["Date", "Month", "Week", "KPI Name", "Department", "Unit",
                  "Target", "Actual", "Achievement %", "Status", "Remarks"]

ws_entry["A1"] = "KPI DATA ENTRY — type only Date / KPI Name / Actual / Remarks. Everything else auto-fills from Master Config."
ws_entry.merge_cells("A1:K1")
ws_entry["A1"].font = Font(name=FONT_NAME, size=12, bold=True, color=WHITE)
ws_entry["A1"].fill = TITLE_FILL
ws_entry["A1"].alignment = LEFT
ws_entry.row_dimensions[1].height = 28

for j, h in enumerate(entry_headers, start=1):
    ws_entry.cell(row=2, column=j, value=h)
style_header_row(ws_entry, 2, 1, len(entry_headers))

TODAY = BUILD_DATE
N_DAYS = 45
start_date = TODAY - dt.timedelta(days=N_DAYS - 1)

remarks_bank = ["Within normal range", "Line changeover impact", "Vendor delay", "Manpower shortage",
                "Preventive check done", "Awaiting spares", "Process improvement in progress", ""]

data_rows = []
for day_idx in range(N_DAYS):
    the_date = start_date + dt.timedelta(days=day_idx)
    for dept, kpi, unit, target, direction, thresh, owner, active, order in KPI_DEFS:
        base = target
        spread = base * 0.12 if base != 0 else (1 if unit == "Count" else 0.5)
        bad_day = random.random() < 0.12
        noise = random.gauss(0, spread if spread else 0.5)
        if direction == "Higher is Better":
            actual = base - abs(noise) if bad_day else base + noise
        else:
            actual = base + abs(noise) * 2.5 if bad_day else base + noise
        if unit == "Count":
            actual = max(0, round(actual))
        elif unit == "%":
            actual = round(max(0, actual), 4)
        else:
            actual = round(max(0, actual), 2)
        data_rows.append((the_date, kpi, actual))

first_data_row = 3
last_data_row = first_data_row + len(data_rows) - 1

# Achievement % / Status formulas reused everywhere KPI Config is looked up by name
def achievement_formula(kpi_cell, target_cell, actual_cell):
    return (f'=IFERROR(IF(INDEX({KC}[Direction],MATCH({kpi_cell},{KC}[KPI Name],0))="Lower is Better",'
            f'IF({actual_cell}=0,1,IF({target_cell}=0,0,{target_cell}/{actual_cell})),'
            f'IF({target_cell}=0,1,{actual_cell}/{target_cell})),0)')


def status_formula(kpi_cell, achievement_cell):
    return (f'=IFERROR(IF({achievement_cell}>=1,"Green",'
            f'IF({achievement_cell}>=INDEX({KC}[RAG Threshold %],MATCH({kpi_cell},{KC}[KPI Name],0)),"Amber","Red")),"")')


for i, (the_date, kpi, actual) in enumerate(data_rows):
    r = first_data_row + i
    ws_entry.cell(row=r, column=1, value=the_date).number_format = "dd-mmm-yyyy"
    ws_entry.cell(row=r, column=2, value=f'=IF($A{r}="","",TEXT($A{r},"mmm-yyyy"))')
    ws_entry.cell(row=r, column=3, value=f'=IF($A{r}="","","W"&WEEKNUM($A{r},2))')
    ws_entry.cell(row=r, column=4, value=kpi)
    ws_entry.cell(row=r, column=5, value=f'=IFERROR(INDEX({KC}[Department],MATCH($D{r},{KC}[KPI Name],0)),"")')
    ws_entry.cell(row=r, column=6, value=f'=IFERROR(INDEX({KC}[Unit],MATCH($D{r},{KC}[KPI Name],0)),"")')
    ws_entry.cell(row=r, column=7, value=f'=IFERROR(INDEX({KC}[Target],MATCH($D{r},{KC}[KPI Name],0)),"")')
    ws_entry.cell(row=r, column=8, value=actual)
    ws_entry.cell(row=r, column=9, value=achievement_formula("$D" + str(r), "$G" + str(r), "$H" + str(r)))
    ws_entry.cell(row=r, column=10, value=status_formula("$D" + str(r), "$I" + str(r)))
    ws_entry.cell(row=r, column=11, value=random.choice(remarks_bank))
    for j in range(1, 12):
        cell = ws_entry.cell(row=r, column=j)
        cell.font = BODY_FONT
        cell.border = BORDER_ALL
        cell.alignment = CENTER if j != 11 else LEFT
        if j == 9:
            cell.number_format = "0.0%"

BUFFER_ROWS = 40
for k in range(BUFFER_ROWS):
    r = last_data_row + 1 + k
    ws_entry.cell(row=r, column=2, value=f'=IF($A{r}="","",TEXT($A{r},"mmm-yyyy"))')
    ws_entry.cell(row=r, column=3, value=f'=IF($A{r}="","","W"&WEEKNUM($A{r},2))')
    ws_entry.cell(row=r, column=5, value=f'=IFERROR(INDEX({KC}[Department],MATCH($D{r},{KC}[KPI Name],0)),"")')
    ws_entry.cell(row=r, column=6, value=f'=IFERROR(INDEX({KC}[Unit],MATCH($D{r},{KC}[KPI Name],0)),"")')
    ws_entry.cell(row=r, column=7, value=f'=IFERROR(INDEX({KC}[Target],MATCH($D{r},{KC}[KPI Name],0)),"")')
    ws_entry.cell(row=r, column=9, value=achievement_formula("$D" + str(r), "$G" + str(r), "$H" + str(r)))
    ws_entry.cell(row=r, column=10, value=status_formula("$D" + str(r), "$I" + str(r)))
    for j in range(1, 12):
        cell = ws_entry.cell(row=r, column=j)
        cell.font = BODY_FONT
        cell.border = BORDER_ALL
        cell.alignment = CENTER if j != 11 else LEFT
        if j == 9:
            cell.number_format = "0.0%"

total_last_row = last_data_row + BUFFER_ROWS

for r in range(first_data_row, total_last_row + 1):
    if (r - first_data_row) % 2 == 1:
        for j in range(1, 12):
            c = ws_entry.cell(row=r, column=j)
            if c.fill.fgColor.rgb in (None, "00000000"):
                c.fill = ALT_ROW_FILL

entry_tab = Table(displayName="Tbl_Entry", ref=f"A2:K{total_last_row}")
entry_tab.tableStyleInfo = TableStyleInfo(name="TableStyleMedium2", showRowStripes=True)
ws_entry.add_table(entry_tab)

add_list_validation(ws_entry, f"D3:D{total_last_row}", "KPINameList", allow_blank=False,
                     error="Choose a KPI Name from Master Config.", error_title="Invalid KPI")

ws_entry.conditional_formatting.add(
    f"J3:J{total_last_row}",
    FormulaRule(formula=['$J3="Green"'], fill=PatternFill("solid", fgColor=GREEN_FILL), font=Font(color=GREEN, bold=True)))
ws_entry.conditional_formatting.add(
    f"J3:J{total_last_row}",
    FormulaRule(formula=['$J3="Amber"'], fill=PatternFill("solid", fgColor=AMBER_FILL), font=Font(color=AMBER, bold=True)))
ws_entry.conditional_formatting.add(
    f"J3:J{total_last_row}",
    FormulaRule(formula=['$J3="Red"'], fill=PatternFill("solid", fgColor=RED_FILL), font=Font(color=RED, bold=True)))

autosize(ws_entry, {"A": 12, "B": 11, "C": 7, "D": 26, "E": 13, "F": 9, "G": 10,
                     "H": 10, "I": 12, "J": 10, "K": 26})
ws_entry.freeze_panes = "A3"

print(f"KPI Data Entry: {len(data_rows)} sample rows ({first_data_row}-{last_data_row}), buffer to {total_last_row}.")

# ----------------------------------------------------------------------------
# SHEET 8 : TRACKER DROPDOWN MASTER  (Status/Priority lists; Department/Owner
# link straight back to Master Config so there is one source of truth)
# ----------------------------------------------------------------------------
ws_tmaster["A1"] = "TRACKER DROPDOWN MASTER — Status/Priority lists for Action Tracker (Department & Owner link to Master Config)"
ws_tmaster.merge_cells("A1:D1")
ws_tmaster["A1"].font = Font(name=FONT_NAME, size=12, bold=True, color=WHITE)
ws_tmaster["A1"].fill = TITLE_FILL
ws_tmaster["A1"].alignment = LEFT
ws_tmaster.row_dimensions[1].height = 26

STATUS_LIST = ["Open", "In Progress", "Closed"]
PRIORITY_LIST = ["Low", "Medium", "High"]

ws_tmaster.cell(row=2, column=1, value="Status").font = HEADER_FONT
ws_tmaster.cell(row=2, column=1).fill = HEADER_FILL
ws_tmaster.cell(row=2, column=1).alignment = CENTER
ws_tmaster.cell(row=2, column=1).border = BORDER_ALL
ws_tmaster.cell(row=2, column=2, value="Priority").font = HEADER_FONT
ws_tmaster.cell(row=2, column=2).fill = HEADER_FILL
ws_tmaster.cell(row=2, column=2).alignment = CENTER
ws_tmaster.cell(row=2, column=2).border = BORDER_ALL

for i, item in enumerate(STATUS_LIST, start=3):
    cell = ws_tmaster.cell(row=i, column=1, value=item)
    cell.font = BODY_FONT
    cell.border = BORDER_ALL
    cell.alignment = CENTER
for i, item in enumerate(PRIORITY_LIST, start=3):
    cell = ws_tmaster.cell(row=i, column=2, value=item)
    cell.font = BODY_FONT
    cell.border = BORDER_ALL
    cell.alignment = CENTER

ws_tmaster.cell(row=2, column=4, value=(
    "Department and Owner dropdowns pull live from Master Config — edit them there, not here.")).font = Font(
    name=FONT_NAME, size=9, italic=True, color="8A93A6")

wb.defined_names["ActionStatusList"] = DefinedName("ActionStatusList", attr_text=f"'Tracker Dropdown Master'!$A$3:$A${2+len(STATUS_LIST)}")
wb.defined_names["PriorityList"] = DefinedName("PriorityList", attr_text=f"'Tracker Dropdown Master'!$B$3:$B${2+len(PRIORITY_LIST)}")

# "All Departments" + a live mirror of Master Config's department list, so the
# Review Log dropdown never goes stale even though it also needs an "All" option
# (which a plain reference to DeptList can't include).
ws_tmaster.cell(row=2, column=6, value="Department (All + live list)").font = HEADER_FONT
ws_tmaster.cell(row=2, column=6).fill = HEADER_FILL
ws_tmaster.cell(row=2, column=6).alignment = CENTER
ws_tmaster.cell(row=2, column=6).border = BORDER_ALL
ws_tmaster.cell(row=3, column=6, value="All Departments").font = BODY_FONT
ws_tmaster.cell(row=3, column=6).border = BORDER_ALL
ws_tmaster.cell(row=3, column=6).alignment = CENTER
for i in range(DEPT_CAPACITY):
    r = 4 + i
    cell = ws_tmaster.cell(row=r, column=6,
        value=f'=IF({i+1}<=COUNTA(DeptList),INDEX(DeptList,{i+1}),"")')
    cell.font = BODY_FONT
    cell.border = BORDER_ALL
    cell.alignment = CENTER
wb.defined_names["DeptListWithAll"] = DefinedName(
    "DeptListWithAll", attr_text=f"OFFSET('Tracker Dropdown Master'!$F$3,0,0,1+COUNTA(DeptList),1)")

autosize(ws_tmaster, {"A": 14, "B": 12, "C": 3, "D": 50, "E": 3, "F": 20})
ws_tmaster.freeze_panes = "A3"

print("Tracker Dropdown Master built.")

# ----------------------------------------------------------------------------
# SHEET 5 : ACTION TRACKER
# ----------------------------------------------------------------------------
action_headers = ["Action ID", "Date Raised", "Department", "Issue", "Action",
                   "Owner", "Due Date", "Status", "Priority", "Completion %",
                   "Remarks", "Overdue?"]

ws_action["A1"] = "ACTION TRACKER — actions raised against KPI gaps"
ws_action.merge_cells("A1:L1")
ws_action["A1"].font = Font(name=FONT_NAME, size=12, bold=True, color=WHITE)
ws_action["A1"].fill = TITLE_FILL
ws_action["A1"].alignment = LEFT
ws_action.row_dimensions[1].height = 26

for j, h in enumerate(action_headers, start=1):
    ws_action.cell(row=2, column=j, value=h)
style_header_row(ws_action, 2, 1, len(action_headers))

issues_bank = [
    ("Safety", "Housekeeping non-compliance", "Conduct daily 5S audit"),
    ("Production", "Output below target 3 days running", "RCA on stoppages + retraining"),
    ("Quality", "Rise in defect rate", "Tighten incoming inspection"),
    ("Maintenance", "Repeat breakdown on Compressor-3", "Replace bearing, revise PM checklist"),
    ("Utilities", "Power consumption spike", "Install auto shutoff schedule"),
    ("Warehouse", "Dispatch delay for key customer", "Cycle count + WMS reconciliation"),
    ("HR", "High absenteeism in Shift B", "Coordinate additional shuttle"),
    ("Engineering", "Milestone slipped for Line 4 upgrade", "Escalate to vendor, expedite logistics"),
]
OWNER_BY_DEPT = {rec[0]: rec[6] for rec in KPI_DEFS}

N_ACTIONS = 24
action_first = 3
action_data = []
for i in range(N_ACTIONS):
    dept, issue, act = random.choice(issues_bank)
    owner = OWNER_BY_DEPT.get(dept, "Factory Manager")
    raised = TODAY - dt.timedelta(days=random.randint(0, 30))
    due = raised + dt.timedelta(days=random.randint(2, 10))
    status = random.choices(STATUS_LIST, weights=[3, 3, 4])[0]
    completion = 100 if status == "Closed" else (random.choice([0, 25, 50, 75]) if status == "In Progress" else 0)
    priority = random.choices(PRIORITY_LIST, weights=[3, 4, 3])[0]
    action_data.append((f"ACT-{100+i}", raised, dept, issue, act, owner, due, status, priority, completion, random.choice(remarks_bank)))

action_last = action_first + len(action_data) - 1
for i, rec in enumerate(action_data):
    r = action_first + i
    (aid, raised, dept, issue, act, owner, due, status, prio, comp, rem) = rec
    ws_action.cell(row=r, column=1, value=aid)
    ws_action.cell(row=r, column=2, value=raised).number_format = "dd-mmm-yyyy"
    ws_action.cell(row=r, column=3, value=dept)
    ws_action.cell(row=r, column=4, value=issue)
    ws_action.cell(row=r, column=5, value=act)
    ws_action.cell(row=r, column=6, value=owner)
    ws_action.cell(row=r, column=7, value=due).number_format = "dd-mmm-yyyy"
    ws_action.cell(row=r, column=8, value=status)
    ws_action.cell(row=r, column=9, value=prio)
    ws_action.cell(row=r, column=10, value=comp / 100.0).number_format = "0%"
    ws_action.cell(row=r, column=11, value=rem)
    ws_action.cell(row=r, column=12, value=f'=IF($H{r}="Closed","No",IF($G{r}<TODAY(),"Yes","No"))')
    for j in range(1, 13):
        cell = ws_action.cell(row=r, column=j)
        cell.font = BODY_FONT
        cell.border = BORDER_ALL
        cell.alignment = CENTER if j not in (4, 5, 11) else LEFT
    if (i % 2) == 1:
        for j in range(1, 13):
            ws_action.cell(row=r, column=j).fill = ALT_ROW_FILL

ACTION_BUFFER = 20
for k in range(ACTION_BUFFER):
    r = action_last + 1 + k
    ws_action.cell(row=r, column=12, value=f'=IF($G{r}="","",IF($H{r}="Closed","No",IF($G{r}<TODAY(),"Yes","No")))')
    ws_action.cell(row=r, column=10).number_format = "0%"
    for j in range(1, 13):
        cell = ws_action.cell(row=r, column=j)
        cell.font = BODY_FONT
        cell.border = BORDER_ALL

action_total_last = action_last + ACTION_BUFFER
action_tab = Table(displayName="Tbl_ActionTracker", ref=f"A2:L{action_total_last}")
action_tab.tableStyleInfo = TableStyleInfo(name="TableStyleMedium2", showRowStripes=True)
ws_action.add_table(action_tab)

add_list_validation(ws_action, f"C3:C{action_total_last}", "DeptList", allow_blank=True)
add_list_validation(ws_action, f"F3:F{action_total_last}", "OwnerList", allow_blank=True)
add_list_validation(ws_action, f"H3:H{action_total_last}", "ActionStatusList", allow_blank=True)
add_list_validation(ws_action, f"I3:I{action_total_last}", "PriorityList", allow_blank=True)

ws_action.conditional_formatting.add(
    f"H3:H{action_total_last}",
    FormulaRule(formula=['$H3="Closed"'], fill=PatternFill("solid", fgColor=GREEN_FILL), font=Font(color=GREEN, bold=True)))
ws_action.conditional_formatting.add(
    f"H3:H{action_total_last}",
    FormulaRule(formula=['$H3="Open"'], fill=PatternFill("solid", fgColor=RED_FILL), font=Font(color=RED, bold=True)))
ws_action.conditional_formatting.add(
    f"H3:H{action_total_last}",
    FormulaRule(formula=['$H3="In Progress"'], fill=PatternFill("solid", fgColor=AMBER_FILL), font=Font(color=AMBER, bold=True)))
ws_action.conditional_formatting.add(
    f"L3:L{action_total_last}",
    FormulaRule(formula=['$L3="Yes"'], fill=PatternFill("solid", fgColor=RED_FILL), font=Font(color=RED, bold=True)))

autosize(ws_action, {"A": 10, "B": 12, "C": 13, "D": 30, "E": 30, "F": 20, "G": 12,
                      "H": 12, "I": 9, "J": 11, "K": 24, "L": 9})
ws_action.freeze_panes = "A3"

print(f"Action Tracker: {len(action_data)} sample actions ({action_first}-{action_last}), buffer to {action_total_last}.")

# ----------------------------------------------------------------------------
# SHEET 7 : REVIEW LOG  (manager's daily/weekly/monthly review notes)
# ----------------------------------------------------------------------------
review_headers = ["Date", "Review Type", "Department", "Reviewed By",
                   "Key Discussion Points", "Action Points Raised", "Status"]

ws_review["A1"] = "REVIEW LOG — manager's daily / weekly / monthly action review notes"
ws_review.merge_cells("A1:G1")
ws_review["A1"].font = Font(name=FONT_NAME, size=12, bold=True, color=WHITE)
ws_review["A1"].fill = TITLE_FILL
ws_review["A1"].alignment = LEFT
ws_review.row_dimensions[1].height = 26

for j, h in enumerate(review_headers, start=1):
    ws_review.cell(row=2, column=j, value=h)
style_header_row(ws_review, 2, 1, len(review_headers))

sample_reviews = [
    (TODAY, "Daily", "Production", "Factory Manager", "Line 2 output dip discussed", "RCA assigned to Production Manager", "Open"),
    (TODAY - dt.timedelta(days=1), "Daily", "Safety", "Factory Manager", "Zero incidents, good near-miss reporting", "Continue current practice", "Closed"),
    (TODAY - dt.timedelta(days=7), "Weekly", "Quality", "Factory Manager", "Defect rate trending above target", "Supplier audit follow-up", "Open"),
    (TODAY - dt.timedelta(days=7), "Weekly", "Maintenance", "Factory Manager", "Compressor-3 repeat breakdown reviewed", "PM checklist revision tracked", "In Progress"),
    (TODAY - dt.timedelta(days=30), "Monthly", "All Departments", "Factory Manager", "Month-end performance review", "Carry forward 3 open actions to next month", "Closed"),
]
rv_first = 3
for i, rec in enumerate(sample_reviews):
    r = rv_first + i
    for j, val in enumerate(rec, start=1):
        cell = ws_review.cell(row=r, column=j, value=val)
        cell.font = BODY_FONT
        cell.border = BORDER_ALL
        cell.alignment = CENTER if j in (1, 2, 3, 4, 7) else LEFT
        if j == 1:
            cell.number_format = "dd-mmm-yyyy"
    if i % 2 == 1:
        for j in range(1, 8):
            ws_review.cell(row=r, column=j).fill = ALT_ROW_FILL

rv_last = rv_first + len(sample_reviews) - 1
RV_BUFFER = 30
for k in range(RV_BUFFER):
    r = rv_last + 1 + k
    for j in range(1, 8):
        cell = ws_review.cell(row=r, column=j)
        cell.font = BODY_FONT
        cell.border = BORDER_ALL
    ws_review.cell(row=r, column=1).number_format = "dd-mmm-yyyy"

rv_total_last = rv_last + RV_BUFFER
rv_tab = Table(displayName="Tbl_ReviewLog", ref=f"A2:G{rv_total_last}")
rv_tab.tableStyleInfo = TableStyleInfo(name="TableStyleMedium2", showRowStripes=True)
ws_review.add_table(rv_tab)

add_list_validation(ws_review, f"B3:B{rv_total_last}", '"Daily,Weekly,Monthly"', allow_blank=True)
add_list_validation(ws_review, f"C3:C{rv_total_last}", "DeptListWithAll", allow_blank=True)
add_list_validation(ws_review, f"G3:G{rv_total_last}", '"Open,In Progress,Closed"', allow_blank=True)

ws_review.conditional_formatting.add(
    f"G3:G{rv_total_last}",
    FormulaRule(formula=['$G3="Closed"'], fill=PatternFill("solid", fgColor=GREEN_FILL), font=Font(color=GREEN, bold=True)))
ws_review.conditional_formatting.add(
    f"G3:G{rv_total_last}",
    FormulaRule(formula=['$G3="Open"'], fill=PatternFill("solid", fgColor=RED_FILL), font=Font(color=RED, bold=True)))
ws_review.conditional_formatting.add(
    f"G3:G{rv_total_last}",
    FormulaRule(formula=['$G3="In Progress"'], fill=PatternFill("solid", fgColor=AMBER_FILL), font=Font(color=AMBER, bold=True)))
ws_review.conditional_formatting.add(
    f"B3:B{rv_total_last}",
    FormulaRule(formula=['$B3="Daily"'], font=Font(color=ACCENT_BLUE, bold=True)))
ws_review.conditional_formatting.add(
    f"B3:B{rv_total_last}",
    FormulaRule(formula=['$B3="Weekly"'], font=Font(color=STEEL, bold=True)))
ws_review.conditional_formatting.add(
    f"B3:B{rv_total_last}",
    FormulaRule(formula=['$B3="Monthly"'], font=Font(color=NAVY, bold=True)))

autosize(ws_review, {"A": 12, "B": 11, "C": 15, "D": 15, "E": 34, "F": 34, "G": 11})
ws_review.freeze_panes = "A3"

print(f"Review Log built: {len(sample_reviews)} sample rows, buffer to {rv_total_last}.")

# ----------------------------------------------------------------------------
# SHEET 2 : KPI DASHBOARD
# ----------------------------------------------------------------------------
EN = "Tbl_Entry"
ws_dash.sheet_view.zoomScale = 90

ws_dash.merge_cells("A1:S2")
ws_dash["A1"] = "  KPI DASHBOARD"
ws_dash["A1"].font = TITLE_FONT
ws_dash["A1"].fill = TITLE_FILL
ws_dash["A1"].alignment = Alignment(horizontal="left", vertical="center")
ws_dash.row_dimensions[1].height = 34
ws_dash.row_dimensions[2].height = 14

ws_dash.merge_cells("A3:S3")
ws_dash["A3"] = (f'="  v{WORKBOOK_VERSION}   |   "&TEXT(TODAY(),"dddd, dd-mmm-yyyy")&'
                  '"   |   updates automatically from KPI Data Entry + Master Config"')
ws_dash["A3"].font = SUBTITLE_FONT
ws_dash["A3"].fill = TITLE_FILL
ws_dash["A3"].alignment = Alignment(horizontal="left", vertical="center")
ws_dash.row_dimensions[3].height = 20

# ---- Filter ----
FROW = 5
ws_dash.cell(row=FROW, column=1, value="Filter — Month:").font = BOLD_BODY_FONT
ws_dash.cell(row=FROW, column=2, value="All")
fcell = ws_dash.cell(row=FROW, column=2)
fcell.font = Font(name=FONT_NAME, size=10, bold=True, color=ACCENT_BLUE)
fcell.fill = PatternFill("solid", fgColor=WHITE)
fcell.border = BORDER_ALL
fcell.alignment = CENTER
MONTH_CELL = f"$B${FROW}"

distinct_months = []
seen = set()
for d in range(N_DAYS):
    label = (start_date + dt.timedelta(days=d)).strftime("%b-%Y")
    if label not in seen:
        seen.add(label)
        distinct_months.append(label)
month_list_formula = '"All,' + ",".join(distinct_months) + '"'
add_list_validation(ws_dash, f"B{FROW}", month_list_formula, allow_blank=False)

ws_dash.cell(row=FROW, column=4, value="Department:").font = BOLD_BODY_FONT
ws_dash.cell(row=FROW, column=5, value="All")
dcell = ws_dash.cell(row=FROW, column=5)
dcell.font = Font(name=FONT_NAME, size=10, bold=True, color=ACCENT_BLUE)
dcell.fill = PatternFill("solid", fgColor=WHITE)
dcell.border = BORDER_ALL
dcell.alignment = CENTER
DEPT_FILTER_CELL = f"$E${FROW}"
add_list_validation(ws_dash, f"E{FROW}", "DeptListWithAll", allow_blank=False)

wb.save("/home/user/hira-repo/dist/KPI_Dashboard.xlsx")
print("KPI Dashboard header + filters complete.")

# ----------------------------------------------------------------------------
# KPI SCORECARDS  (department-count-agnostic big-picture numbers)
# ----------------------------------------------------------------------------
CARD_SEC_ROW = FROW + 2
section_banner(ws_dash, CARD_SEC_ROW, 1, 19, "AT A GLANCE")

CARD_TOP = CARD_SEC_ROW + 1
CARD_H = 4
CARD_W = 6

MONTH_CRIT = f'IF({MONTH_CELL}="All","*",{MONTH_CELL})'
DEPT_CRIT = f'IF({DEPT_FILTER_CELL}="All Departments","*",{DEPT_FILTER_CELL})'

card_defs = [
    ("Overall Plant Score",
     f'=IFERROR(AVERAGEIFS({EN}[Achievement %],{EN}[Month],{MONTH_CRIT},{EN}[Department],{DEPT_CRIT}),0)', "0.0%"),
    ("Active KPIs Tracked",
     f'=COUNTIFS({KC}[Active],"Yes")', "0"),
    ("% KPI-Days Green",
     f'=IFERROR(COUNTIFS({EN}[Status],"Green",{EN}[Month],{MONTH_CRIT},{EN}[Department],{DEPT_CRIT})'
     f'/COUNTIFS({EN}[Month],{MONTH_CRIT},{EN}[Department],{DEPT_CRIT}),0)', "0.0%"),
    ("% KPI-Days Red",
     f'=IFERROR(COUNTIFS({EN}[Status],"Red",{EN}[Month],{MONTH_CRIT},{EN}[Department],{DEPT_CRIT})'
     f'/COUNTIFS({EN}[Month],{MONTH_CRIT},{EN}[Department],{DEPT_CRIT}),0)', "0.0%"),
    ("Open Actions",
     f'=COUNTIFS(Tbl_ActionTracker[Status],"<>Closed",Tbl_ActionTracker[Department],{DEPT_CRIT})', "0"),
    ("Overdue Actions",
     f'=COUNTIFS(Tbl_ActionTracker[Overdue?],"Yes",Tbl_ActionTracker[Department],{DEPT_CRIT})', "0"),
]
SCORE_CELLS = {}
for idx, (label, formula, fmt) in enumerate(card_defs):
    left = 1 + idx * CARD_W
    right = left + CARD_W - 1
    top = CARD_TOP
    bottom = top + CARD_H - 1
    for rr in range(top, bottom + 1):
        for cc in range(left, right + 1):
            ws_dash.cell(row=rr, column=cc).fill = CARD_FILL
    label_row, value_row = top + 1, top + 2
    ws_dash.merge_cells(start_row=label_row, start_column=left, end_row=label_row, end_column=right)
    lbl = ws_dash.cell(row=label_row, column=left, value=label.upper())
    lbl.font = CARD_LABEL_FONT
    lbl.alignment = CENTER
    lbl.fill = CARD_FILL
    ws_dash.merge_cells(start_row=value_row, start_column=left, end_row=value_row, end_column=right)
    val = ws_dash.cell(row=value_row, column=left, value=formula)
    val.font = CARD_VALUE_FONT
    val.alignment = CENTER
    val.fill = CARD_FILL
    val.number_format = fmt
    SCORE_CELLS[label] = f"{get_column_letter(left)}{value_row}"
    for rr in range(top, bottom + 1):
        ws_dash.row_dimensions[rr].height = 14

ws_dash.conditional_formatting.add(
    SCORE_CELLS["Overall Plant Score"],
    CellIsRule(operator="greaterThanOrEqual", formula=["1"], font=Font(color="7BD88F", bold=True, size=18, name=FONT_NAME)))
ws_dash.conditional_formatting.add(
    SCORE_CELLS["Overall Plant Score"],
    CellIsRule(operator="between", formula=["0.85", "1"], font=Font(color="FFD966", bold=True, size=18, name=FONT_NAME)))
ws_dash.conditional_formatting.add(
    SCORE_CELLS["Overall Plant Score"],
    CellIsRule(operator="lessThan", formula=["0.85"], font=Font(color="FF8A80", bold=True, size=18, name=FONT_NAME)))
ws_dash.conditional_formatting.add(
    SCORE_CELLS["% KPI-Days Green"],
    CellIsRule(operator="greaterThanOrEqual", formula=["0.8"], font=Font(color="7BD88F", bold=True, size=18, name=FONT_NAME)))
ws_dash.conditional_formatting.add(
    SCORE_CELLS["% KPI-Days Red"],
    CellIsRule(operator="greaterThan", formula=["0.15"], font=Font(color="FF8A80", bold=True, size=18, name=FONT_NAME)))
ws_dash.conditional_formatting.add(
    SCORE_CELLS["Overdue Actions"],
    CellIsRule(operator="greaterThan", formula=["0"], font=Font(color="FF8A80", bold=True, size=18, name=FONT_NAME)))

CARD_BLOCK_BOTTOM = CARD_TOP + CARD_H - 1

wb.save("/home/user/hira-repo/dist/KPI_Dashboard.xlsx")
print(f"KPI scorecards complete, block bottom row {CARD_BLOCK_BOTTOM}.")

# ----------------------------------------------------------------------------
# CHART DATA — department ranking (worst-first), RAG mix, weekly trend.
# Sized to DEPT_CAPACITY so adding a department never needs a formula edit.
# ----------------------------------------------------------------------------
HELP_SEC_ROW = CARD_BLOCK_BOTTOM + 2
section_banner(ws_dash, HELP_SEC_ROW, 1, 19, "CHART DATA (auto — do not delete)")

small_grey = Font(name=FONT_NAME, size=9, color="8A93A6")
small_grey_b = Font(name=FONT_NAME, size=9, bold=True, color="8A93A6")

# --- raw department score + rank (ascending = worst first), cols A:C ---
RAW_HDR_ROW = HELP_SEC_ROW + 1
for j, h in zip((1, 2, 3), ("Department", "Score", "Rank (worst first)")):
    ws_dash.cell(row=RAW_HDR_ROW, column=j, value=h).font = small_grey_b
RAW_TOP = RAW_HDR_ROW + 1
for i in range(DEPT_CAPACITY):
    r = RAW_TOP + i
    n = i + 1
    ws_dash.cell(row=r, column=1,
        value=f'=IF({n}<=COUNTA(DeptList),INDEX(DeptList,{n}),"")').font = small_grey
    ws_dash.cell(row=r, column=2,
        value=(f'=IF($A{r}="","",IFERROR(AVERAGEIFS({EN}[Achievement %],{EN}[Department],$A{r},'
               f'{EN}[Month],{MONTH_CRIT}),""))')).font = small_grey
    ws_dash.cell(row=r, column=3,
        value=(f'=IF($A{r}="","",RANK.EQ($B{r},$B${RAW_TOP}:$B${RAW_TOP+DEPT_CAPACITY-1},1)'
               f'+COUNTIF($B${RAW_TOP}:$B{r},$B{r})-1)')).font = small_grey
RAW_BOTTOM = RAW_TOP + DEPT_CAPACITY - 1

# --- sorted view for the chart (rank 1..N), cols E:F ---
SORT_HDR_ROW = RAW_HDR_ROW
ws_dash.cell(row=SORT_HDR_ROW, column=5, value="Department (sorted, worst first)").font = small_grey_b
ws_dash.cell(row=SORT_HDR_ROW, column=6, value="Achievement %").font = small_grey_b
SORT_TOP = SORT_HDR_ROW + 1
for i in range(DEPT_CAPACITY):
    r = SORT_TOP + i
    n = i + 1
    ws_dash.cell(row=r, column=5,
        value=f'=IFERROR(INDEX($A${RAW_TOP}:$A${RAW_BOTTOM},MATCH({n},$C${RAW_TOP}:$C${RAW_BOTTOM},0)),"")').font = small_grey
    ws_dash.cell(row=r, column=6,
        value=f'=IFERROR(INDEX($B${RAW_TOP}:$B${RAW_BOTTOM},MATCH({n},$C${RAW_TOP}:$C${RAW_BOTTOM},0)),NA())').font = small_grey
SORT_BOTTOM = SORT_TOP + DEPT_CAPACITY - 1

# --- RAG mix, cols H:I ---
RAG_HDR_ROW = SORT_HDR_ROW
ws_dash.cell(row=RAG_HDR_ROW, column=8, value="Status").font = small_grey_b
ws_dash.cell(row=RAG_HDR_ROW, column=9, value="Count").font = small_grey_b
RAG_TOP = RAG_HDR_ROW + 1
for i, st in enumerate(["Green", "Amber", "Red"]):
    r = RAG_TOP + i
    ws_dash.cell(row=r, column=8, value=st).font = small_grey
    ws_dash.cell(row=r, column=9,
        value=f'=COUNTIFS({EN}[Status],$H{r},{EN}[Month],{MONTH_CRIT},{EN}[Department],{DEPT_CRIT})').font = small_grey
RAG_BOTTOM = RAG_TOP + 2

# --- weekly trend, cols K:L ---
distinct_weeks = []
seen_w = set()
for d in range(N_DAYS):
    wk = "W" + str((start_date + dt.timedelta(days=d)).isocalendar()[1])
    if wk not in seen_w:
        seen_w.add(wk)
        distinct_weeks.append(wk)

WEEK_HDR_ROW = RAG_HDR_ROW
ws_dash.cell(row=WEEK_HDR_ROW, column=11, value="Week").font = small_grey_b
ws_dash.cell(row=WEEK_HDR_ROW, column=12, value="Overall Achievement %").font = small_grey_b
WEEK_TOP = WEEK_HDR_ROW + 1
for i, wk in enumerate(distinct_weeks):
    r = WEEK_TOP + i
    ws_dash.cell(row=r, column=11, value=wk).font = small_grey
    ws_dash.cell(row=r, column=12,
        value=f'=IFERROR(AVERAGEIFS({EN}[Achievement %],{EN}[Week],$K{r},{EN}[Department],{DEPT_CRIT}),0)').font = small_grey
    ws_dash.cell(row=r, column=12).number_format = "0%"
WEEK_BOTTOM = WEEK_TOP + len(distinct_weeks) - 1

wb.save("/home/user/hira-repo/dist/KPI_Dashboard.xlsx")
print(f"Chart data: rank {RAW_TOP}-{RAW_BOTTOM}, sorted {SORT_TOP}-{SORT_BOTTOM}, "
      f"RAG {RAG_TOP}-{RAG_BOTTOM}, weeks {WEEK_TOP}-{WEEK_BOTTOM}.")

# ----------------------------------------------------------------------------
# KPI DETAIL TABLE — the RAG-coloured "index into detail". Lists every
# Active=Yes KPI from Master Config, regardless of row position there, sized
# to KPI_CAPACITY so it keeps working as KPIs are added/retired.
# ----------------------------------------------------------------------------
DETAIL_SEC_ROW = max(RAW_BOTTOM, SORT_BOTTOM, RAG_BOTTOM, WEEK_BOTTOM) + 2
section_banner(ws_dash, DETAIL_SEC_ROW, 1, 10, "KPI DETAIL (active KPIs, worst status first)")

detail_headers = ["Department", "KPI Name", "Target", "Actual (avg)", "Achievement %", "Status"]
DETAIL_HDR_ROW = DETAIL_SEC_ROW + 1
for j, h in enumerate(detail_headers, start=1):
    ws_dash.cell(row=DETAIL_HDR_ROW, column=j, value=h)
style_header_row(ws_dash, DETAIL_HDR_ROW, 1, len(detail_headers))

DETAIL_TOP = DETAIL_HDR_ROW + 1
for i in range(KPI_CAPACITY):
    r = DETAIL_TOP + i
    n = i + 1
    nth_row = (f'AGGREGATE(15,6,(ROW({KC}[KPI Name])-ROW(INDEX({KC}[KPI Name],1))+1)'
               f'/(({KC}[Active]="Yes")*({KC}[Department]<>"")'
               f'*(({DEPT_FILTER_CELL}="All Departments")+({KC}[Department]={DEPT_FILTER_CELL}))),{n})')
    ws_dash.cell(row=r, column=2, value=f'=IFERROR(INDEX({KC}[KPI Name],{nth_row}),"")')
    ws_dash.cell(row=r, column=1, value=f'=IF($B{r}="","",IFERROR(INDEX({KC}[Department],{nth_row}),""))')
    ws_dash.cell(row=r, column=3, value=f'=IF($B{r}="","",IFERROR(INDEX({KC}[Target],{nth_row}),""))')
    ws_dash.cell(row=r, column=4,
        value=f'=IF($B{r}="","",IFERROR(AVERAGEIFS({EN}[Actual],{EN}[KPI Name],$B{r},{EN}[Month],{MONTH_CRIT}),""))')
    ws_dash.cell(row=r, column=5,
        value=f'=IF($B{r}="","",IFERROR(AVERAGEIFS({EN}[Achievement %],{EN}[KPI Name],$B{r},{EN}[Month],{MONTH_CRIT}),""))')
    ws_dash.cell(row=r, column=6,
        value=(f'=IF($B{r}="","",IF($E{r}>=1,"Green",IF($E{r}>=IFERROR(INDEX({KC}[RAG Threshold %],'
               f'MATCH($B{r},{KC}[KPI Name],0)),0),"Amber","Red")))'))
    for j in range(1, 7):
        cell = ws_dash.cell(row=r, column=j)
        cell.font = BODY_FONT
        cell.border = BORDER_ALL
        cell.alignment = CENTER if j != 2 else LEFT
        if j == 5:
            cell.number_format = "0.0%"
        if j in (3, 4):
            cell.number_format = "0.00"
    if i % 2 == 1:
        for j in range(1, 7):
            ws_dash.cell(row=r, column=j).fill = ALT_ROW_FILL
DETAIL_BOTTOM = DETAIL_TOP + KPI_CAPACITY - 1

ws_dash.conditional_formatting.add(
    f"F{DETAIL_TOP}:F{DETAIL_BOTTOM}",
    FormulaRule(formula=[f'$F{DETAIL_TOP}="Green"'], fill=PatternFill("solid", fgColor=GREEN_FILL), font=Font(color=GREEN, bold=True)))
ws_dash.conditional_formatting.add(
    f"F{DETAIL_TOP}:F{DETAIL_BOTTOM}",
    FormulaRule(formula=[f'$F{DETAIL_TOP}="Amber"'], fill=PatternFill("solid", fgColor=AMBER_FILL), font=Font(color=AMBER, bold=True)))
ws_dash.conditional_formatting.add(
    f"F{DETAIL_TOP}:F{DETAIL_BOTTOM}",
    FormulaRule(formula=[f'$F{DETAIL_TOP}="Red"'], fill=PatternFill("solid", fgColor=RED_FILL), font=Font(color=RED, bold=True)))

autosize(ws_dash, {"A": 14, "B": 26, "C": 10, "D": 12, "E": 13, "F": 10})
for col_l in "GHIJKLMNOPQRS":
    ws_dash.column_dimensions[col_l].width = 8

print(f"KPI Detail table rows {DETAIL_TOP}-{DETAIL_BOTTOM}.")

# ----------------------------------------------------------------------------
# CHARTS
# ----------------------------------------------------------------------------
CHART_SEC_ROW = DETAIL_BOTTOM + 2
section_banner(ws_dash, CHART_SEC_ROW, 1, 19, "CHARTS")
CHART_ROW = CHART_SEC_ROW + 1

# 1) Department ranking — horizontal bar, worst first (problem area shows first)
rank_bar = BarChart()
rank_bar.type = "bar"  # horizontal
rank_bar.title = "Department Ranking — Achievement % (worst first)"
rank_bar.height = 9
rank_bar.width = 10.5
data = Reference(ws_dash, min_col=6, min_row=SORT_HDR_ROW, max_row=SORT_BOTTOM)
cats = Reference(ws_dash, min_col=5, min_row=SORT_TOP, max_row=SORT_BOTTOM)
rank_bar.add_data(data, titles_from_data=True)
rank_bar.set_categories(cats)
rank_bar.y_axis.numFmt = "0%"
rank_bar.x_axis.scaling.orientation = "maxMin"  # worst (rank 1) reads at the top
rank_bar.series[0].graphicalProperties.solidFill = RED
rank_bar.legend = None
ws_dash.add_chart(rank_bar, f"A{CHART_ROW}")

# 2) Weekly trend — overall Achievement % by week
week_bar = BarChart()
week_bar.type = "col"
week_bar.title = "Weekly Trend — Overall Achievement %"
week_bar.height = 9
week_bar.width = 10.5
data = Reference(ws_dash, min_col=12, min_row=WEEK_HDR_ROW, max_row=WEEK_BOTTOM)
cats = Reference(ws_dash, min_col=11, min_row=WEEK_TOP, max_row=WEEK_BOTTOM)
week_bar.add_data(data, titles_from_data=True)
week_bar.set_categories(cats)
week_bar.y_axis.numFmt = "0%"
week_bar.series[0].graphicalProperties.solidFill = ACCENT_TEAL
week_bar.legend = None
ws_dash.add_chart(week_bar, f"H{CHART_ROW}")

# 3) RAG mix — donut chart
rag_donut = DoughnutChart()
rag_donut.title = "KPI Status Distribution"
rag_donut.height = 9
rag_donut.width = 10.5
rag_donut.holeSize = 55
data = Reference(ws_dash, min_col=9, min_row=RAG_TOP, max_row=RAG_BOTTOM)
cats = Reference(ws_dash, min_col=8, min_row=RAG_TOP, max_row=RAG_BOTTOM)
rag_donut.add_data(data, titles_from_data=False)
rag_donut.set_categories(cats)
pts = [DataPoint(idx=0), DataPoint(idx=1), DataPoint(idx=2)]
pts[0].graphicalProperties.solidFill = GREEN
pts[1].graphicalProperties.solidFill = AMBER
pts[2].graphicalProperties.solidFill = RED
rag_donut.series[0].data_points = pts
rag_donut.dataLabels = DataLabelList()
rag_donut.dataLabels.showVal = True
ws_dash.add_chart(rag_donut, f"O{CHART_ROW}")

CHART_BLOCK_BOTTOM = CHART_ROW + 19

ws_dash.print_area = f"A1:U{CHART_BLOCK_BOTTOM}"
ws_dash.page_setup.orientation = "landscape"
ws_dash.page_setup.fitToWidth = 1
ws_dash.page_setup.fitToHeight = 0
ws_dash.sheet_properties.pageSetUpPr = PageSetupProperties(fitToPage=True)
ws_dash.page_margins = PageMargins(left=0.3, right=0.3, top=0.4, bottom=0.4, header=0.2, footer=0.2)

wb.save("/home/user/hira-repo/dist/KPI_Dashboard.xlsx")
print(f"3 charts added. Chart block bottom ~ row {CHART_BLOCK_BOTTOM}.")

# ----------------------------------------------------------------------------
# SHEET 6 : ACTION DASHBOARD
# ----------------------------------------------------------------------------
AT = "Tbl_ActionTracker"
ws_adash.sheet_view.zoomScale = 90

ws_adash.merge_cells("A1:S2")
ws_adash["A1"] = "  ACTION DASHBOARD"
ws_adash["A1"].font = TITLE_FONT
ws_adash["A1"].fill = TITLE_FILL
ws_adash["A1"].alignment = Alignment(horizontal="left", vertical="center")
ws_adash.row_dimensions[1].height = 34
ws_adash.row_dimensions[2].height = 14

ws_adash.merge_cells("A3:S3")
ws_adash["A3"] = f'="  v{WORKBOOK_VERSION}   |   "&TEXT(TODAY(),"dddd, dd-mmm-yyyy")&"   |   updates automatically from Action Tracker"'
ws_adash["A3"].font = SUBTITLE_FONT
ws_adash["A3"].fill = TITLE_FILL
ws_adash["A3"].alignment = Alignment(horizontal="left", vertical="center")
ws_adash.row_dimensions[3].height = 20

# ---- stat cards ----
ACARD_SEC_ROW = 5
section_banner(ws_adash, ACARD_SEC_ROW, 1, 19, "ACTION SUMMARY")
ACARD_TOP = ACARD_SEC_ROW + 1
ACARD_H = 4
ACARD_W = 6

acard_defs = [
    ("Total Actions", f'=COUNTA({AT}[Action ID])'),
    ("Open", f'=COUNTIFS({AT}[Status],"Open")'),
    ("In Progress", f'=COUNTIFS({AT}[Status],"In Progress")'),
    ("Closed", f'=COUNTIFS({AT}[Status],"Closed")'),
    ("Overdue", f'=COUNTIFS({AT}[Overdue?],"Yes")'),
]
for idx, (label, formula) in enumerate(acard_defs):
    left = 1 + idx * ACARD_W
    right = left + ACARD_W - 1
    top = ACARD_TOP
    bottom = top + ACARD_H - 1
    for rr in range(top, bottom + 1):
        for cc in range(left, right + 1):
            ws_adash.cell(row=rr, column=cc).fill = CARD_FILL
    label_row, value_row = top + 1, top + 2
    ws_adash.merge_cells(start_row=label_row, start_column=left, end_row=label_row, end_column=right)
    lbl = ws_adash.cell(row=label_row, column=left, value=label.upper())
    lbl.font = CARD_LABEL_FONT
    lbl.alignment = CENTER
    lbl.fill = CARD_FILL
    ws_adash.merge_cells(start_row=value_row, start_column=left, end_row=value_row, end_column=right)
    val = ws_adash.cell(row=value_row, column=left, value=formula)
    val.font = CARD_VALUE_FONT
    val.alignment = CENTER
    val.fill = CARD_FILL
    for rr in range(top, bottom + 1):
        ws_adash.row_dimensions[rr].height = 14

ACARD_BLOCK_BOTTOM = ACARD_TOP + ACARD_H - 1

wb.save("/home/user/hira-repo/dist/KPI_Dashboard.xlsx")
print(f"Action Dashboard header + cards complete, block bottom {ACARD_BLOCK_BOTTOM}.")

# ----------------------------------------------------------------------------
# DEPARTMENT-WISE ACTION TABLE — sized to DEPT_CAPACITY, reads Master Config
# ----------------------------------------------------------------------------
ATBL_SEC_ROW = ACARD_BLOCK_BOTTOM + 2
section_banner(ws_adash, ATBL_SEC_ROW, 1, 10, "DEPARTMENT-WISE ACTIONS")

atbl_headers = ["Department", "Open", "In Progress", "Closed", "Overdue", "Status"]
ATBL_HDR_ROW = ATBL_SEC_ROW + 1
for j, h in enumerate(atbl_headers, start=1):
    ws_adash.cell(row=ATBL_HDR_ROW, column=j, value=h)
style_header_row(ws_adash, ATBL_HDR_ROW, 1, len(atbl_headers))

ATBL_TOP = ATBL_HDR_ROW + 1
for i in range(DEPT_CAPACITY):
    r = ATBL_TOP + i
    n = i + 1
    ws_adash.cell(row=r, column=1, value=f'=IF({n}<=COUNTA(DeptList),INDEX(DeptList,{n}),"")')
    ws_adash.cell(row=r, column=2, value=f'=IF($A{r}="","",COUNTIFS({AT}[Department],$A{r},{AT}[Status],"Open"))')
    ws_adash.cell(row=r, column=3, value=f'=IF($A{r}="","",COUNTIFS({AT}[Department],$A{r},{AT}[Status],"In Progress"))')
    ws_adash.cell(row=r, column=4, value=f'=IF($A{r}="","",COUNTIFS({AT}[Department],$A{r},{AT}[Status],"Closed"))')
    ws_adash.cell(row=r, column=5, value=f'=IF($A{r}="","",COUNTIFS({AT}[Department],$A{r},{AT}[Overdue?],"Yes"))')
    ws_adash.cell(row=r, column=6, value=f'=IF($A{r}="","",IF($E{r}>0,"Red",IF($B{r}>0,"Amber","Green")))')
    for j in range(1, 7):
        cell = ws_adash.cell(row=r, column=j)
        cell.font = BODY_FONT
        cell.border = BORDER_ALL
        cell.alignment = CENTER
    if i % 2 == 1:
        for j in range(1, 7):
            ws_adash.cell(row=r, column=j).fill = ALT_ROW_FILL

ATBL_BOTTOM = ATBL_TOP + DEPT_CAPACITY - 1

ws_adash.conditional_formatting.add(
    f"F{ATBL_TOP}:F{ATBL_BOTTOM}",
    FormulaRule(formula=[f'$F{ATBL_TOP}="Green"'], fill=PatternFill("solid", fgColor=GREEN_FILL), font=Font(color=GREEN, bold=True)))
ws_adash.conditional_formatting.add(
    f"F{ATBL_TOP}:F{ATBL_BOTTOM}",
    FormulaRule(formula=[f'$F{ATBL_TOP}="Amber"'], fill=PatternFill("solid", fgColor=AMBER_FILL), font=Font(color=AMBER, bold=True)))
ws_adash.conditional_formatting.add(
    f"F{ATBL_TOP}:F{ATBL_BOTTOM}",
    FormulaRule(formula=[f'$F{ATBL_TOP}="Red"'], fill=PatternFill("solid", fgColor=RED_FILL), font=Font(color=RED, bold=True)))
ws_adash.conditional_formatting.add(
    f"E{ATBL_TOP}:E{ATBL_BOTTOM}",
    CellIsRule(operator="greaterThan", formula=["0"], fill=PatternFill("solid", fgColor=RED_FILL), font=Font(color=RED, bold=True)))

autosize(ws_adash, {"A": 14, "B": 9, "C": 12, "D": 9, "E": 10, "F": 10})
for col_l in "GHIJKLMNOPQRS":
    ws_adash.column_dimensions[col_l].width = 8

print(f"Action Dashboard table rows {ATBL_TOP}-{ATBL_BOTTOM}.")

# ----------------------------------------------------------------------------
# ACTION DASHBOARD CHARTS
# ----------------------------------------------------------------------------
ACHART_SEC_ROW = ATBL_BOTTOM + 2
section_banner(ws_adash, ACHART_SEC_ROW, 1, 19, "CHARTS")
ACHART_ROW = ACHART_SEC_ROW + 1

ASTAT_HDR_ROW = ACHART_ROW
ws_adash.cell(row=ASTAT_HDR_ROW, column=22, value="Status").font = Font(name=FONT_NAME, size=9, bold=True, color="8A93A6")
ws_adash.cell(row=ASTAT_HDR_ROW, column=23, value="Count").font = Font(name=FONT_NAME, size=9, bold=True, color="8A93A6")
ASTAT_TOP = ASTAT_HDR_ROW + 1
for i, st in enumerate(STATUS_LIST):
    r = ASTAT_TOP + i
    ws_adash.cell(row=r, column=22, value=st).font = Font(name=FONT_NAME, size=9, color="8A93A6")
    ws_adash.cell(row=r, column=23, value=f'=COUNTIFS({AT}[Status],$V{r})').font = Font(name=FONT_NAME, size=9, color="8A93A6")
ASTAT_BOTTOM = ASTAT_TOP + len(STATUS_LIST) - 1
ws_adash.column_dimensions["V"].hidden = True
ws_adash.column_dimensions["W"].hidden = True

# 1) Department-wise open actions
open_bar = BarChart()
open_bar.type = "col"
open_bar.title = "Department-wise Open Actions"
open_bar.height = 9
open_bar.width = 10.5
data = Reference(ws_adash, min_col=2, min_row=ATBL_HDR_ROW, max_row=ATBL_BOTTOM)
cats = Reference(ws_adash, min_col=1, min_row=ATBL_TOP, max_row=ATBL_BOTTOM)
open_bar.add_data(data, titles_from_data=True)
open_bar.set_categories(cats)
open_bar.series[0].graphicalProperties.solidFill = RED
open_bar.legend = None
ws_adash.add_chart(open_bar, f"A{ACHART_ROW}")

# 2) Overdue actions by department
overdue_bar = BarChart()
overdue_bar.type = "col"
overdue_bar.title = "Overdue Actions by Department"
overdue_bar.height = 9
overdue_bar.width = 10.5
data = Reference(ws_adash, min_col=5, min_row=ATBL_HDR_ROW, max_row=ATBL_BOTTOM)
cats = Reference(ws_adash, min_col=1, min_row=ATBL_TOP, max_row=ATBL_BOTTOM)
overdue_bar.add_data(data, titles_from_data=True)
overdue_bar.set_categories(cats)
overdue_bar.series[0].graphicalProperties.solidFill = STEEL
overdue_bar.legend = None
ws_adash.add_chart(overdue_bar, f"H{ACHART_ROW}")

# 3) Action status distribution — donut
status_donut = DoughnutChart()
status_donut.title = "Action Status Distribution"
status_donut.height = 9
status_donut.width = 10.5
status_donut.holeSize = 55
data = Reference(ws_adash, min_col=23, min_row=ASTAT_TOP, max_row=ASTAT_BOTTOM)
cats = Reference(ws_adash, min_col=22, min_row=ASTAT_TOP, max_row=ASTAT_BOTTOM)
status_donut.add_data(data, titles_from_data=False)
status_donut.set_categories(cats)
spts = [DataPoint(idx=0), DataPoint(idx=1), DataPoint(idx=2)]
spts[0].graphicalProperties.solidFill = RED
spts[1].graphicalProperties.solidFill = AMBER
spts[2].graphicalProperties.solidFill = GREEN
status_donut.series[0].data_points = spts
status_donut.dataLabels = DataLabelList()
status_donut.dataLabels.showVal = True
ws_adash.add_chart(status_donut, f"O{ACHART_ROW}")

ACHART_BLOCK_BOTTOM = ACHART_ROW + 19

ws_adash.print_area = f"A1:U{ACHART_BLOCK_BOTTOM}"
ws_adash.page_setup.orientation = "landscape"
ws_adash.page_setup.fitToWidth = 1
ws_adash.page_setup.fitToHeight = 0
ws_adash.sheet_properties.pageSetUpPr = PageSetupProperties(fitToPage=True)
ws_adash.page_margins = PageMargins(left=0.3, right=0.3, top=0.4, bottom=0.4, header=0.2, footer=0.2)

wb.save("/home/user/hira-repo/dist/KPI_Dashboard.xlsx")
print(f"Action Dashboard charts complete, block bottom {ACHART_BLOCK_BOTTOM}.")

# ----------------------------------------------------------------------------
# SHEET 1 : READ ME  (version, change log, how to extend — keeps this workbook alive)
# ----------------------------------------------------------------------------
ws_read.merge_cells("A1:F1")
ws_read["A1"] = "READ ME — how this workbook is organised and how to extend it"
ws_read["A1"].font = Font(name=FONT_NAME, size=14, bold=True, color=WHITE)
ws_read["A1"].fill = TITLE_FILL
ws_read["A1"].alignment = LEFT
ws_read.row_dimensions[1].height = 30

ws_read["A3"] = "Version"
ws_read["A3"].font = BOLD_BODY_FONT
ws_read["B3"] = WORKBOOK_VERSION
ws_read["B3"].font = Font(name=FONT_NAME, size=11, bold=True, color=ACCENT_BLUE)
ws_read["A4"] = "Last updated"
ws_read["A4"].font = BOLD_BODY_FONT
ws_read["B4"] = BUILD_DATE
ws_read["B4"].number_format = "dd-mmm-yyyy"
ws_read["A5"] = "Maintained by"
ws_read["A5"].font = BOLD_BODY_FONT
ws_read["B5"] = "(fill in the name/role of whoever owns this file)"
ws_read["B5"].font = Font(name=FONT_NAME, size=10, italic=True, color="8A93A6")

section_banner(ws_read, 7, 1, 6, "HOW THIS WORKBOOK IS ORGANISED")
sheet_notes = [
    ("Read Me", "This sheet. Version, change log, and how to extend the workbook."),
    ("KPI Dashboard", "Executive view — scorecards, department ranking, RAG detail table, trend and status charts. Read-only; everything here is a formula."),
    ("KPI Data Entry", "Type Date / KPI Name / Actual / Remarks. Department, Target, Achievement % and Status auto-fill from Master Config."),
    ("Master Config", "The ONLY place to add, edit or retire a Department or KPI (name, unit, target, direction, RAG threshold, owner, active flag)."),
    ("Action Tracker", "Type actions raised against KPI gaps. Overdue is auto-flagged from the Due Date."),
    ("Action Dashboard", "Action summary cards, department-wise action table, and status charts."),
    ("Review Log", "Manager's daily / weekly / monthly review notes."),
    ("Tracker Dropdown Master", "Status/Priority lists for Action Tracker. Department & Owner lists link live to Master Config."),
]
r = 8
for name, note in sheet_notes:
    ws_read.cell(row=r, column=1, value=name).font = BOLD_BODY_FONT
    ws_read.merge_cells(start_row=r, start_column=2, end_row=r, end_column=6)
    c = ws_read.cell(row=r, column=2, value=note)
    c.font = BODY_FONT
    c.alignment = LEFT
    ws_read.row_dimensions[r].height = 28
    r += 1

HOWTO_ROW = r + 1
section_banner(ws_read, HOWTO_ROW, 1, 6, "HOW TO EXTEND THIS WORKBOOK")
howto = [
    "1. Add a KPI: go to Master Config -> KPI Config table, fill the next blank row (or insert a row within "
    "your department's block). Set Department, KPI Name, Unit, Target, Direction, RAG Threshold %, Owner, "
    "Active = Yes. It appears in KPI Data Entry's dropdown and on both dashboards immediately.",
    "2. Change a Target or RAG threshold: edit the value directly in Master Config -> KPI Config. Every "
    "dashboard recalculates automatically — no formula to touch.",
    "3. Retire a KPI without losing history: set Active = No in Master Config. Its past entries stay in KPI "
    "Data Entry, but it drops off the KPI Detail table and scorecards.",
    "4. Add a Department: go to Master Config -> Dept Config, fill the next blank row (up to 15 total). It "
    "appears in every Department dropdown and on both dashboards' department tables automatically.",
    "5. Capacity: this workbook is pre-wired for up to 15 departments and 40 KPIs (see the blank rows already "
    "in Master Config). If you outgrow that, extend the ranges named DeptList/KPINameList (Formulas -> Name "
    "Manager) and the KPI Detail / Department table row ranges on both dashboards to match.",
    "6. Please log every structural change (new KPI, new department, changed formula) in the Change Log below "
    "— that is what keeps this a living workbook instead of a frozen one-off.",
]
r = HOWTO_ROW + 1
for line in howto:
    ws_read.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6)
    c = ws_read.cell(row=r, column=1, value=line)
    c.font = BODY_FONT
    c.alignment = LEFT
    ws_read.row_dimensions[r].height = 30
    r += 1

CHANGELOG_ROW = r + 1
section_banner(ws_read, CHANGELOG_ROW, 1, 6, "CHANGE LOG")
cl_headers = ["Date", "Version", "Change Description", "Changed By"]
CL_HDR_ROW = CHANGELOG_ROW + 1
for j, h in enumerate(cl_headers, start=1):
    ws_read.cell(row=CL_HDR_ROW, column=j, value=h)
style_header_row(ws_read, CL_HDR_ROW, 1, len(cl_headers), height=24)
for j in range(1, 7):
    ws_read.cell(row=CL_HDR_ROW, column=j).border = BORDER_ALL

cl_rows = [
    (dt.date(2026, 7, 16), "1.0", "Initial simple KPI + Action Tracker dashboard.", "Generated"),
    (BUILD_DATE, WORKBOOK_VERSION, "Rebuilt config-driven: Master Config sheet for departments/KPIs/targets/"
     "thresholds, dynamic dropdowns, department ranking chart, RAG KPI detail table, this Read Me/Change Log.", "Generated"),
]
CL_TOP = CL_HDR_ROW + 1
for i, rec in enumerate(cl_rows):
    rr = CL_TOP + i
    for j, val in enumerate(rec, start=1):
        cell = ws_read.cell(row=rr, column=j, value=val)
        cell.font = BODY_FONT
        cell.border = BORDER_ALL
        cell.alignment = CENTER if j in (1, 2, 4) else LEFT
        if j == 1:
            cell.number_format = "dd-mmm-yyyy"
CL_BOTTOM = CL_TOP + len(cl_rows) - 1
CL_BUFFER = 15
for k in range(CL_BUFFER):
    rr = CL_BOTTOM + 1 + k
    for j in range(1, 5):
        cell = ws_read.cell(row=rr, column=j)
        cell.font = BODY_FONT
        cell.border = BORDER_ALL
    ws_read.cell(row=rr, column=1).number_format = "dd-mmm-yyyy"
CL_TOTAL_LAST = CL_BOTTOM + CL_BUFFER

cl_tab = Table(displayName="Tbl_ChangeLog", ref=f"A{CL_HDR_ROW}:D{CL_TOTAL_LAST}")
cl_tab.tableStyleInfo = TableStyleInfo(name="TableStyleMedium2", showRowStripes=True)
ws_read.add_table(cl_tab)

autosize(ws_read, {"A": 24, "B": 10, "C": 60, "D": 14, "E": 3, "F": 3})
ws_read.freeze_panes = "A2"

print("Read Me sheet complete.")

# ----------------------------------------------------------------------------
# FINAL WORKBOOK POLISH
# ----------------------------------------------------------------------------
for ws in (ws_read, ws_entry, ws_config, ws_action, ws_review, ws_tmaster):
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr = PageSetupProperties(fitToPage=True)
    ws.page_margins = PageMargins(left=0.3, right=0.3, top=0.4, bottom=0.4, header=0.2, footer=0.2)

wb.calculation.fullCalcOnLoad = True
wb.active = wb.sheetnames.index("KPI Dashboard")
for name in wb.sheetnames:
    wb[name].sheet_view.tabSelected = (name == "KPI Dashboard")
ws_dash.sheet_view.selection[0].activeCell = "A1"
ws_dash.sheet_view.selection[0].sqref = "A1"

wb.properties.title = "KPI & Action Tracker Dashboard"
wb.properties.creator = "KPI Dashboard Generator"
wb.properties.description = (f"v{WORKBOOK_VERSION} — config-driven KPI + Action Tracker dashboard. "
                              "Add/edit departments and KPIs in Master Config; enter data in KPI Data Entry "
                              "and Action Tracker. Both dashboards refresh automatically. See the Read Me sheet.")

OUT_PATH = "/home/user/hira-repo/dist/KPI_Dashboard.xlsx"
wb.save(OUT_PATH)
print("Final polish complete. Workbook saved.")

# ----------------------------------------------------------------------------
# SELF-CHECK
# ----------------------------------------------------------------------------
def self_check(path):
    problems = []

    with zipfile.ZipFile(path) as z:
        bad_entry = z.testzip()
        if bad_entry:
            problems.append(f"Corrupt zip entry: {bad_entry}")

        import xml.dom.minidom as m
        for name in z.namelist():
            if name.endswith(".xml") or name.endswith(".rels"):
                try:
                    m.parseString(z.read(name))
                except Exception as e:
                    problems.append(f"Malformed XML in {name}: {e}")

        for name in z.namelist():
            if re.match(r"xl/worksheets/sheet\d+\.xml$", name):
                xml_text = z.read(name).decode("utf-8", errors="replace")
                for m2 in re.finditer(r"<formula1>(.*?)</formula1>", xml_text, re.S):
                    if m2.group(1).lstrip().startswith("="):
                        problems.append(f"Illegal leading '=' in <formula1> in {name}: {m2.group(1)!r}")

        wb_xml = z.read("xl/workbook.xml").decode("utf-8", errors="replace")
        for m3 in re.finditer(r"<definedName[^>]*>(.*?)</definedName>", wb_xml, re.S):
            if m3.group(1).lstrip().startswith("="):
                problems.append(f"Illegal leading '=' in <definedName>: {m3.group(1)!r}")

        for name in z.namelist():
            if re.match(r"xl/charts/chart\d+\.xml$", name):
                xml_text = z.read(name).decode("utf-8", errors="replace")
                has_bar = "<barChart>" in xml_text
                has_line = "<lineChart>" in xml_text
                if has_bar and has_line:
                    problems.append(f"Combo bar+line chart found in {name} (secondary-axis combos are "
                                     f"intentionally avoided in this workbook for reliability)")

    from openpyxl import load_workbook
    wb_check = load_workbook(path)

    total_formulas = 0
    for wsname in wb_check.sheetnames:
        ws = wb_check[wsname]
        for row in ws.iter_rows():
            for cell in row:
                v = cell.value
                if isinstance(v, str) and v.startswith("="):
                    total_formulas += 1
                    if v.count("(") != v.count(")"):
                        problems.append(f"Unbalanced parens in {wsname}!{cell.coordinate}: {v}")

    def overlaps(a, b):
        return not (a.max_row < b.min_row or b.max_row < a.min_row or
                    a.max_col < b.min_col or b.max_col < a.min_col)

    for wsname in wb_check.sheetnames:
        ws = wb_check[wsname]
        ranges = list(ws.merged_cells.ranges)
        for i in range(len(ranges)):
            for j in range(i + 1, len(ranges)):
                if overlaps(ranges[i], ranges[j]):
                    problems.append(f"Overlapping merged ranges in {wsname}: {ranges[i]} vs {ranges[j]}")

    expected_names = {"DeptList", "KPINameList", "OwnerList", "ActionStatusList", "PriorityList", "DeptListWithAll"}
    missing = expected_names - set(wb_check.defined_names.keys())
    if missing:
        problems.append(f"Missing expected named ranges: {missing}")

    print(f"Self-check: {total_formulas} formula cells scanned across {len(wb_check.sheetnames)} sheets.")
    if problems:
        print("SELF-CHECK FAILED:")
        for p in problems:
            print(" -", p)
        raise SystemExit(1)
    print("Self-check passed: no repair-triggering defects found.")


self_check(OUT_PATH)
