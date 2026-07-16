"""
Generator for a simple, interactive KPI + Action Tracker dashboard workbook.
Run: python3 tools/build_kpi_dashboard.py
Produces: dist/KPI_Dashboard.xlsx

No VBA anywhere. Only formulas, Excel Tables, Conditional Formatting and
native charts (Bar / Doughnut). Kept deliberately simple: one filter,
plain lookups, no combo/secondary-axis charts, no hidden calc engines.

A self-check runs at the end of this script and raises an error if it
finds the exact XML defect that caused a previous version of this
workbook to fail Excel's "needs repair" check (a data-validation formula
with a stray leading "=").
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


# ----------------------------------------------------------------------------
# WORKBOOK
# ----------------------------------------------------------------------------
wb = Workbook()
wb.remove(wb.active)

ws_dash = wb.create_sheet("KPI Dashboard")
ws_entry = wb.create_sheet("KPI Data Entry")
ws_master = wb.create_sheet("Master Dropdown")
ws_action = wb.create_sheet("Action Tracker")
ws_adash = wb.create_sheet("Action Dashboard")
ws_review = wb.create_sheet("Review Log")
ws_tmaster = wb.create_sheet("Tracker Dropdown Master")

for ws in (ws_dash, ws_entry, ws_master, ws_action, ws_adash, ws_review, ws_tmaster):
    ws.sheet_view.showGridLines = False

print("Sheets created:", wb.sheetnames)

# ----------------------------------------------------------------------------
# DATA MODEL
# ----------------------------------------------------------------------------
DEPARTMENTS = ["Safety", "Production", "Quality", "Maintenance",
               "Utilities", "Warehouse", "HR", "Engineering"]

# Department, KPI Name, Unit, Target, Direction, Owner
KPI_DEFS = [
    ("Safety", "Safety Incidents", "Count", 0, "Lower is Better", "Safety Officer"),
    ("Production", "Production Output", "Units", 1000, "Higher is Better", "Production Manager"),
    ("Quality", "Defect Rate %", "%", 0.02, "Lower is Better", "Quality Manager"),
    ("Maintenance", "Unplanned Downtime (Hrs)", "Hours", 1, "Lower is Better", "Maintenance Manager"),
    ("Utilities", "Power Consumption (kWh)", "kWh", 4500, "Lower is Better", "Utilities Engineer"),
    ("Warehouse", "On-Time Dispatch %", "%", 0.95, "Higher is Better", "Warehouse Manager"),
    ("HR", "Absenteeism %", "%", 0.03, "Lower is Better", "HR Manager"),
    ("Engineering", "Milestone Adherence %", "%", 0.9, "Higher is Better", "Engineering Manager"),
]

# ----------------------------------------------------------------------------
# SHEET 3 : MASTER DROPDOWN  (KPI definitions + shared lists)
# ----------------------------------------------------------------------------
ws_master["A1"] = "MASTER DROPDOWN — KPI definitions used to auto-fill KPI Data Entry"
ws_master.merge_cells("A1:F1")
ws_master["A1"].font = Font(name=FONT_NAME, size=12, bold=True, color=WHITE)
ws_master["A1"].fill = TITLE_FILL
ws_master["A1"].alignment = LEFT
ws_master.row_dimensions[1].height = 26

kpim_headers = ["Department", "KPI Name", "Unit", "Target", "Direction", "Owner"]
for j, h in enumerate(kpim_headers, start=1):
    ws_master.cell(row=2, column=j, value=h)
style_header_row(ws_master, 2, 1, len(kpim_headers))

for i, rec in enumerate(KPI_DEFS, start=3):
    for j, val in enumerate(rec, start=1):
        cell = ws_master.cell(row=i, column=j, value=val)
        cell.font = BODY_FONT
        cell.border = BORDER_ALL
        cell.alignment = CENTER if j != 2 else LEFT
        if j == 4 and rec[2] == "%":
            cell.number_format = "0%"
    if (i % 2) == 0:
        for j in range(1, len(kpim_headers) + 1):
            ws_master.cell(row=i, column=j).fill = ALT_ROW_FILL

last_master_row = 2 + len(KPI_DEFS)
master_tab = Table(displayName="Tbl_KPIMaster", ref=f"A2:F{last_master_row}")
master_tab.tableStyleInfo = TableStyleInfo(name="TableStyleMedium2", showRowStripes=True)
ws_master.add_table(master_tab)

# Shared lists used across every sheet's dropdowns
ws_master.cell(row=2, column=8, value="Department List").font = BOLD_BODY_FONT
for i, d in enumerate(DEPARTMENTS, start=3):
    ws_master.cell(row=i, column=8, value=d)
dept_last = 2 + len(DEPARTMENTS)

ws_master.cell(row=2, column=9, value="Status List").font = BOLD_BODY_FONT
for i, s in enumerate(["Green", "Amber", "Red"], start=3):
    ws_master.cell(row=i, column=9, value=s)

wb.defined_names["DeptList"] = DefinedName("DeptList", attr_text=f"'Master Dropdown'!$H$3:$H${dept_last}")

autosize(ws_master, {"A": 15, "B": 26, "C": 10, "D": 12, "E": 18, "F": 22, "G": 3, "H": 14, "I": 10})
ws_master.freeze_panes = "A3"

print(f"Master Dropdown built. {len(KPI_DEFS)} KPIs, {len(DEPARTMENTS)} departments.")

# ----------------------------------------------------------------------------
# SHEET 2 : KPI DATA ENTRY  (the only sheet users type KPI data into)
# ----------------------------------------------------------------------------
entry_headers = ["Date", "Month", "Week", "Department", "KPI Name", "Target",
                  "Actual", "Achievement %", "Status", "Remarks"]

ws_entry["A1"] = "KPI DATA ENTRY — type only Date / Department / Actual / Remarks. Everything else auto-fills."
ws_entry.merge_cells("A1:J1")
ws_entry["A1"].font = Font(name=FONT_NAME, size=12, bold=True, color=WHITE)
ws_entry["A1"].fill = TITLE_FILL
ws_entry["A1"].alignment = LEFT
ws_entry.row_dimensions[1].height = 28

for j, h in enumerate(entry_headers, start=1):
    ws_entry.cell(row=2, column=j, value=h)
style_header_row(ws_entry, 2, 1, len(entry_headers))

TODAY = dt.date(2026, 7, 16)
N_DAYS = 45
start_date = TODAY - dt.timedelta(days=N_DAYS - 1)

remarks_bank = ["Within normal range", "Line changeover impact", "Vendor delay", "Manpower shortage",
                "Preventive check done", "Awaiting spares", "Process improvement in progress", ""]

data_rows = []
for day_idx in range(N_DAYS):
    the_date = start_date + dt.timedelta(days=day_idx)
    for dept, kpi, unit, target, direction, owner in KPI_DEFS:
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
        data_rows.append((the_date, dept, actual))

first_data_row = 3
last_data_row = first_data_row + len(data_rows) - 1

MST = "Tbl_KPIMaster"
for i, (the_date, dept, actual) in enumerate(data_rows):
    r = first_data_row + i
    ws_entry.cell(row=r, column=1, value=the_date).number_format = "dd-mmm-yyyy"
    ws_entry.cell(row=r, column=2, value=f'=IF($A{r}="","",TEXT($A{r},"mmm-yyyy"))')
    ws_entry.cell(row=r, column=3, value=f'=IF($A{r}="","","W"&WEEKNUM($A{r},2))')
    ws_entry.cell(row=r, column=4, value=dept)
    ws_entry.cell(row=r, column=5, value=f'=IFERROR(INDEX({MST}[KPI Name],MATCH($D{r},{MST}[Department],0)),"")')
    ws_entry.cell(row=r, column=6, value=f'=IFERROR(INDEX({MST}[Target],MATCH($D{r},{MST}[Department],0)),"")')
    ws_entry.cell(row=r, column=7, value=actual)
    ws_entry.cell(row=r, column=8,
        value=(f'=IFERROR(IF(INDEX({MST}[Direction],MATCH($D{r},{MST}[Department],0))="Lower is Better",'
               f'IF($G{r}=0,1,IF($F{r}=0,0,$F{r}/$G{r})),'
               f'IF($F{r}=0,1,$G{r}/$F{r})),0)'))
    ws_entry.cell(row=r, column=9, value=f'=IF($H{r}>=1,"Green",IF($H{r}>=0.85,"Amber","Red"))')
    ws_entry.cell(row=r, column=10, value=random.choice(remarks_bank))
    for j in range(1, 11):
        cell = ws_entry.cell(row=r, column=j)
        cell.font = BODY_FONT
        cell.border = BORDER_ALL
        cell.alignment = CENTER if j != 10 else LEFT
        if j == 8:
            cell.number_format = "0.0%"

# blank buffer rows so the table auto-expands with formulas already in place
BUFFER_ROWS = 40
for k in range(BUFFER_ROWS):
    r = last_data_row + 1 + k
    ws_entry.cell(row=r, column=2, value=f'=IF($A{r}="","",TEXT($A{r},"mmm-yyyy"))')
    ws_entry.cell(row=r, column=3, value=f'=IF($A{r}="","","W"&WEEKNUM($A{r},2))')
    ws_entry.cell(row=r, column=5, value=f'=IFERROR(INDEX({MST}[KPI Name],MATCH($D{r},{MST}[Department],0)),"")')
    ws_entry.cell(row=r, column=6, value=f'=IFERROR(INDEX({MST}[Target],MATCH($D{r},{MST}[Department],0)),"")')
    ws_entry.cell(row=r, column=8,
        value=(f'=IFERROR(IF(INDEX({MST}[Direction],MATCH($D{r},{MST}[Department],0))="Lower is Better",'
               f'IF($G{r}=0,1,IF($F{r}=0,0,$F{r}/$G{r})),'
               f'IF($F{r}=0,1,$G{r}/$F{r})),0)'))
    ws_entry.cell(row=r, column=9, value=f'=IF($H{r}>=1,"Green",IF($H{r}>=0.85,"Amber","Red"))')
    for j in range(1, 11):
        cell = ws_entry.cell(row=r, column=j)
        cell.font = BODY_FONT
        cell.border = BORDER_ALL
        cell.alignment = CENTER if j != 10 else LEFT
        if j == 8:
            cell.number_format = "0.0%"

total_last_row = last_data_row + BUFFER_ROWS

for r in range(first_data_row, total_last_row + 1):
    if (r - first_data_row) % 2 == 1:
        for j in range(1, 11):
            c = ws_entry.cell(row=r, column=j)
            if c.fill.fgColor.rgb in (None, "00000000"):
                c.fill = ALT_ROW_FILL

entry_tab = Table(displayName="Tbl_Entry", ref=f"A2:J{total_last_row}")
entry_tab.tableStyleInfo = TableStyleInfo(name="TableStyleMedium2", showRowStripes=True)
ws_entry.add_table(entry_tab)

dv_dept = DataValidation(type="list", formula1="DeptList", allow_blank=False, showDropDown=False)
dv_dept.error = "Please choose a department from the list."
dv_dept.errorTitle = "Invalid Department"
ws_entry.add_data_validation(dv_dept)
dv_dept.add(f"D3:D{total_last_row}")

ws_entry.conditional_formatting.add(
    f"I3:I{total_last_row}",
    FormulaRule(formula=['$I3="Green"'], fill=PatternFill("solid", fgColor=GREEN_FILL), font=Font(color=GREEN, bold=True)))
ws_entry.conditional_formatting.add(
    f"I3:I{total_last_row}",
    FormulaRule(formula=['$I3="Amber"'], fill=PatternFill("solid", fgColor=AMBER_FILL), font=Font(color=AMBER, bold=True)))
ws_entry.conditional_formatting.add(
    f"I3:I{total_last_row}",
    FormulaRule(formula=['$I3="Red"'], fill=PatternFill("solid", fgColor=RED_FILL), font=Font(color=RED, bold=True)))

autosize(ws_entry, {"A": 12, "B": 11, "C": 7, "D": 13, "E": 22, "F": 10, "G": 10,
                     "H": 12, "I": 10, "J": 26})
ws_entry.freeze_panes = "A3"

print(f"KPI Data Entry: {len(data_rows)} sample rows ({first_data_row}-{last_data_row}), buffer to {total_last_row}.")

# ----------------------------------------------------------------------------
# SHEET 7 : TRACKER DROPDOWN MASTER
# ----------------------------------------------------------------------------
ws_tmaster["A1"] = "TRACKER DROPDOWN MASTER — dropdown lists used by Action Tracker"
ws_tmaster.merge_cells("A1:D1")
ws_tmaster["A1"].font = Font(name=FONT_NAME, size=12, bold=True, color=WHITE)
ws_tmaster["A1"].fill = TITLE_FILL
ws_tmaster["A1"].alignment = LEFT
ws_tmaster.row_dimensions[1].height = 26

OWNERS = [kpi[5] for kpi in KPI_DEFS]
STATUS_LIST = ["Open", "In Progress", "Closed"]
PRIORITY_LIST = ["Low", "Medium", "High"]

lists = [("Department", DEPARTMENTS), ("Owner", OWNERS), ("Status", STATUS_LIST), ("Priority", PRIORITY_LIST)]
for col, (label, items) in enumerate(lists, start=1):
    c = ws_tmaster.cell(row=2, column=col, value=label)
    c.font = HEADER_FONT
    c.fill = HEADER_FILL
    c.alignment = CENTER
    c.border = BORDER_ALL
    for i, item in enumerate(items, start=3):
        cell = ws_tmaster.cell(row=i, column=col, value=item)
        cell.font = BODY_FONT
        cell.border = BORDER_ALL
        cell.alignment = CENTER

wb.defined_names["TrackerDeptList"] = DefinedName("TrackerDeptList", attr_text=f"'Tracker Dropdown Master'!$A$3:$A${2+len(DEPARTMENTS)}")
wb.defined_names["OwnerList"] = DefinedName("OwnerList", attr_text=f"'Tracker Dropdown Master'!$B$3:$B${2+len(OWNERS)}")
wb.defined_names["ActionStatusList"] = DefinedName("ActionStatusList", attr_text=f"'Tracker Dropdown Master'!$C$3:$C${2+len(STATUS_LIST)}")
wb.defined_names["PriorityList"] = DefinedName("PriorityList", attr_text=f"'Tracker Dropdown Master'!$D$3:$D${2+len(PRIORITY_LIST)}")

autosize(ws_tmaster, {"A": 16, "B": 22, "C": 14, "D": 12})
ws_tmaster.freeze_panes = "A3"

print("Tracker Dropdown Master built.")

# ----------------------------------------------------------------------------
# SHEET 4 : ACTION TRACKER
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

N_ACTIONS = 24
action_first = 3
action_status_bank = STATUS_LIST
action_priority_bank = PRIORITY_LIST

action_data = []
for i in range(N_ACTIONS):
    dept, issue, act = random.choice(issues_bank)
    owner = dict(zip(DEPARTMENTS, OWNERS))[dept]
    raised = TODAY - dt.timedelta(days=random.randint(0, 30))
    due = raised + dt.timedelta(days=random.randint(2, 10))
    status = random.choices(action_status_bank, weights=[3, 3, 4])[0]
    completion = 100 if status == "Closed" else (random.choice([0, 25, 50, 75]) if status == "In Progress" else 0)
    priority = random.choices(action_priority_bank, weights=[3, 4, 3])[0]
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

dv_adept = DataValidation(type="list", formula1="TrackerDeptList", allow_blank=True, showDropDown=False)
ws_action.add_data_validation(dv_adept)
dv_adept.add(f"C3:C{action_total_last}")

dv_aowner = DataValidation(type="list", formula1="OwnerList", allow_blank=True, showDropDown=False)
ws_action.add_data_validation(dv_aowner)
dv_aowner.add(f"F3:F{action_total_last}")

dv_astatus = DataValidation(type="list", formula1="ActionStatusList", allow_blank=True, showDropDown=False)
ws_action.add_data_validation(dv_astatus)
dv_astatus.add(f"H3:H{action_total_last}")

dv_apriority = DataValidation(type="list", formula1="PriorityList", allow_blank=True, showDropDown=False)
ws_action.add_data_validation(dv_apriority)
dv_apriority.add(f"I3:I{action_total_last}")

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
# SHEET 6 : REVIEW LOG  (manager's daily/weekly/monthly review notes)
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

REVIEW_TYPES = ["Daily", "Weekly", "Monthly"]
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

dv_rtype = DataValidation(type="list", formula1='"Daily,Weekly,Monthly"', allow_blank=True, showDropDown=False)
ws_review.add_data_validation(dv_rtype)
dv_rtype.add(f"B3:B{rv_total_last}")

dv_rdept = DataValidation(type="list", formula1='"All Departments,Safety,Production,Quality,Maintenance,Utilities,Warehouse,HR,Engineering"',
                           allow_blank=True, showDropDown=False)
ws_review.add_data_validation(dv_rdept)
dv_rdept.add(f"C3:C{rv_total_last}")

dv_rstatus = DataValidation(type="list", formula1='"Open,In Progress,Closed"', allow_blank=True, showDropDown=False)
ws_review.add_data_validation(dv_rstatus)
dv_rstatus.add(f"G3:G{rv_total_last}")

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
# SHEET 1 : KPI DASHBOARD
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
ws_dash["A3"] = '="  Department-wise performance   |   "&TEXT(TODAY(),"dddd, dd-mmm-yyyy")&"   |   updates automatically from KPI Data Entry"'
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

dv_dmonth = DataValidation(type="list", formula1=month_list_formula, allow_blank=False, showDropDown=False)
ws_dash.add_data_validation(dv_dmonth)
dv_dmonth.add(f"B{FROW}")

wb.save("/home/user/hira-repo/dist/KPI_Dashboard.xlsx")
print("KPI Dashboard header + filter complete.")

# ----------------------------------------------------------------------------
# KPI SCORECARDS  (Overall + 8 departments = 9 cards, 3x3 grid)
# ----------------------------------------------------------------------------
CARD_SEC_ROW = FROW + 2
section_banner(ws_dash, CARD_SEC_ROW, 1, 19, "KPI SCORECARDS (Achievement %)")

CARD_TOP = CARD_SEC_ROW + 1
CARD_H = 4
CARD_W = 6
CARD_COLS = 3

card_defs = [("Overall Plant", None)] + [(d, d) for d in DEPARTMENTS]
SCORE_CELLS = {}
for idx, (label, dept) in enumerate(card_defs):
    row_block = idx // CARD_COLS
    col_block = idx % CARD_COLS
    top = CARD_TOP + row_block * (CARD_H + 1)
    left = 1 + col_block * CARD_W
    right = left + CARD_W - 1
    bottom = top + CARD_H - 1

    for rr in range(top, bottom + 1):
        for cc in range(left, right + 1):
            ws_dash.cell(row=rr, column=cc).fill = CARD_FILL

    label_row = top + 1
    value_row = top + 2
    ws_dash.merge_cells(start_row=label_row, start_column=left, end_row=label_row, end_column=right)
    lbl = ws_dash.cell(row=label_row, column=left, value=label.upper())
    lbl.font = CARD_LABEL_FONT
    lbl.alignment = CENTER
    lbl.fill = CARD_FILL

    if dept is None:
        formula = f'=IFERROR(AVERAGEIFS({EN}[Achievement %],{EN}[Month],IF({MONTH_CELL}="All","*",{MONTH_CELL})),0)'
    else:
        formula = (f'=IFERROR(AVERAGEIFS({EN}[Achievement %],{EN}[Department],"{dept}",'
                   f'{EN}[Month],IF({MONTH_CELL}="All","*",{MONTH_CELL})),0)')
    ws_dash.merge_cells(start_row=value_row, start_column=left, end_row=value_row, end_column=right)
    val = ws_dash.cell(row=value_row, column=left, value=formula)
    val.font = CARD_VALUE_FONT
    val.alignment = CENTER
    val.fill = CARD_FILL
    val.number_format = "0.0%"
    SCORE_CELLS[label] = f"{get_column_letter(left)}{value_row}"

    for rr in range(top, bottom + 1):
        ws_dash.row_dimensions[rr].height = 14

for label, cellref in SCORE_CELLS.items():
    ws_dash.conditional_formatting.add(
        cellref, CellIsRule(operator="greaterThanOrEqual", formula=["1"], font=Font(color="7BD88F", bold=True, size=18, name=FONT_NAME)))
    ws_dash.conditional_formatting.add(
        cellref, CellIsRule(operator="between", formula=["0.85", "1"], font=Font(color="FFD966", bold=True, size=18, name=FONT_NAME)))
    ws_dash.conditional_formatting.add(
        cellref, CellIsRule(operator="lessThan", formula=["0.85"], font=Font(color="FF8A80", bold=True, size=18, name=FONT_NAME)))

CARD_BLOCK_BOTTOM = CARD_TOP + 2 * (CARD_H + 1) + CARD_H - 1  # 3 rows of cards

wb.save("/home/user/hira-repo/dist/KPI_Dashboard.xlsx")
print(f"KPI scorecards complete, block bottom row {CARD_BLOCK_BOTTOM}.")

# ----------------------------------------------------------------------------
# DEPARTMENT PERFORMANCE TABLE  (with RAG colour indicators)
# ----------------------------------------------------------------------------
TBL_SEC_ROW = CARD_BLOCK_BOTTOM + 2
section_banner(ws_dash, TBL_SEC_ROW, 1, 10, "DEPARTMENT PERFORMANCE")

tbl_headers = ["Department", "KPI Name", "Target", "Actual (avg)", "Achievement %", "Status"]
TBL_HDR_ROW = TBL_SEC_ROW + 1
for j, h in enumerate(tbl_headers, start=1):
    ws_dash.cell(row=TBL_HDR_ROW, column=j, value=h)
style_header_row(ws_dash, TBL_HDR_ROW, 1, len(tbl_headers))

TBL_TOP = TBL_HDR_ROW + 1
for i, dept in enumerate(DEPARTMENTS):
    r = TBL_TOP + i
    ws_dash.cell(row=r, column=1, value=dept)
    ws_dash.cell(row=r, column=2, value=f'=IFERROR(INDEX({MST}[KPI Name],MATCH($A{r},{MST}[Department],0)),"")')
    ws_dash.cell(row=r, column=3, value=f'=IFERROR(INDEX({MST}[Target],MATCH($A{r},{MST}[Department],0)),0)')
    ws_dash.cell(row=r, column=4,
        value=f'=IFERROR(AVERAGEIFS({EN}[Actual],{EN}[Department],$A{r},{EN}[Month],IF({MONTH_CELL}="All","*",{MONTH_CELL})),0)')
    ws_dash.cell(row=r, column=5, value=f'=IFERROR(AVERAGEIFS({EN}[Achievement %],{EN}[Department],$A{r},{EN}[Month],IF({MONTH_CELL}="All","*",{MONTH_CELL})),0)')
    ws_dash.cell(row=r, column=6, value=f'=IF($E{r}>=1,"Green",IF($E{r}>=0.85,"Amber","Red"))')
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

TBL_BOTTOM = TBL_TOP + len(DEPARTMENTS) - 1

ws_dash.conditional_formatting.add(
    f"F{TBL_TOP}:F{TBL_BOTTOM}",
    FormulaRule(formula=[f'$F{TBL_TOP}="Green"'], fill=PatternFill("solid", fgColor=GREEN_FILL), font=Font(color=GREEN, bold=True)))
ws_dash.conditional_formatting.add(
    f"F{TBL_TOP}:F{TBL_BOTTOM}",
    FormulaRule(formula=[f'$F{TBL_TOP}="Amber"'], fill=PatternFill("solid", fgColor=AMBER_FILL), font=Font(color=AMBER, bold=True)))
ws_dash.conditional_formatting.add(
    f"F{TBL_TOP}:F{TBL_BOTTOM}",
    FormulaRule(formula=[f'$F{TBL_TOP}="Red"'], fill=PatternFill("solid", fgColor=RED_FILL), font=Font(color=RED, bold=True)))
ws_dash.conditional_formatting.add(
    f"A{TBL_TOP}:F{TBL_BOTTOM}",
    FormulaRule(formula=[f'$E{TBL_TOP}=MAX($E${TBL_TOP}:$E${TBL_BOTTOM})'], fill=PatternFill("solid", fgColor="D6F5DD")))
ws_dash.conditional_formatting.add(
    f"A{TBL_TOP}:F{TBL_BOTTOM}",
    FormulaRule(formula=[f'$E{TBL_TOP}=MIN($E${TBL_TOP}:$E${TBL_BOTTOM})'], fill=PatternFill("solid", fgColor="FBE0DE")))

autosize(ws_dash, {"A": 14, "B": 22, "C": 10, "D": 12, "E": 13, "F": 10})
for col_l in "GHIJKLMNOPQRS":
    ws_dash.column_dimensions[col_l].width = 8

print(f"Department table rows {TBL_TOP}-{TBL_BOTTOM}.")

# ----------------------------------------------------------------------------
# CHART HELPER DATA — weekly trend + RAG distribution (small, visible tables)
# ----------------------------------------------------------------------------
HELP_SEC_ROW = TBL_BOTTOM + 2
section_banner(ws_dash, HELP_SEC_ROW, 1, 10, "CHART DATA (auto — do not delete)")

# Weekly trend: one row per distinct week label present in the sample data
distinct_weeks = []
seen_w = set()
for d in range(N_DAYS):
    wk = "W" + str((start_date + dt.timedelta(days=d)).isocalendar()[1])
    if wk not in seen_w:
        seen_w.add(wk)
        distinct_weeks.append(wk)

WEEK_HDR_ROW = HELP_SEC_ROW + 1
ws_dash.cell(row=WEEK_HDR_ROW, column=1, value="Week")
ws_dash.cell(row=WEEK_HDR_ROW, column=2, value="Overall Achievement %")
for j in (1, 2):
    c = ws_dash.cell(row=WEEK_HDR_ROW, column=j)
    c.font = Font(name=FONT_NAME, size=9, bold=True, color="8A93A6")
WEEK_TOP = WEEK_HDR_ROW + 1
for i, wk in enumerate(distinct_weeks):
    r = WEEK_TOP + i
    ws_dash.cell(row=r, column=1, value=wk).font = Font(name=FONT_NAME, size=9, color="8A93A6")
    ws_dash.cell(row=r, column=2,
        value=f'=IFERROR(AVERAGEIFS({EN}[Achievement %],{EN}[Week],$A{r}),0)')
    ws_dash.cell(row=r, column=2).font = Font(name=FONT_NAME, size=9, color="8A93A6")
    ws_dash.cell(row=r, column=2).number_format = "0%"
WEEK_BOTTOM = WEEK_TOP + len(distinct_weeks) - 1

# RAG distribution: count of KPI-days by Status, respecting the Month filter
RAG_HDR_ROW = WEEK_BOTTOM + 2
ws_dash.cell(row=RAG_HDR_ROW, column=1, value="Status")
ws_dash.cell(row=RAG_HDR_ROW, column=2, value="Count")
for j in (1, 2):
    c = ws_dash.cell(row=RAG_HDR_ROW, column=j)
    c.font = Font(name=FONT_NAME, size=9, bold=True, color="8A93A6")
RAG_TOP = RAG_HDR_ROW + 1
for i, st in enumerate(["Green", "Amber", "Red"]):
    r = RAG_TOP + i
    ws_dash.cell(row=r, column=1, value=st).font = Font(name=FONT_NAME, size=9, color="8A93A6")
    ws_dash.cell(row=r, column=2,
        value=f'=COUNTIFS({EN}[Status],$A{r},{EN}[Month],IF({MONTH_CELL}="All","*",{MONTH_CELL}))')
    ws_dash.cell(row=r, column=2).font = Font(name=FONT_NAME, size=9, color="8A93A6")
RAG_BOTTOM = RAG_TOP + 2

wb.save("/home/user/hira-repo/dist/KPI_Dashboard.xlsx")
print(f"Chart helper data: weeks {WEEK_TOP}-{WEEK_BOTTOM}, RAG {RAG_TOP}-{RAG_BOTTOM}.")

# ----------------------------------------------------------------------------
# CHARTS
# ----------------------------------------------------------------------------
CHART_SEC_ROW = RAG_BOTTOM + 2
section_banner(ws_dash, CHART_SEC_ROW, 1, 19, "CHARTS")
CHART_ROW = CHART_SEC_ROW + 1

# 1) Department-wise bar chart — Achievement % by department
dept_bar = BarChart()
dept_bar.type = "col"
dept_bar.title = "Department-wise Achievement %"
dept_bar.height = 9
dept_bar.width = 10.5
data = Reference(ws_dash, min_col=5, min_row=TBL_HDR_ROW, max_row=TBL_BOTTOM)
cats = Reference(ws_dash, min_col=1, min_row=TBL_TOP, max_row=TBL_BOTTOM)
dept_bar.add_data(data, titles_from_data=True)
dept_bar.set_categories(cats)
dept_bar.y_axis.numFmt = "0%"
dept_bar.series[0].graphicalProperties.solidFill = ACCENT_BLUE
dept_bar.legend = None
ws_dash.add_chart(dept_bar, f"A{CHART_ROW}")

# 2) Weekly trend bar chart — overall Achievement % by week
week_bar = BarChart()
week_bar.type = "col"
week_bar.title = "Weekly Trend — Overall Achievement %"
week_bar.height = 9
week_bar.width = 10.5
data = Reference(ws_dash, min_col=2, min_row=WEEK_HDR_ROW, max_row=WEEK_BOTTOM)
cats = Reference(ws_dash, min_col=1, min_row=WEEK_TOP, max_row=WEEK_BOTTOM)
week_bar.add_data(data, titles_from_data=True)
week_bar.set_categories(cats)
week_bar.y_axis.numFmt = "0%"
week_bar.series[0].graphicalProperties.solidFill = ACCENT_TEAL
week_bar.legend = None
ws_dash.add_chart(week_bar, f"H{CHART_ROW}")

# 3) Donut chart — RAG status distribution
rag_donut = DoughnutChart()
rag_donut.title = "KPI Status Distribution"
rag_donut.height = 9
rag_donut.width = 10.5
rag_donut.holeSize = 55
data = Reference(ws_dash, min_col=2, min_row=RAG_TOP, max_row=RAG_BOTTOM)
cats = Reference(ws_dash, min_col=1, min_row=RAG_TOP, max_row=RAG_BOTTOM)
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

# print setup for KPI Dashboard
ws_dash.print_area = f"A1:U{CHART_BLOCK_BOTTOM}"
ws_dash.page_setup.orientation = "landscape"
ws_dash.page_setup.fitToWidth = 1
ws_dash.page_setup.fitToHeight = 0
ws_dash.sheet_properties.pageSetUpPr = PageSetupProperties(fitToPage=True)
ws_dash.page_margins = PageMargins(left=0.3, right=0.3, top=0.4, bottom=0.4, header=0.2, footer=0.2)

wb.save("/home/user/hira-repo/dist/KPI_Dashboard.xlsx")
print(f"3 charts added. Chart block bottom ~ row {CHART_BLOCK_BOTTOM}.")

# ----------------------------------------------------------------------------
# SHEET 5 : ACTION DASHBOARD
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
ws_adash["A3"] = '="  Action tracker status   |   "&TEXT(TODAY(),"dddd, dd-mmm-yyyy")&"   |   updates automatically from Action Tracker"'
ws_adash["A3"].font = SUBTITLE_FONT
ws_adash["A3"].fill = TITLE_FILL
ws_adash["A3"].alignment = Alignment(horizontal="left", vertical="center")
ws_adash.row_dimensions[3].height = 20

# ---- stat cards: Total / Open / In Progress / Closed / Overdue ----
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
# DEPARTMENT-WISE ACTION TABLE  (with RAG-style colour indicators)
# ----------------------------------------------------------------------------
ATBL_SEC_ROW = ACARD_BLOCK_BOTTOM + 2
section_banner(ws_adash, ATBL_SEC_ROW, 1, 10, "DEPARTMENT-WISE ACTIONS")

atbl_headers = ["Department", "Open", "In Progress", "Closed", "Overdue", "Status"]
ATBL_HDR_ROW = ATBL_SEC_ROW + 1
for j, h in enumerate(atbl_headers, start=1):
    ws_adash.cell(row=ATBL_HDR_ROW, column=j, value=h)
style_header_row(ws_adash, ATBL_HDR_ROW, 1, len(atbl_headers))

ATBL_TOP = ATBL_HDR_ROW + 1
for i, dept in enumerate(DEPARTMENTS):
    r = ATBL_TOP + i
    ws_adash.cell(row=r, column=1, value=dept)
    ws_adash.cell(row=r, column=2, value=f'=COUNTIFS({AT}[Department],$A{r},{AT}[Status],"Open")')
    ws_adash.cell(row=r, column=3, value=f'=COUNTIFS({AT}[Department],$A{r},{AT}[Status],"In Progress")')
    ws_adash.cell(row=r, column=4, value=f'=COUNTIFS({AT}[Department],$A{r},{AT}[Status],"Closed")')
    ws_adash.cell(row=r, column=5, value=f'=COUNTIFS({AT}[Department],$A{r},{AT}[Overdue?],"Yes")')
    ws_adash.cell(row=r, column=6, value=f'=IF($E{r}>0,"Red",IF($B{r}>0,"Amber","Green"))')
    for j in range(1, 7):
        cell = ws_adash.cell(row=r, column=j)
        cell.font = BODY_FONT
        cell.border = BORDER_ALL
        cell.alignment = CENTER
    if i % 2 == 1:
        for j in range(1, 7):
            ws_adash.cell(row=r, column=j).fill = ALT_ROW_FILL

ATBL_BOTTOM = ATBL_TOP + len(DEPARTMENTS) - 1

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

# helper for action status donut (Open / In Progress / Closed counts)
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

# 1) Department-wise open actions — bar chart
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

# 2) Overdue actions by department — bar chart
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

# 3) Action status distribution — donut chart
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
# FINAL WORKBOOK POLISH
# ----------------------------------------------------------------------------
for ws in (ws_entry, ws_master, ws_action, ws_review, ws_tmaster):
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
wb.properties.description = ("Interactive KPI + Action Tracker dashboard. Enter KPI data in 'KPI Data Entry' "
                              "and actions in 'Action Tracker' — both dashboards refresh automatically.")

OUT_PATH = "/home/user/hira-repo/dist/KPI_Dashboard.xlsx"
wb.save(OUT_PATH)
print("Final polish complete. Workbook saved.")

# ----------------------------------------------------------------------------
# SELF-CHECK — catches the exact defect class that broke a previous version
# (a data-validation <formula1> with an illegal leading "=") plus other
# basic structural sanity checks, before declaring the build good.
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

    print(f"Self-check: {total_formulas} formula cells scanned across {len(wb_check.sheetnames)} sheets.")
    if problems:
        print("SELF-CHECK FAILED:")
        for p in problems:
            print(" -", p)
        raise SystemExit(1)
    print("Self-check passed: no repair-triggering defects found.")


self_check(OUT_PATH)
