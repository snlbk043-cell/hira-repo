"""
Generator for the Advanced Daily Management System (DMS) Dashboard workbook.
Run: python3 tools/build_dashboard.py
Produces: dist/DMS_Dashboard.xlsx

No VBA is used anywhere in this workbook. All automation is formulas,
Excel Tables (structured references), Conditional Formatting and native
charts, so it is safe to open on any machine with macros disabled.
"""
import random
import datetime as dt

from openpyxl import Workbook
from openpyxl.worksheet.table import Table, TableStyleInfo
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, NamedStyle
from openpyxl.formatting.rule import CellIsRule, FormulaRule, ColorScaleRule, IconSetRule, IconSet, FormatObject
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.chart import BarChart, LineChart, PieChart, DoughnutChart, RadarChart, Reference, Series
from openpyxl.chart.label import DataLabelList
from openpyxl.chart.axis import ChartLines
from openpyxl.drawing.line import LineProperties
from openpyxl.chart.marker import Marker
from openpyxl.worksheet.page import PageMargins
from openpyxl.worksheet.properties import PageSetupProperties
from openpyxl.utils.cell import quote_sheetname

random.seed(42)

# ----------------------------------------------------------------------------
# THEME / STYLE CONSTANTS
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

TITLE_FONT = Font(name=FONT_NAME, size=22, bold=True, color=WHITE)
SUBTITLE_FONT = Font(name=FONT_NAME, size=11, color="C7D1E0")
SECTION_FONT = Font(name=FONT_NAME, size=13, bold=True, color=WHITE)
CARD_LABEL_FONT = Font(name=FONT_NAME, size=9.5, bold=True, color="C7D1E0")
CARD_VALUE_FONT = Font(name=FONT_NAME, size=20, bold=True, color=WHITE)
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


def style_header_row(ws, row, first_col, last_col, height=32):
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


# ----------------------------------------------------------------------------
# WORKBOOK
# ----------------------------------------------------------------------------
wb = Workbook()
wb.remove(wb.active)

ws_dash = wb.create_sheet("Dashboard")
ws_master = wb.create_sheet("Master KPI")
ws_kpim = wb.create_sheet("KPI Master")
ws_action = wb.create_sheet("Action Tracker")
ws_chal = wb.create_sheet("Challenges Register")
ws_trend = wb.create_sheet("Trend Analysis")
ws_month = wb.create_sheet("Monthly Summary")

for ws in (ws_dash, ws_master, ws_kpim, ws_action, ws_chal, ws_trend, ws_month):
    ws.sheet_view.showGridLines = False

# ----------------------------------------------------------------------------
# DATA MODEL
# ----------------------------------------------------------------------------
DEPARTMENTS = ["Safety", "Production", "Quality", "Maintenance", "Utilities",
               "Warehouse", "HR", "Engineering", "Cost", "Energy"]

# Department, KPI, Target Frequency, Unit, Owner, Min Target, Max Target,
# Tolerance, Display Order, Direction, Category
KPI_DEFS = [
    ("Safety", "Safety Incidents (LTI)", "Daily", "Count", "Safety Officer", 0, 0, 0, 1, "Lower is Better", "Lagging"),
    ("Safety", "Near Miss Reports", "Daily", "Count", "Safety Officer", 0, 2, 0.5, 2, "Higher is Better", "Leading"),
    ("Production", "Production Output", "Daily", "Units", "Production Manager", 900, 1000, 0.05, 1, "Higher is Better", "Lagging"),
    ("Production", "OEE %", "Daily", "%", "Production Manager", 0.75, 0.85, 0.05, 2, "Higher is Better", "Lagging"),
    ("Quality", "Defect Rate %", "Daily", "%", "Quality Manager", 0, 0.02, 0.25, 1, "Lower is Better", "Lagging"),
    ("Quality", "Customer Complaints", "Daily", "Count", "Quality Manager", 0, 0, 1, 2, "Lower is Better", "Lagging"),
    ("Maintenance", "Unplanned Downtime", "Daily", "Hours", "Maintenance Manager", 0, 1, 0.5, 1, "Lower is Better", "Lagging"),
    ("Maintenance", "PM Compliance %", "Daily", "%", "Maintenance Manager", 0.9, 1.0, 0.05, 2, "Higher is Better", "Leading"),
    ("Utilities", "Power Consumption", "Daily", "kWh", "Utilities Engineer", 4000, 4500, 0.05, 1, "Lower is Better", "Lagging"),
    ("Utilities", "Water Consumption", "Daily", "KL", "Utilities Engineer", 50, 60, 0.1, 2, "Lower is Better", "Lagging"),
    ("Warehouse", "On-Time Dispatch %", "Daily", "%", "Warehouse Manager", 0.92, 0.98, 0.05, 1, "Higher is Better", "Lagging"),
    ("Warehouse", "Inventory Accuracy %", "Daily", "%", "Warehouse Manager", 0.95, 0.98, 0.02, 2, "Higher is Better", "Lagging"),
    ("HR", "Absenteeism %", "Daily", "%", "HR Manager", 0, 0.03, 0.3, 1, "Lower is Better", "Lagging"),
    ("HR", "Training Hours", "Daily", "Hours", "HR Manager", 1, 2, 0.5, 2, "Higher is Better", "Leading"),
    ("Engineering", "Project Milestone Adherence %", "Daily", "%", "Engineering Manager", 0.85, 0.95, 0.1, 1, "Higher is Better", "Lagging"),
    ("Engineering", "Breakdown Resolution Time", "Daily", "Hours", "Engineering Manager", 0, 2, 0.25, 2, "Lower is Better", "Lagging"),
    ("Cost", "Cost per Unit", "Daily", "INR", "Cost Controller", 40, 45, 0.05, 1, "Lower is Better", "Lagging"),
    ("Cost", "Budget Variance %", "Daily", "%", "Cost Controller", 0, 0.05, 0.5, 2, "Lower is Better", "Lagging"),
    ("Energy", "Energy Intensity (kWh/unit)", "Daily", "kWh/unit", "Energy Manager", 4, 4.5, 0.05, 1, "Lower is Better", "Lagging"),
    ("Energy", "Renewable Energy Share %", "Daily", "%", "Energy Manager", 0.15, 0.25, 0.2, 2, "Higher is Better", "Leading"),
]

HEADLINE_KPI = {d: [k for k in KPI_DEFS if k[0] == d and k[8] == 1][0][1] for d in DEPARTMENTS}

# ----------------------------------------------------------------------------
# SHEET 3 : KPI MASTER  (definitions - the "config" sheet)
# ----------------------------------------------------------------------------
kpim_headers = ["Department", "KPI", "Target Frequency", "Unit", "Owner",
                "Minimum Target", "Maximum Target", "Tolerance", "Display Order",
                "Direction", "Category"]

ws_kpim["A1"] = "KPI MASTER — KPI Definitions & Thresholds (edit here to add/retire KPIs)"
ws_kpim["A1"].font = Font(name=FONT_NAME, size=13, bold=True, color=WHITE)
ws_kpim.merge_cells("A1:K1")
ws_kpim["A1"].fill = TITLE_FILL
ws_kpim["A1"].alignment = LEFT
ws_kpim.row_dimensions[1].height = 26

for j, h in enumerate(kpim_headers, start=1):
    ws_kpim.cell(row=2, column=j, value=h)
style_header_row(ws_kpim, 2, 1, len(kpim_headers))

for i, rec in enumerate(KPI_DEFS, start=3):
    for j, val in enumerate(rec, start=1):
        cell = ws_kpim.cell(row=i, column=j, value=val)
        cell.font = BODY_FONT
        cell.border = BORDER_ALL
        cell.alignment = CENTER if j not in (2,) else LEFT
        if j in (6, 7) and "%" in rec[3]:
            cell.number_format = "0%"
        if j == 8:
            # Tolerance is a fraction of Target, except for zero-target KPIs
            # (e.g. safety incidents, complaints) where it is an absolute
            # allowed count and should display as a plain number.
            cell.number_format = "0%" if rec[6] != 0 else "0"
    if (i % 2) == 0:
        for j in range(1, len(kpim_headers) + 1):
            ws_kpim.cell(row=i, column=j).fill = ALT_ROW_FILL

last_kpim_row = 2 + len(KPI_DEFS)
kpim_tab = Table(displayName="Tbl_KPIMaster", ref=f"A2:K{last_kpim_row}")
kpim_tab.tableStyleInfo = TableStyleInfo(name="TableStyleMedium2", showRowStripes=True,
                                          showFirstColumn=False, showLastColumn=False)
ws_kpim.add_table(kpim_tab)

autosize(ws_kpim, {"A": 14, "B": 30, "C": 14, "D": 12, "E": 20, "F": 14, "G": 14,
                    "H": 11, "I": 12, "J": 18, "K": 12})
ws_kpim.freeze_panes = "A3"

# Named ranges per department for dependent drop-downs in Master KPI (KPI Name list)
# KPI_DEFS is naturally grouped by department in definition order, so each
# department occupies a contiguous block of rows in the table.
row_cursor = 3
for dept in DEPARTMENTS:
    dept_rows = [i for i, rec in enumerate(KPI_DEFS, start=3) if rec[0] == dept]
    first, last = min(dept_rows), max(dept_rows)
    ref = f"'KPI Master'!$B${first}:$B${last}"
    wb.defined_names[f"KPI_{dept}"] = DefinedName(f"KPI_{dept}", attr_text=ref)

wb.defined_names["DeptList"] = DefinedName(
    "DeptList", attr_text=f"'KPI Master'!$A$3:$A${last_kpim_row}"
)
# unique department list lives in column A already (one row per KPI, dept repeats) -
# build a clean unique list in a side column N for the dropdown source instead.
for i, d in enumerate(DEPARTMENTS, start=3):
    ws_kpim.cell(row=i, column=14, value=d)
ws_kpim.cell(row=2, column=14, value="Department List").font = BOLD_BODY_FONT
wb.defined_names["DeptList"] = DefinedName(
    "DeptList", attr_text=f"'KPI Master'!$N$3:$N${2+len(DEPARTMENTS)}"
)
ws_kpim.column_dimensions["N"].width = 16

print("KPI Master sheet built.")

# ----------------------------------------------------------------------------
# SHEET 2 : MASTER KPI  (the ONLY sheet users type data into)
# ----------------------------------------------------------------------------
master_headers = ["Date", "Month", "Week", "Day", "Department", "KPI Category",
                   "KPI Name", "Unit", "Target", "Actual", "Tolerance",
                   "Responsible HOD", "Remarks", "Support Required", "Priority",
                   "Status", "Achievement %", "Variance", "Traffic Light", "Notes"]

ws_master["A1"] = "MASTER KPI SHEET — Daily Data Entry  (type only Date / Department / KPI Name / Actual / Remarks / Support / Priority / Status / Notes — everything else auto-fills)"
ws_master.merge_cells("A1:T1")
ws_master["A1"].font = Font(name=FONT_NAME, size=12, bold=True, color=WHITE)
ws_master["A1"].fill = TITLE_FILL
ws_master["A1"].alignment = LEFT
ws_master.row_dimensions[1].height = 30

for j, h in enumerate(master_headers, start=1):
    ws_master.cell(row=2, column=j, value=h)
style_header_row(ws_master, 2, 1, len(master_headers))

MANUAL_COLS = {1, 5, 7, 10, 13, 14, 15, 16, 20}  # Date, Dept, KPI Name, Actual, Remarks, Support, Priority, Status, Notes

# ---- generate sample data: ~90 days x 20 KPIs ----
TODAY = dt.date(2026, 7, 16)
N_DAYS = 90
start_date = TODAY - dt.timedelta(days=N_DAYS - 1)

remarks_bank = ["Within normal range", "Line changeover impact", "Vendor delay", "Manpower shortage",
                "Preventive check done", "Awaiting spares", "Process improvement in progress",
                "New operator training effect", "Weather impact", "Equipment breakdown", ""]
support_bank = ["", "", "", "Engineering support needed", "Procurement follow-up", "Management approval pending"]
priority_bank = ["Low", "Medium", "High"]
status_bank = ["Closed", "Open", "In Progress"]

data_rows = []
for day_idx in range(N_DAYS):
    the_date = start_date + dt.timedelta(days=day_idx)
    for dept, kpi, freq, unit, owner, mn, mx, tol, order, direction, category in KPI_DEFS:
        # simulate an actual value with noise around target, with an occasional bad day
        base = mx if direction == "Higher is Better" else mn
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
        data_rows.append((the_date, dept, kpi, actual))

first_data_row = 3
last_data_row = first_data_row + len(data_rows) - 1

for i, (the_date, dept, kpi, actual) in enumerate(data_rows):
    r = first_data_row + i
    ws_master.cell(row=r, column=1, value=the_date).number_format = "dd-mmm-yyyy"
    ws_master.cell(row=r, column=2, value=f"=IF($A{r}=\"\",\"\",TEXT($A{r},\"mmm-yyyy\"))")
    ws_master.cell(row=r, column=3, value=f"=IF($A{r}=\"\",\"\",\"W\"&WEEKNUM($A{r},2))")
    ws_master.cell(row=r, column=4, value=f"=IF($A{r}=\"\",\"\",TEXT($A{r},\"ddd\"))")
    ws_master.cell(row=r, column=5, value=dept)
    ws_master.cell(row=r, column=6, value=f"=IFERROR(INDEX(Tbl_KPIMaster[Category],MATCH($G{r},Tbl_KPIMaster[KPI],0)),\"\")")
    ws_master.cell(row=r, column=7, value=kpi)
    ws_master.cell(row=r, column=8, value=f"=IFERROR(INDEX(Tbl_KPIMaster[Unit],MATCH($G{r},Tbl_KPIMaster[KPI],0)),\"\")")
    ws_master.cell(row=r, column=9, value=f"=IFERROR(INDEX(Tbl_KPIMaster[Maximum Target],MATCH($G{r},Tbl_KPIMaster[KPI],0)),\"\")")
    ws_master.cell(row=r, column=10, value=actual)
    ws_master.cell(row=r, column=11, value=f"=IFERROR(INDEX(Tbl_KPIMaster[Tolerance],MATCH($G{r},Tbl_KPIMaster[KPI],0)),\"\")")
    ws_master.cell(row=r, column=12, value=f"=IFERROR(INDEX(Tbl_KPIMaster[Owner],MATCH($G{r},Tbl_KPIMaster[KPI],0)),\"\")")
    ws_master.cell(row=r, column=13, value=random.choice(remarks_bank))
    ws_master.cell(row=r, column=14, value=random.choice(support_bank))
    ws_master.cell(row=r, column=15, value=random.choices(priority_bank, weights=[5, 3, 2])[0])
    ws_master.cell(row=r, column=16, value=random.choices(status_bank, weights=[6, 2, 2])[0])
    ws_master.cell(row=r, column=17,
        value=(f"=IFERROR(IF(INDEX(Tbl_KPIMaster[Direction],MATCH($G{r},Tbl_KPIMaster[KPI],0))=\"Lower is Better\","
               f"IF($J{r}=0,1,IF($I{r}=0,0,$I{r}/$J{r})),"
               f"IF($I{r}=0,1,$J{r}/$I{r})),0)"))
    ws_master.cell(row=r, column=18, value=f"=IF(OR($I{r}=\"\",$J{r}=\"\"),\"\",$J{r}-$I{r})")
    ws_master.cell(row=r, column=19,
        value=(f"=IFERROR(IF(INDEX(Tbl_KPIMaster[Direction],MATCH($G{r},Tbl_KPIMaster[KPI],0))=\"Lower is Better\","
               f"IF($J{r}<=$I{r},\"Green\",IF($J{r}<=$I{r}+IF($I{r}=0,$K{r},$I{r}*$K{r}),\"Amber\",\"Red\")),"
               f"IF($J{r}>=$I{r},\"Green\",IF($J{r}>=$I{r}-IF($I{r}=0,$K{r},$I{r}*$K{r}),\"Amber\",\"Red\"))),\"\")"))
    ws_master.cell(row=r, column=20, value="")

    for j in range(1, 21):
        cell = ws_master.cell(row=r, column=j)
        cell.font = BODY_FONT
        cell.border = BORDER_ALL
        cell.alignment = CENTER if j not in (13, 20) else LEFT
        if j == 17:
            cell.number_format = "0.0%"
        if j in (9, 10) and unit == "%":
            cell.number_format = "0.0%"

print(f"Master KPI: {len(data_rows)} sample rows generated ({first_data_row}-{last_data_row}).")

# ---- add 40 blank buffer rows pre-filled with formulas so a Table auto-grows cleanly ----
BUFFER_ROWS = 40
for i in range(BUFFER_ROWS):
    r = last_data_row + 1 + i
    ws_master.cell(row=r, column=2, value=f"=IF($A{r}=\"\",\"\",TEXT($A{r},\"mmm-yyyy\"))")
    ws_master.cell(row=r, column=3, value=f"=IF($A{r}=\"\",\"\",\"W\"&WEEKNUM($A{r},2))")
    ws_master.cell(row=r, column=4, value=f"=IF($A{r}=\"\",\"\",TEXT($A{r},\"ddd\"))")
    ws_master.cell(row=r, column=6, value=f"=IFERROR(INDEX(Tbl_KPIMaster[Category],MATCH($G{r},Tbl_KPIMaster[KPI],0)),\"\")")
    ws_master.cell(row=r, column=8, value=f"=IFERROR(INDEX(Tbl_KPIMaster[Unit],MATCH($G{r},Tbl_KPIMaster[KPI],0)),\"\")")
    ws_master.cell(row=r, column=9, value=f"=IFERROR(INDEX(Tbl_KPIMaster[Maximum Target],MATCH($G{r},Tbl_KPIMaster[KPI],0)),\"\")")
    ws_master.cell(row=r, column=11, value=f"=IFERROR(INDEX(Tbl_KPIMaster[Tolerance],MATCH($G{r},Tbl_KPIMaster[KPI],0)),\"\")")
    ws_master.cell(row=r, column=12, value=f"=IFERROR(INDEX(Tbl_KPIMaster[Owner],MATCH($G{r},Tbl_KPIMaster[KPI],0)),\"\")")
    ws_master.cell(row=r, column=17,
        value=(f"=IFERROR(IF(INDEX(Tbl_KPIMaster[Direction],MATCH($G{r},Tbl_KPIMaster[KPI],0))=\"Lower is Better\","
               f"IF($J{r}=0,1,IF($I{r}=0,0,$I{r}/$J{r})),"
               f"IF($I{r}=0,1,$J{r}/$I{r})),0)"))
    ws_master.cell(row=r, column=18, value=f"=IF(OR($I{r}=\"\",$J{r}=\"\"),\"\",$J{r}-$I{r})")
    ws_master.cell(row=r, column=19,
        value=(f"=IFERROR(IF(INDEX(Tbl_KPIMaster[Direction],MATCH($G{r},Tbl_KPIMaster[KPI],0))=\"Lower is Better\","
               f"IF($J{r}<=$I{r},\"Green\",IF($J{r}<=$I{r}+IF($I{r}=0,$K{r},$I{r}*$K{r}),\"Amber\",\"Red\")),"
               f"IF($J{r}>=$I{r},\"Green\",IF($J{r}>=$I{r}-IF($I{r}=0,$K{r},$I{r}*$K{r}),\"Amber\",\"Red\"))),\"\")"))
    for j in range(1, 21):
        cell = ws_master.cell(row=r, column=j)
        cell.font = BODY_FONT
        cell.border = BORDER_ALL
        cell.alignment = CENTER if j not in (13, 20) else LEFT
        if j == 17:
            cell.number_format = "0.0%"

total_last_row = last_data_row + BUFFER_ROWS

# alternate row shading for readability
for r in range(first_data_row, total_last_row + 1):
    if (r - first_data_row) % 2 == 1:
        for j in range(1, 21):
            c = ws_master.cell(row=r, column=j)
            if c.fill.fgColor.rgb in (None, "00000000"):
                c.fill = ALT_ROW_FILL

master_tab = Table(displayName="Tbl_MasterKPI", ref=f"A2:T{total_last_row}")
master_tab.tableStyleInfo = TableStyleInfo(name="TableStyleMedium2", showRowStripes=True,
                                            showFirstColumn=False, showLastColumn=False)
ws_master.add_table(master_tab)

autosize(ws_master, {"A": 12, "B": 11, "C": 6, "D": 6, "E": 13, "F": 11, "G": 26,
                      "H": 9, "I": 9, "J": 9, "K": 10, "L": 18, "M": 22, "N": 16,
                      "O": 9, "P": 11, "Q": 11, "R": 9, "S": 11, "T": 20})
ws_master.freeze_panes = "A3"

# ---- Data validation dropdowns ----
dv_dept = DataValidation(type="list", formula1="DeptList", allow_blank=False, showDropDown=False)
dv_dept.error = "Please choose a department from the list."
dv_dept.errorTitle = "Invalid Department"
ws_master.add_data_validation(dv_dept)
dv_dept.add(f"E3:E{total_last_row}")

dv_kpi = DataValidation(type="list", formula1='INDIRECT("KPI_"&$E3)', allow_blank=True, showDropDown=False)
dv_kpi.error = "Choose a KPI Name valid for the selected Department."
dv_kpi.errorTitle = "Invalid KPI"
ws_master.add_data_validation(dv_kpi)
dv_kpi.add(f"G3:G{total_last_row}")

dv_priority = DataValidation(type="list", formula1='"Low,Medium,High"', allow_blank=True, showDropDown=False)
ws_master.add_data_validation(dv_priority)
dv_priority.add(f"O3:O{total_last_row}")

dv_status = DataValidation(type="list", formula1='"Open,In Progress,Closed"', allow_blank=True, showDropDown=False)
ws_master.add_data_validation(dv_status)
dv_status.add(f"P3:P{total_last_row}")

dv_support = DataValidation(type="list", formula1='"Yes,No"', allow_blank=True, showDropDown=False)
ws_master.add_data_validation(dv_support)
dv_support.add(f"N3:N{total_last_row}")

# ---- Conditional formatting: Traffic Light column (S) text + icon set ----
rng = f"S3:S{total_last_row}"
ws_master.conditional_formatting.add(
    rng, FormulaRule(formula=['$S3="Green"'], fill=PatternFill("solid", fgColor=GREEN_FILL), font=Font(color=GREEN, bold=True)))
ws_master.conditional_formatting.add(
    rng, FormulaRule(formula=['$S3="Amber"'], fill=PatternFill("solid", fgColor=AMBER_FILL), font=Font(color=AMBER, bold=True)))
ws_master.conditional_formatting.add(
    rng, FormulaRule(formula=['$S3="Red"'], fill=PatternFill("solid", fgColor=RED_FILL), font=Font(color=RED, bold=True)))

# Achievement % column data bar / color scale
ach_rng = f"Q3:Q{total_last_row}"
ws_master.conditional_formatting.add(ach_rng, ColorScaleRule(
    start_type="min", start_color="F8696B",
    mid_type="percentile", mid_value=50, mid_color="FFEB84",
    end_type="max", end_color="63BE7B"))

# Priority highlight
ws_master.conditional_formatting.add(
    f"O3:O{total_last_row}",
    FormulaRule(formula=['$O3="High"'], fill=PatternFill("solid", fgColor=RED_FILL), font=Font(color=RED, bold=True)))

wb.save("/home/user/hira-repo/dist/DMS_Dashboard.xlsx")
print("Master KPI sheet complete with table, validations, conditional formatting.")

# ----------------------------------------------------------------------------
# SHEET 4 : ACTION TRACKER
# ----------------------------------------------------------------------------
action_headers = ["Action ID", "Meeting Date", "Department", "Issue", "Root Cause", "Action",
                   "Owner", "Supporting Department", "Due Date", "Status", "Priority",
                   "Completion %", "Closed Date", "Remarks", "Overdue?", "Days Overdue"]

ws_action["A1"] = "ACTION TRACKER — Actions raised during the daily DMS meeting"
ws_action.merge_cells("A1:P1")
ws_action["A1"].font = Font(name=FONT_NAME, size=12, bold=True, color=WHITE)
ws_action["A1"].fill = TITLE_FILL
ws_action["A1"].alignment = LEFT
ws_action.row_dimensions[1].height = 28

for j, h in enumerate(action_headers, start=1):
    ws_action.cell(row=2, column=j, value=h)
style_header_row(ws_action, 2, 1, len(action_headers))

issues_bank = [
    ("Safety", "Housekeeping non-compliance in shop floor A", "Lack of 5S audit follow-up", "Conduct daily 5S audit and close gaps"),
    ("Production", "Line 2 output below target for 3 consecutive days", "Frequent minor stoppages", "RCA on stoppages + operator retraining"),
    ("Quality", "Rise in customer complaints for batch QC-118", "Incoming material variation", "Tighten incoming inspection sampling plan"),
    ("Maintenance", "Repeat breakdown on Compressor-3", "Bearing wear, PM missed", "Replace bearing, revise PM checklist"),
    ("Utilities", "Power consumption spike in Shift C", "HVAC running during non-peak hours", "Install auto shutoff schedule"),
    ("Warehouse", "Dispatch delay for Customer XYZ", "Inaccurate stock records", "Cycle count + WMS reconciliation"),
    ("HR", "High absenteeism in Shift B", "Transport issue reported by workers", "Coordinate with admin for additional shuttle"),
    ("Engineering", "Project milestone slipped for Line 4 upgrade", "Vendor delivery delay", "Escalate to vendor, expedite logistics"),
    ("Cost", "Cost per unit trending above target", "Higher scrap and rework", "Scrap reduction task force"),
    ("Energy", "Energy intensity above target for 2 weeks", "Compressed air leaks", "Leak audit and repair"),
]

owners = {"Safety": "Safety Officer", "Production": "Production Manager", "Quality": "Quality Manager",
          "Maintenance": "Maintenance Manager", "Utilities": "Utilities Engineer", "Warehouse": "Warehouse Manager",
          "HR": "HR Manager", "Engineering": "Engineering Manager", "Cost": "Cost Controller", "Energy": "Energy Manager"}

N_ACTIONS = 45
action_first = 3
action_status_bank = ["Open", "In Progress", "Closed"]
action_priority_bank = ["Low", "Medium", "High"]

action_data = []
for i in range(N_ACTIONS):
    dept, issue, rc, act = random.choice(issues_bank)
    meeting_date = TODAY - dt.timedelta(days=random.randint(0, 45))
    due_date = meeting_date + dt.timedelta(days=random.randint(2, 14))
    status = random.choices(action_status_bank, weights=[3, 3, 4])[0]
    completion = 100 if status == "Closed" else (random.choice([0, 10, 25, 40, 50, 60, 75]) if status == "In Progress" else 0)
    closed_date = due_date - dt.timedelta(days=random.randint(-3, 3)) if status == "Closed" else None
    if closed_date and closed_date > TODAY:
        closed_date = TODAY
    priority = random.choices(action_priority_bank, weights=[3, 4, 3])[0]
    support_dept = random.choice([d for d in DEPARTMENTS if d != dept] + [""])
    action_data.append((f"ACT-{1000+i}", meeting_date, dept, issue, rc, act, owners[dept],
                         support_dept, due_date, status, priority, completion, closed_date,
                         random.choice(remarks_bank)))

action_last = action_first + len(action_data) - 1
for i, rec in enumerate(action_data):
    r = action_first + i
    (aid, mdate, dept, issue, rc, act, owner, supp, due, status, prio, comp, cdate, rem) = rec
    ws_action.cell(row=r, column=1, value=aid)
    ws_action.cell(row=r, column=2, value=mdate).number_format = "dd-mmm-yyyy"
    ws_action.cell(row=r, column=3, value=dept)
    ws_action.cell(row=r, column=4, value=issue)
    ws_action.cell(row=r, column=5, value=rc)
    ws_action.cell(row=r, column=6, value=act)
    ws_action.cell(row=r, column=7, value=owner)
    ws_action.cell(row=r, column=8, value=supp)
    ws_action.cell(row=r, column=9, value=due).number_format = "dd-mmm-yyyy"
    ws_action.cell(row=r, column=10, value=status)
    ws_action.cell(row=r, column=11, value=prio)
    ws_action.cell(row=r, column=12, value=comp / 100.0).number_format = "0%"
    if cdate:
        ws_action.cell(row=r, column=13, value=cdate).number_format = "dd-mmm-yyyy"
    ws_action.cell(row=r, column=14, value=rem)
    ws_action.cell(row=r, column=15, value=f'=IF($J{r}="Closed","No",IF($I{r}<TODAY(),"Yes","No"))')
    ws_action.cell(row=r, column=16, value=f'=IF($O{r}="Yes",TODAY()-$I{r},0)')
    for j in range(1, 17):
        cell = ws_action.cell(row=r, column=j)
        cell.font = BODY_FONT
        cell.border = BORDER_ALL
        cell.alignment = CENTER if j not in (4, 5, 6, 14) else LEFT
    if (i % 2) == 1:
        for j in range(1, 17):
            ws_action.cell(row=r, column=j).fill = ALT_ROW_FILL

# buffer rows for future actions
ACTION_BUFFER = 25
for k in range(ACTION_BUFFER):
    r = action_last + 1 + k
    ws_action.cell(row=r, column=15, value=f'=IF($J{r}="","",IF($J{r}="Closed","No",IF($I{r}<TODAY(),"Yes","No")))')
    ws_action.cell(row=r, column=16, value=f'=IF($O{r}="Yes",TODAY()-$I{r},0)')
    ws_action.cell(row=r, column=12).number_format = "0%"
    for j in range(1, 17):
        cell = ws_action.cell(row=r, column=j)
        cell.font = BODY_FONT
        cell.border = BORDER_ALL

action_total_last = action_last + ACTION_BUFFER
action_tab = Table(displayName="Tbl_ActionTracker", ref=f"A2:P{action_total_last}")
action_tab.tableStyleInfo = TableStyleInfo(name="TableStyleMedium2", showRowStripes=True)
ws_action.add_table(action_tab)

dv_astatus = DataValidation(type="list", formula1='"Open,In Progress,Closed"', allow_blank=True, showDropDown=False)
ws_action.add_data_validation(dv_astatus)
dv_astatus.add(f"J3:J{action_total_last}")
dv_apriority = DataValidation(type="list", formula1='"Low,Medium,High"', allow_blank=True, showDropDown=False)
ws_action.add_data_validation(dv_apriority)
dv_apriority.add(f"K3:K{action_total_last}")
dv_adept = DataValidation(type="list", formula1="DeptList", allow_blank=True, showDropDown=False)
ws_action.add_data_validation(dv_adept)
dv_adept.add(f"C3:C{action_total_last}")
dv_adept.add(f"H3:H{action_total_last}")

ws_action.conditional_formatting.add(
    f"J3:J{action_total_last}",
    FormulaRule(formula=['$J3="Closed"'], fill=PatternFill("solid", fgColor=GREEN_FILL), font=Font(color=GREEN, bold=True)))
ws_action.conditional_formatting.add(
    f"J3:J{action_total_last}",
    FormulaRule(formula=['$J3="Open"'], fill=PatternFill("solid", fgColor=RED_FILL), font=Font(color=RED, bold=True)))
ws_action.conditional_formatting.add(
    f"J3:J{action_total_last}",
    FormulaRule(formula=['$J3="In Progress"'], fill=PatternFill("solid", fgColor=AMBER_FILL), font=Font(color=AMBER, bold=True)))
ws_action.conditional_formatting.add(
    f"A3:P{action_total_last}",
    FormulaRule(formula=['$O3="Yes"'], fill=PatternFill("solid", fgColor="FFD9D9")))
ws_action.conditional_formatting.add(
    f"K3:K{action_total_last}",
    FormulaRule(formula=['$K3="High"'], font=Font(color=RED, bold=True)))

autosize(ws_action, {"A": 10, "B": 12, "C": 13, "D": 32, "E": 26, "F": 32, "G": 18,
                      "H": 16, "I": 12, "J": 12, "K": 9, "L": 11, "M": 12, "N": 22,
                      "O": 9, "P": 11})
ws_action.freeze_panes = "A3"

wb.save("/home/user/hira-repo/dist/DMS_Dashboard.xlsx")
print(f"Action Tracker sheet complete: {len(action_data)} sample actions ({action_first}-{action_last}), buffer to {action_total_last}.")

# ----------------------------------------------------------------------------
# SHEET 5 : CHALLENGES REGISTER
# ----------------------------------------------------------------------------
chal_headers = ["Department", "Challenge", "Impact", "Support Required",
                 "Decision Taken", "Factory Manager Comments", "Status"]

ws_chal["A1"] = "CHALLENGES REGISTER — Cross-functional issues raised to the Factory Manager"
ws_chal.merge_cells("A1:G1")
ws_chal["A1"].font = Font(name=FONT_NAME, size=12, bold=True, color=WHITE)
ws_chal["A1"].fill = TITLE_FILL
ws_chal["A1"].alignment = LEFT
ws_chal.row_dimensions[1].height = 28

for j, h in enumerate(chal_headers, start=1):
    ws_chal.cell(row=2, column=j, value=h)
style_header_row(ws_chal, 2, 1, len(chal_headers))

challenge_bank = [
    ("Safety", "PPE compliance dropping in night shift", "Medium", "Additional supervision on night shift",
     "Approved extra safety marshal for night shift", "Track compliance % weekly", "Open"),
    ("Production", "Aging equipment causing capacity loss", "High", "Capex approval for line upgrade",
     "Capex proposal submitted to corporate", "Follow up with corporate finance", "In Progress"),
    ("Quality", "Supplier quality inconsistency", "High", "Supplier audit and corrective action",
     "Supplier audit scheduled next month", "Escalate to sourcing head if unresolved", "Open"),
    ("Maintenance", "Spare parts lead time too long", "Medium", "Local vendor development",
     "Identified 2 alternate local vendors", "Validate quality before switching", "In Progress"),
    ("Utilities", "Transformer capacity constraint", "High", "Electrical infra upgrade",
     "Consultant engaged for load study", "Review study output next review", "Open"),
    ("Warehouse", "Space constraint for finished goods", "Medium", "Additional storage / faster dispatch",
     "Temporary racking added", "Evaluate 3PL warehouse option", "Closed"),
    ("HR", "Skilled manpower attrition", "High", "Retention plan", "HR to propose revised incentive plan",
     "Present retention plan next meeting", "Open"),
    ("Engineering", "Vendor delays on capital projects", "Medium", "Vendor performance review",
     "Penalty clause invoked", "Monitor next 2 milestones closely", "In Progress"),
    ("Cost", "Raw material price volatility", "High", "Hedging / alternate sourcing",
     "Procurement exploring long-term contracts", "Review cost impact monthly", "Open"),
    ("Energy", "Renewable energy share below plan", "Medium", "Solar capacity addition",
     "Feasibility study initiated", "Present findings in Q3 review", "In Progress"),
]

chal_first = 3
for i, rec in enumerate(challenge_bank):
    r = chal_first + i
    for j, val in enumerate(rec, start=1):
        cell = ws_chal.cell(row=r, column=j, value=val)
        cell.font = BODY_FONT
        cell.border = BORDER_ALL
        cell.alignment = CENTER if j in (1, 3, 7) else LEFT
    if (i % 2) == 1:
        for j in range(1, 8):
            ws_chal.cell(row=r, column=j).fill = ALT_ROW_FILL

chal_last = chal_first + len(challenge_bank) - 1
CHAL_BUFFER = 15
for k in range(CHAL_BUFFER):
    r = chal_last + 1 + k
    for j in range(1, 8):
        cell = ws_chal.cell(row=r, column=j)
        cell.font = BODY_FONT
        cell.border = BORDER_ALL

chal_total_last = chal_last + CHAL_BUFFER
chal_tab = Table(displayName="Tbl_Challenges", ref=f"A2:G{chal_total_last}")
chal_tab.tableStyleInfo = TableStyleInfo(name="TableStyleMedium2", showRowStripes=True)
ws_chal.add_table(chal_tab)

dv_cdept = DataValidation(type="list", formula1="DeptList", allow_blank=True, showDropDown=False)
ws_chal.add_data_validation(dv_cdept)
dv_cdept.add(f"A3:A{chal_total_last}")
dv_cimpact = DataValidation(type="list", formula1='"Low,Medium,High"', allow_blank=True, showDropDown=False)
ws_chal.add_data_validation(dv_cimpact)
dv_cimpact.add(f"C3:C{chal_total_last}")
dv_cstatus = DataValidation(type="list", formula1='"Open,In Progress,Closed"', allow_blank=True, showDropDown=False)
ws_chal.add_data_validation(dv_cstatus)
dv_cstatus.add(f"G3:G{chal_total_last}")

ws_chal.conditional_formatting.add(
    f"G3:G{chal_total_last}",
    FormulaRule(formula=['$G3="Closed"'], fill=PatternFill("solid", fgColor=GREEN_FILL), font=Font(color=GREEN, bold=True)))
ws_chal.conditional_formatting.add(
    f"G3:G{chal_total_last}",
    FormulaRule(formula=['$G3="Open"'], fill=PatternFill("solid", fgColor=RED_FILL), font=Font(color=RED, bold=True)))
ws_chal.conditional_formatting.add(
    f"G3:G{chal_total_last}",
    FormulaRule(formula=['$G3="In Progress"'], fill=PatternFill("solid", fgColor=AMBER_FILL), font=Font(color=AMBER, bold=True)))
ws_chal.conditional_formatting.add(
    f"C3:C{chal_total_last}",
    FormulaRule(formula=['$C3="High"'], font=Font(color=RED, bold=True)))

autosize(ws_chal, {"A": 14, "B": 34, "C": 10, "D": 26, "E": 30, "F": 30, "G": 12})
ws_chal.freeze_panes = "A3"

wb.save("/home/user/hira-repo/dist/DMS_Dashboard.xlsx")
print(f"Challenges Register complete: {len(challenge_bank)} rows, buffer to {chal_total_last}.")

# ----------------------------------------------------------------------------
# SHEET 6 : TREND ANALYSIS
# ----------------------------------------------------------------------------
ws_trend["A1"] = "TREND ANALYSIS — 7-Day / 30-Day / Monthly / YTD performance trend by department"
ws_trend.merge_cells("A1:L1")
ws_trend["A1"].font = Font(name=FONT_NAME, size=13, bold=True, color=WHITE)
ws_trend["A1"].fill = TITLE_FILL
ws_trend["A1"].alignment = LEFT
ws_trend.row_dimensions[1].height = 28

# ---- Summary table: rolling averages per department ----
ws_trend["A3"] = "ROLLING PERFORMANCE SUMMARY (Achievement %, higher = better in all rows)"
ws_trend["A3"].font = SECTION_FONT
ws_trend["A3"].fill = SECTION_FILL
ws_trend.merge_cells("A3:G3")
ws_trend.row_dimensions[3].height = 22

sum_headers = ["Department", "7-Day Avg", "Prior 7-Day Avg", "30-Day Avg", "Month-to-Date Avg", "YTD Avg", "Trend"]
for j, h in enumerate(sum_headers, start=1):
    ws_trend.cell(row=4, column=j, value=h)
style_header_row(ws_trend, 4, 1, len(sum_headers), height=26)

MK = "Tbl_MasterKPI"
for i, dept in enumerate(DEPARTMENTS):
    r = 5 + i
    ws_trend.cell(row=r, column=1, value=dept)
    ws_trend.cell(row=r, column=2,
        value=f'=IFERROR(AVERAGEIFS({MK}[Achievement %],{MK}[Department],$A{r},{MK}[Date],">="&(TODAY()-6),{MK}[Date],"<="&TODAY()),0)')
    ws_trend.cell(row=r, column=3,
        value=f'=IFERROR(AVERAGEIFS({MK}[Achievement %],{MK}[Department],$A{r},{MK}[Date],">="&(TODAY()-13),{MK}[Date],"<="&(TODAY()-7)),0)')
    ws_trend.cell(row=r, column=4,
        value=f'=IFERROR(AVERAGEIFS({MK}[Achievement %],{MK}[Department],$A{r},{MK}[Date],">="&(TODAY()-29),{MK}[Date],"<="&TODAY()),0)')
    ws_trend.cell(row=r, column=5,
        value=f'=IFERROR(AVERAGEIFS({MK}[Achievement %],{MK}[Department],$A{r},{MK}[Date],">="&DATE(YEAR(TODAY()),MONTH(TODAY()),1),{MK}[Date],"<="&TODAY()),0)')
    ws_trend.cell(row=r, column=6,
        value=f'=IFERROR(AVERAGEIFS({MK}[Achievement %],{MK}[Department],$A{r},{MK}[Date],">="&DATE(YEAR(TODAY()),1,1),{MK}[Date],"<="&TODAY()),0)')
    ws_trend.cell(row=r, column=7, value=f'=IF($B{r}>$C{r},"▲ Improving",IF($B{r}<$C{r},"▼ Declining","▬ Stable"))')
    for j in range(1, 8):
        cell = ws_trend.cell(row=r, column=j)
        cell.font = BODY_FONT
        cell.border = BORDER_ALL
        cell.alignment = CENTER
        if j in (2, 3, 4, 5, 6):
            cell.number_format = "0.0%"
    if i % 2 == 1:
        for j in range(1, 8):
            ws_trend.cell(row=r, column=j).fill = ALT_ROW_FILL

trend_sum_last = 5 + len(DEPARTMENTS) - 1
ws_trend.conditional_formatting.add(
    f"G5:G{trend_sum_last}",
    FormulaRule(formula=['ISNUMBER(SEARCH("Improving",G5))'], font=Font(color=GREEN, bold=True)))
ws_trend.conditional_formatting.add(
    f"G5:G{trend_sum_last}",
    FormulaRule(formula=['ISNUMBER(SEARCH("Declining",G5))'], font=Font(color=RED, bold=True)))

autosize(ws_trend, {"A": 15, "B": 12, "C": 15, "D": 12, "E": 16, "F": 12, "G": 14})

# ---- Daily trend helper table (date x department achievement%) used for charts ----
helper_row0 = trend_sum_last + 3
ws_trend.cell(row=helper_row0, column=1,
              value="DAILY ACHIEVEMENT % BY DEPARTMENT (chart source data — do not delete)").font = SECTION_FONT
ws_trend.cell(row=helper_row0, column=1).fill = SECTION_FILL
ws_trend.merge_cells(start_row=helper_row0, start_column=1, end_row=helper_row0, end_column=1 + len(DEPARTMENTS))
ws_trend.row_dimensions[helper_row0].height = 22

hdr_row = helper_row0 + 1
ws_trend.cell(row=hdr_row, column=1, value="Date")
for i, dept in enumerate(DEPARTMENTS):
    ws_trend.cell(row=hdr_row, column=2 + i, value=dept)
style_header_row(ws_trend, hdr_row, 1, 1 + len(DEPARTMENTS), height=20)

data_start = hdr_row + 1
for d in range(N_DAYS):
    r = data_start + d
    the_date = start_date + dt.timedelta(days=d)
    ws_trend.cell(row=r, column=1, value=the_date).number_format = "dd-mmm"
    ws_trend.cell(row=r, column=1).font = BODY_FONT
    for i, dept in enumerate(DEPARTMENTS):
        c = 2 + i
        cell = ws_trend.cell(row=r, column=c,
            value=f'=IFERROR(AVERAGEIFS({MK}[Achievement %],{MK}[Department],{get_column_letter(c)}${hdr_row},{MK}[Date],$A{r}),NA())')
        cell.number_format = "0%"
        cell.font = BODY_FONT
data_end = data_start + N_DAYS - 1
ws_trend.freeze_panes = f"B{data_start}"

print(f"Trend daily helper table rows {data_start}-{data_end}.")

# ---- 10 department trend charts, arranged 2 columns x 5 rows ----
chart_anchor_col_letters = ["N", "Y"]  # clear of the daily helper table (cols A:M), extra margin
chart_row_start = 3
chart_row_step = 16
for i, dept in enumerate(DEPARTMENTS):
    col_idx = i % 2
    row_idx = i // 2
    chart = LineChart()
    chart.title = f"{dept} — Achievement % Trend (90 Days)"
    chart.style = 2
    chart.height = 7.2
    chart.width = 15.0
    chart.y_axis.numFmt = "0%"
    chart.y_axis.title = "Achievement %"
    chart.x_axis.title = None
    chart.x_axis.number_format = "dd-mmm"
    chart.x_axis.majorTimeUnit = "days"
    data = Reference(ws_trend, min_col=2 + i, min_row=hdr_row, max_row=data_end)
    cats = Reference(ws_trend, min_col=1, min_row=data_start, max_row=data_end)
    chart.add_data(data, titles_from_data=True)
    chart.set_categories(cats)
    s = chart.series[0]
    s.smooth = False
    s.graphicalProperties.line.width = 20000
    s.graphicalProperties.line.solidFill = ACCENT_BLUE
    chart.legend = None
    anchor = f"{chart_anchor_col_letters[col_idx]}{chart_row_start + row_idx * chart_row_step}"
    ws_trend.add_chart(chart, anchor)

wb.save("/home/user/hira-repo/dist/DMS_Dashboard.xlsx")
print("Trend Analysis sheet complete with 10 department charts.")

# ----------------------------------------------------------------------------
# SHEET 7 : MONTHLY SUMMARY
# ----------------------------------------------------------------------------
ws_month["A1"] = "MONTHLY SUMMARY — Department performance for the selected month"
ws_month.merge_cells("A1:K1")
ws_month["A1"].font = Font(name=FONT_NAME, size=13, bold=True, color=WHITE)
ws_month["A1"].fill = TITLE_FILL
ws_month["A1"].alignment = LEFT
ws_month.row_dimensions[1].height = 28

ws_month["A3"] = "Select Month:"
ws_month["A3"].font = BOLD_BODY_FONT
ws_month["B3"] = f"=TEXT(TODAY(),\"mmm-yyyy\")"
ws_month["B3"].font = Font(name=FONT_NAME, size=11, bold=True, color=ACCENT_BLUE)
ws_month["B3"].fill = PatternFill("solid", fgColor=LIGHT_GREY)
ws_month["B3"].border = BORDER_ALL
ws_month["B3"].alignment = CENTER
dv_month = DataValidation(type="list", formula1=f"{MK}[Month]", allow_blank=False, showDropDown=False)
ws_month.add_data_validation(dv_month)
dv_month.add("B3")

month_headers = ["Department", "Target (headline KPI)", "Actual (avg)", "Achievement %",
                  "Red KPI-Days", "Amber KPI-Days", "Green KPI-Days", "Actions Closed", "Actions Pending"]
for j, h in enumerate(month_headers, start=1):
    ws_month.cell(row=5, column=j, value=h)
style_header_row(ws_month, 5, 1, len(month_headers), height=32)

for i, dept in enumerate(DEPARTMENTS):
    r = 6 + i
    hk = HEADLINE_KPI[dept]
    ws_month.cell(row=r, column=1, value=dept)
    ws_month.cell(row=r, column=2,
        value=f'=IFERROR(INDEX(Tbl_KPIMaster[Maximum Target],MATCH("{hk}",Tbl_KPIMaster[KPI],0)),0)')
    ws_month.cell(row=r, column=3,
        value=f'=IFERROR(AVERAGEIFS({MK}[Actual],{MK}[KPI Name],"{hk}",{MK}[Month],$B$3),0)')
    ws_month.cell(row=r, column=4,
        value=f'=IFERROR(AVERAGEIFS({MK}[Achievement %],{MK}[Department],$A{r},{MK}[Month],$B$3),0)')
    ws_month.cell(row=r, column=5,
        value=f'=COUNTIFS({MK}[Department],$A{r},{MK}[Month],$B$3,{MK}[Traffic Light],"Red")')
    ws_month.cell(row=r, column=6,
        value=f'=COUNTIFS({MK}[Department],$A{r},{MK}[Month],$B$3,{MK}[Traffic Light],"Amber")')
    ws_month.cell(row=r, column=7,
        value=f'=COUNTIFS({MK}[Department],$A{r},{MK}[Month],$B$3,{MK}[Traffic Light],"Green")')
    ws_month.cell(row=r, column=8,
        value=(f'=COUNTIFS(Tbl_ActionTracker[Department],$A{r},Tbl_ActionTracker[Status],"Closed",'
               f'Tbl_ActionTracker[Meeting Date],">="&DATEVALUE("1-"&$B$3),'
               f'Tbl_ActionTracker[Meeting Date],"<"&EDATE(DATEVALUE("1-"&$B$3),1))'))
    ws_month.cell(row=r, column=9,
        value=(f'=COUNTIFS(Tbl_ActionTracker[Department],$A{r},Tbl_ActionTracker[Status],"<>Closed",'
               f'Tbl_ActionTracker[Meeting Date],">="&DATEVALUE("1-"&$B$3),'
               f'Tbl_ActionTracker[Meeting Date],"<"&EDATE(DATEVALUE("1-"&$B$3),1))'))
    for j in range(1, 10):
        cell = ws_month.cell(row=r, column=j)
        cell.font = BODY_FONT
        cell.border = BORDER_ALL
        cell.alignment = CENTER
        if j == 4:
            cell.number_format = "0.0%"
        if j in (2, 3):
            cell.number_format = "0.00"
    if i % 2 == 1:
        for j in range(1, 10):
            ws_month.cell(row=r, column=j).fill = ALT_ROW_FILL

month_last = 6 + len(DEPARTMENTS) - 1
ws_month.conditional_formatting.add(
    f"D6:D{month_last}", CellIsRule(operator="greaterThanOrEqual", formula=["1"],
                                     fill=PatternFill("solid", fgColor=GREEN_FILL)))
ws_month.conditional_formatting.add(
    f"D6:D{month_last}", CellIsRule(operator="between", formula=["0.85", "1"],
                                     fill=PatternFill("solid", fgColor=AMBER_FILL)))
ws_month.conditional_formatting.add(
    f"D6:D{month_last}", CellIsRule(operator="lessThan", formula=["0.85"],
                                     fill=PatternFill("solid", fgColor=RED_FILL)))
ws_month.conditional_formatting.add(f"E6:E{month_last}", ColorScaleRule(
    start_type="min", start_color=GREEN_FILL, end_type="max", end_color=RED_FILL))

autosize(ws_month, {"A": 15, "B": 18, "C": 14, "D": 14, "E": 13, "F": 14, "G": 13, "H": 13, "I": 14})
ws_month.freeze_panes = "A6"

# ---- Monthly Summary charts ----
bar1 = BarChart()
bar1.type = "col"
bar1.title = "Achievement % by Department (Selected Month)"
bar1.style = 10
bar1.height = 9
bar1.width = 20
data = Reference(ws_month, min_col=4, min_row=5, max_row=month_last)
cats = Reference(ws_month, min_col=1, min_row=6, max_row=month_last)
bar1.add_data(data, titles_from_data=True)
bar1.set_categories(cats)
bar1.y_axis.numFmt = "0%"
bar1.legend = None
ws_month.add_chart(bar1, "K5")

bar2 = BarChart()
bar2.type = "col"
bar2.grouping = "stacked"
bar2.overlap = 100
bar2.title = "Red / Amber / Green KPI-Days by Department"
bar2.style = 10
bar2.height = 9
bar2.width = 20
data2 = Reference(ws_month, min_col=5, min_row=5, max_col=7, max_row=month_last)
bar2.add_data(data2, titles_from_data=True)
bar2.set_categories(cats)
colors = [RED, AMBER, GREEN]
for s, col in zip(bar2.series, colors):
    s.graphicalProperties.solidFill = col
ws_month.add_chart(bar2, "K23")

bar3 = BarChart()
bar3.type = "col"
bar3.title = "Actions Closed vs Pending by Department"
bar3.style = 10
bar3.height = 9
bar3.width = 20
data3 = Reference(ws_month, min_col=8, min_row=5, max_col=9, max_row=month_last)
bar3.add_data(data3, titles_from_data=True)
bar3.set_categories(cats)
bar3.series[0].graphicalProperties.solidFill = GREEN
bar3.series[1].graphicalProperties.solidFill = RED
ws_month.add_chart(bar3, "K41")

wb.save("/home/user/hira-repo/dist/DMS_Dashboard.xlsx")
print("Monthly Summary sheet complete.")

# ----------------------------------------------------------------------------
# SHEET 1 : DASHBOARD
# ----------------------------------------------------------------------------
ws_dash.sheet_view.zoomScale = 85

# ---- Header banner ----
ws_dash.merge_cells("A1:Z3")
ws_dash["A1"] = "  PLANT DAILY MANAGEMENT SYSTEM (DMS) DASHBOARD"
ws_dash["A1"].font = TITLE_FONT
ws_dash["A1"].fill = TITLE_FILL
ws_dash["A1"].alignment = Alignment(horizontal="left", vertical="center")
for r in range(1, 4):
    ws_dash.row_dimensions[r].height = 16 if r != 2 else 14
ws_dash.row_dimensions[1].height = 40

ws_dash.merge_cells("A4:Z4")
ws_dash["A4"] = ('  Morning DMS Review Meeting   |   Today: ' +
                  '=TEXT(TODAY(),"dddd, dd-mmm-yyyy")')
# build as formula concatenation instead of python date text so it's live
ws_dash["A4"] = '="  Morning DMS Review Meeting   |   Today: "&TEXT(TODAY(),"dddd, dd-mmm-yyyy")&"   |   Data refreshes automatically from Master KPI sheet"'
ws_dash["A4"].font = SUBTITLE_FONT
ws_dash["A4"].fill = TITLE_FILL
ws_dash["A4"].alignment = Alignment(horizontal="left", vertical="center")
ws_dash.row_dimensions[4].height = 20

# ---- Filter / control panel ----
FILTER_ROW = 6
ws_dash.merge_cells(f"A{FILTER_ROW}:Z{FILTER_ROW}")
ws_dash.cell(row=FILTER_ROW, column=1, value="FILTERS").font = SECTION_FONT
ws_dash.cell(row=FILTER_ROW, column=1).fill = SECTION_FILL
ws_dash.row_dimensions[FILTER_ROW].height = 20

FR = FILTER_ROW + 1
labels = ["Review Period:", "Department:", "Owner:", "Status:", "Priority:"]
positions = [1, 6, 11, 16, 21]
for lbl, col in zip(labels, positions):
    c = ws_dash.cell(row=FR, column=col, value=lbl)
    c.font = BOLD_BODY_FONT
    c.alignment = LEFT

ws_dash.cell(row=FR, column=2, value="Last 30 Days")
ws_dash.cell(row=FR, column=7, value="All")
ws_dash.cell(row=FR, column=12, value="All")
ws_dash.cell(row=FR, column=17, value="All")
ws_dash.cell(row=FR, column=22, value="All")
for col in (2, 7, 12, 17, 22):
    cell = ws_dash.cell(row=FR, column=col)
    cell.font = Font(name=FONT_NAME, size=10, bold=True, color=ACCENT_BLUE)
    cell.fill = PatternFill("solid", fgColor=WHITE)
    cell.border = BORDER_ALL
    cell.alignment = CENTER

PERIOD_CELL = f"$B${FR}"
DEPT_FILTER_CELL = f"$G${FR}"
OWNER_FILTER_CELL = f"$L${FR}"
STATUS_FILTER_CELL = f"$Q${FR}"
PRIORITY_FILTER_CELL = f"$V${FR}"

dv_period = DataValidation(type="list", allow_blank=False, showDropDown=False,
    formula1='"Today,Yesterday,This Week (7 Days),This Month,Last 30 Days,YTD,All Data"')
ws_dash.add_data_validation(dv_period)
dv_period.add(f"B{FR}")

dv_dash_dept = DataValidation(type="list", allow_blank=False, showDropDown=False,
    formula1='"All,Safety,Production,Quality,Maintenance,Utilities,Warehouse,HR,Engineering,Cost,Energy"')
ws_dash.add_data_validation(dv_dash_dept)
dv_dash_dept.add(f"G{FR}")

dv_dash_owner = DataValidation(type="list", allow_blank=False, showDropDown=False,
    formula1='"All,Safety Officer,Production Manager,Quality Manager,Maintenance Manager,Utilities Engineer,Warehouse Manager,HR Manager,Engineering Manager,Cost Controller,Energy Manager"')
ws_dash.add_data_validation(dv_dash_owner)
dv_dash_owner.add(f"L{FR}")

dv_dash_status = DataValidation(type="list", allow_blank=False, showDropDown=False, formula1='"All,Open,In Progress,Closed"')
ws_dash.add_data_validation(dv_dash_status)
dv_dash_status.add(f"Q{FR}")

dv_dash_priority = DataValidation(type="list", allow_blank=False, showDropDown=False, formula1='"All,Low,Medium,High"')
ws_dash.add_data_validation(dv_dash_priority)
dv_dash_priority.add(f"V{FR}")

# ---- Hidden-in-plain-sight period window computation ----
WIN_ROW = FR + 1
ws_dash.cell(row=WIN_ROW, column=1, value="Window:").font = Font(name=FONT_NAME, size=8.5, italic=True, color="8A93A6")
ws_dash.cell(row=WIN_ROW, column=2,
    value=(f'=IF({PERIOD_CELL}="Today",TODAY(),IF({PERIOD_CELL}="Yesterday",TODAY()-1,'
           f'IF({PERIOD_CELL}="This Week (7 Days)",TODAY()-6,IF({PERIOD_CELL}="This Month",'
           f'DATE(YEAR(TODAY()),MONTH(TODAY()),1),IF({PERIOD_CELL}="Last 30 Days",TODAY()-29,'
           f'IF({PERIOD_CELL}="YTD",DATE(YEAR(TODAY()),1,1),DATE(2000,1,1)))))))'))
ws_dash.cell(row=WIN_ROW, column=2).number_format = "dd-mmm-yyyy"
ws_dash.cell(row=WIN_ROW, column=2).font = Font(name=FONT_NAME, size=8.5, italic=True, color="8A93A6")
ws_dash.cell(row=WIN_ROW, column=3, value="to").font = Font(name=FONT_NAME, size=8.5, italic=True, color="8A93A6")
ws_dash.cell(row=WIN_ROW, column=4,
    value=f'=IF({PERIOD_CELL}="Yesterday",TODAY()-1,TODAY())')
ws_dash.cell(row=WIN_ROW, column=4).number_format = "dd-mmm-yyyy"
ws_dash.cell(row=WIN_ROW, column=4).font = Font(name=FONT_NAME, size=8.5, italic=True, color="8A93A6")
START_CELL = f"$B${WIN_ROW}"
END_CELL = f"$D${WIN_ROW}"

wb.save("/home/user/hira-repo/dist/DMS_Dashboard.xlsx")
print("Dashboard header + filter panel complete.")

# ----------------------------------------------------------------------------
# KPI SCORE CARDS  (2 rows x 5 cards) — Overall, Safety, Production, Quality,
# Maintenance, Utilities, Warehouse, HR, Engineering, Overall Achievement %
# ----------------------------------------------------------------------------
CARD_HEADER_ROW = WIN_ROW + 2
ws_dash.merge_cells(f"A{CARD_HEADER_ROW}:Z{CARD_HEADER_ROW}")
ws_dash.cell(row=CARD_HEADER_ROW, column=1, value="EXECUTIVE KPI SCORECARD").font = SECTION_FONT
ws_dash.cell(row=CARD_HEADER_ROW, column=1).fill = SECTION_FILL
ws_dash.row_dimensions[CARD_HEADER_ROW].height = 20

CARD_TOP = CARD_HEADER_ROW + 1
CARD_H = 4      # rows per card
CARD_W = 5      # columns per card
CARD_COLS = 5
GAP = 0

card_defs = [
    ("Overall Plant Score", f'=IFERROR(AVERAGEIFS({MK}[Achievement %],{MK}[Date],">="&{START_CELL},{MK}[Date],"<="&{END_CELL}),0)'),
    ("Safety", f'=IFERROR(AVERAGEIFS({MK}[Achievement %],{MK}[Department],"Safety",{MK}[Date],">="&{START_CELL},{MK}[Date],"<="&{END_CELL}),0)'),
    ("Production", f'=IFERROR(AVERAGEIFS({MK}[Achievement %],{MK}[Department],"Production",{MK}[Date],">="&{START_CELL},{MK}[Date],"<="&{END_CELL}),0)'),
    ("Quality", f'=IFERROR(AVERAGEIFS({MK}[Achievement %],{MK}[Department],"Quality",{MK}[Date],">="&{START_CELL},{MK}[Date],"<="&{END_CELL}),0)'),
    ("Maintenance", f'=IFERROR(AVERAGEIFS({MK}[Achievement %],{MK}[Department],"Maintenance",{MK}[Date],">="&{START_CELL},{MK}[Date],"<="&{END_CELL}),0)'),
    ("Utilities", f'=IFERROR(AVERAGEIFS({MK}[Achievement %],{MK}[Department],"Utilities",{MK}[Date],">="&{START_CELL},{MK}[Date],"<="&{END_CELL}),0)'),
    ("Warehouse", f'=IFERROR(AVERAGEIFS({MK}[Achievement %],{MK}[Department],"Warehouse",{MK}[Date],">="&{START_CELL},{MK}[Date],"<="&{END_CELL}),0)'),
    ("HR", f'=IFERROR(AVERAGEIFS({MK}[Achievement %],{MK}[Department],"HR",{MK}[Date],">="&{START_CELL},{MK}[Date],"<="&{END_CELL}),0)'),
    ("Engineering", f'=IFERROR(AVERAGEIFS({MK}[Achievement %],{MK}[Department],"Engineering",{MK}[Date],">="&{START_CELL},{MK}[Date],"<="&{END_CELL}),0)'),
    ("Overall Achievement %", (f'=IFERROR(COUNTIFS({MK}[Traffic Light],"Green",{MK}[Date],">="&{START_CELL},{MK}[Date],"<="&{END_CELL})'
                                f'/COUNTIFS({MK}[Date],">="&{START_CELL},{MK}[Date],"<="&{END_CELL}),0)')),
]

SCORE_CELLS = {}
for idx, (label, formula) in enumerate(card_defs):
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
    lbl_cell = ws_dash.cell(row=label_row, column=left, value=label.upper())
    lbl_cell.font = CARD_LABEL_FONT
    lbl_cell.alignment = CENTER
    lbl_cell.fill = CARD_FILL

    ws_dash.merge_cells(start_row=value_row, start_column=left, end_row=value_row, end_column=right)
    val_cell = ws_dash.cell(row=value_row, column=left, value=formula)
    val_cell.font = CARD_VALUE_FONT
    val_cell.alignment = CENTER
    val_cell.fill = CARD_FILL
    val_cell.number_format = "0.0%"
    SCORE_CELLS[label] = f"{get_column_letter(left)}{value_row}"

    for rr in range(top, bottom + 1):
        ws_dash.row_dimensions[rr].height = 14

CARD_BLOCK_BOTTOM = CARD_TOP + (1) * (CARD_H + 1) + CARD_H - 1  # 2 rows of cards

# Conditional formatting on card value cells: colour text by score band
for label, cellref in SCORE_CELLS.items():
    ws_dash.conditional_formatting.add(
        cellref, CellIsRule(operator="greaterThanOrEqual", formula=["1"], font=Font(color="7BD88F", bold=True, size=20, name=FONT_NAME)))
    ws_dash.conditional_formatting.add(
        cellref, CellIsRule(operator="between", formula=["0.85", "1"], font=Font(color="FFD966", bold=True, size=20, name=FONT_NAME)))
    ws_dash.conditional_formatting.add(
        cellref, CellIsRule(operator="lessThan", formula=["0.85"], font=Font(color="FF8A80", bold=True, size=20, name=FONT_NAME)))

wb.save("/home/user/hira-repo/dist/DMS_Dashboard.xlsx")
print(f"KPI scorecards complete. Card block bottom row = {CARD_BLOCK_BOTTOM}")

# ----------------------------------------------------------------------------
# DEPARTMENT PERFORMANCE TABLE  (+ status icon set, trend arrows, variance)
# ----------------------------------------------------------------------------
DEPT_SEC_ROW = CARD_BLOCK_BOTTOM + 2
ws_dash.merge_cells(f"A{DEPT_SEC_ROW}:M{DEPT_SEC_ROW}")
ws_dash.cell(row=DEPT_SEC_ROW, column=1, value="DEPARTMENT PERFORMANCE (headline KPI, selected period)").font = SECTION_FONT
ws_dash.cell(row=DEPT_SEC_ROW, column=1).fill = SECTION_FILL
ws_dash.row_dimensions[DEPT_SEC_ROW].height = 20

ws_dash.merge_cells(f"N{DEPT_SEC_ROW}:Z{DEPT_SEC_ROW}")
ws_dash.cell(row=DEPT_SEC_ROW, column=14, value="PLANT SCORE GAUGE").font = SECTION_FONT
ws_dash.cell(row=DEPT_SEC_ROW, column=14).fill = SECTION_FILL

dept_headers = ["Department", "Headline KPI", "Target", "Actual", "Achievement %", "Status", "Trend", "Variance"]
DEPT_HDR_ROW = DEPT_SEC_ROW + 1
for j, h in enumerate(dept_headers, start=1):
    ws_dash.cell(row=DEPT_HDR_ROW, column=j, value=h)
style_header_row(ws_dash, DEPT_HDR_ROW, 1, len(dept_headers), height=24)

DEPT_TABLE_TOP = DEPT_HDR_ROW + 1
for i, dept in enumerate(DEPARTMENTS):
    r = DEPT_TABLE_TOP + i
    hk = HEADLINE_KPI[dept]
    ws_dash.cell(row=r, column=1, value=dept)
    ws_dash.cell(row=r, column=2, value=hk)
    ws_dash.cell(row=r, column=3,
        value=f'=IFERROR(INDEX(Tbl_KPIMaster[Maximum Target],MATCH("{hk}",Tbl_KPIMaster[KPI],0)),0)')
    ws_dash.cell(row=r, column=4,
        value=f'=IFERROR(AVERAGEIFS({MK}[Actual],{MK}[KPI Name],"{hk}",{MK}[Date],">="&{START_CELL},{MK}[Date],"<="&{END_CELL}),0)')
    ws_dash.cell(row=r, column=5,
        value=f'=IFERROR(AVERAGEIFS({MK}[Achievement %],{MK}[KPI Name],"{hk}",{MK}[Date],">="&{START_CELL},{MK}[Date],"<="&{END_CELL}),0)')
    ws_dash.cell(row=r, column=6, value=f'=IF($E{r}>=1,"Green",IF($E{r}>=0.85,"Amber","Red"))')
    ws_dash.cell(row=r, column=7,
        value=(f'=IF(AVERAGEIFS({MK}[Achievement %],{MK}[KPI Name],"{hk}",{MK}[Date],">="&{START_CELL},{MK}[Date],"<="&{END_CELL})'
               f'>=AVERAGEIFS({MK}[Achievement %],{MK}[KPI Name],"{hk}",{MK}[Date],">="&({START_CELL}-({END_CELL}-{START_CELL}+1)),{MK}[Date],"<"&{START_CELL}),'
               f'"▲","▼")'))
    ws_dash.cell(row=r, column=8, value=f'=$D{r}-$C{r}')
    for j in range(1, 9):
        cell = ws_dash.cell(row=r, column=j)
        cell.font = BODY_FONT
        cell.border = BORDER_ALL
        cell.alignment = CENTER if j != 2 else LEFT
        if j == 5:
            cell.number_format = "0.0%"
        if j in (3, 4, 8):
            cell.number_format = "0.00"
    if i % 2 == 1:
        for j in range(1, 9):
            ws_dash.cell(row=r, column=j).fill = ALT_ROW_FILL

DEPT_TABLE_BOTTOM = DEPT_TABLE_TOP + len(DEPARTMENTS) - 1

# Traffic-light icon set on Status column, and colour fill via formula on whole row status text
ws_dash.conditional_formatting.add(
    f"F{DEPT_TABLE_TOP}:F{DEPT_TABLE_BOTTOM}",
    FormulaRule(formula=[f'$F{DEPT_TABLE_TOP}="Green"'], fill=PatternFill("solid", fgColor=GREEN_FILL), font=Font(color=GREEN, bold=True)))
ws_dash.conditional_formatting.add(
    f"F{DEPT_TABLE_TOP}:F{DEPT_TABLE_BOTTOM}",
    FormulaRule(formula=[f'$F{DEPT_TABLE_TOP}="Amber"'], fill=PatternFill("solid", fgColor=AMBER_FILL), font=Font(color=AMBER, bold=True)))
ws_dash.conditional_formatting.add(
    f"F{DEPT_TABLE_TOP}:F{DEPT_TABLE_BOTTOM}",
    FormulaRule(formula=[f'$F{DEPT_TABLE_TOP}="Red"'], fill=PatternFill("solid", fgColor=RED_FILL), font=Font(color=RED, bold=True)))
ws_dash.conditional_formatting.add(
    f"E{DEPT_TABLE_TOP}:E{DEPT_TABLE_BOTTOM}",
    IconSetRule(icon_style="3TrafficLights1", type="percent", values=[0, 50, 85], showValue=True, reverse=False))
ws_dash.conditional_formatting.add(
    f"G{DEPT_TABLE_TOP}:G{DEPT_TABLE_BOTTOM}",
    FormulaRule(formula=[f'$G{DEPT_TABLE_TOP}="▲"'], font=Font(color=GREEN, bold=True, size=12)))
ws_dash.conditional_formatting.add(
    f"G{DEPT_TABLE_TOP}:G{DEPT_TABLE_BOTTOM}",
    FormulaRule(formula=[f'$G{DEPT_TABLE_TOP}="▼"'], font=Font(color=RED, bold=True, size=12)))

# Highlight top performer / worst performer (by Achievement %)
ws_dash.conditional_formatting.add(
    f"A{DEPT_TABLE_TOP}:H{DEPT_TABLE_BOTTOM}",
    FormulaRule(formula=[f'$E{DEPT_TABLE_TOP}=MAX($E${DEPT_TABLE_TOP}:$E${DEPT_TABLE_BOTTOM})'],
                fill=PatternFill("solid", fgColor="D6F5DD")))
ws_dash.conditional_formatting.add(
    f"A{DEPT_TABLE_TOP}:H{DEPT_TABLE_BOTTOM}",
    FormulaRule(formula=[f'$E{DEPT_TABLE_TOP}=MIN($E${DEPT_TABLE_TOP}:$E${DEPT_TABLE_BOTTOM})'],
                fill=PatternFill("solid", fgColor="FBE0DE")))

autosize(ws_dash, {"A": 14, "B": 26, "C": 10, "D": 10, "E": 13, "F": 10, "G": 8, "H": 10})
for col_l in "IJKLM":
    ws_dash.column_dimensions[col_l].width = 8

print(f"Department table rows {DEPT_TABLE_TOP}-{DEPT_TABLE_BOTTOM}.")

# ----------------------------------------------------------------------------
# CALC ENGINE (off to the side, columns AB:AG) — KPI issue ranking helper
# Kept outside the AB print area (print area stops at column Z) but on-sheet
# so it recalculates live with everything else. Do not delete.
# ----------------------------------------------------------------------------
CALC_TOP = 3
ws_dash.cell(row=CALC_TOP - 1, column=42, value="CALC ENGINE — issue ranking (auto, do not delete)").font = Font(
    name=FONT_NAME, size=9, italic=True, color="8A93A6")
calc_headers = ["KPI Name", "Department", "Red Count (period)", "Avg Achievement %", "Score", "Unique Rank"]
for j, h in enumerate(calc_headers):
    ws_dash.cell(row=CALC_TOP, column=42 + j, value=h).font = Font(name=FONT_NAME, size=8, bold=True, color="8A93A6")

for i, (dept, kpi, freq, unit, owner, mn, mx, tol, order, direction, category) in enumerate(KPI_DEFS):
    r = CALC_TOP + 1 + i
    ws_dash.cell(row=r, column=42, value=kpi)
    ws_dash.cell(row=r, column=43, value=dept)
    ws_dash.cell(row=r, column=44,
        value=f'=COUNTIFS({MK}[KPI Name],$AP{r},{MK}[Traffic Light],"Red",{MK}[Date],">="&{START_CELL},{MK}[Date],"<="&{END_CELL})')
    ws_dash.cell(row=r, column=45,
        value=f'=IFERROR(AVERAGEIFS({MK}[Achievement %],{MK}[KPI Name],$AP{r},{MK}[Date],">="&{START_CELL},{MK}[Date],"<="&{END_CELL}),1)')
    ws_dash.cell(row=r, column=46, value=f'=$AR{r}*1000+(1-$AS{r})*100')
    ws_dash.cell(row=r, column=47,
        value=f'=RANK.EQ($AT{r},$AT${CALC_TOP+1}:$AT${CALC_TOP+len(KPI_DEFS)})+COUNTIF($AT${CALC_TOP+1}:$AT{r-1},$AT{r})')
    for c in range(42, 48):
        ws_dash.cell(row=r, column=c).font = Font(name=FONT_NAME, size=8, color="8A93A6")
CALC_BOTTOM = CALC_TOP + len(KPI_DEFS)

# ----------------------------------------------------------------------------
# TOP 10 ISSUES  +  ACTION / ESCALATION STAT TILES
# ----------------------------------------------------------------------------
ISSUES_SEC_ROW = DEPT_TABLE_BOTTOM + 2
ws_dash.merge_cells(f"A{ISSUES_SEC_ROW}:M{ISSUES_SEC_ROW}")
ws_dash.cell(row=ISSUES_SEC_ROW, column=1, value="TOP 10 ISSUES (most Red occurrences in selected period)").font = SECTION_FONT
ws_dash.cell(row=ISSUES_SEC_ROW, column=1).fill = SECTION_FILL
ws_dash.row_dimensions[ISSUES_SEC_ROW].height = 20

issue_headers = ["Rank", "KPI Name", "Department", "Red Count", "Achievement %"]
ISSUE_HDR_ROW = ISSUES_SEC_ROW + 1
for j, h in enumerate(issue_headers, start=1):
    ws_dash.cell(row=ISSUE_HDR_ROW, column=j, value=h)
style_header_row(ws_dash, ISSUE_HDR_ROW, 1, len(issue_headers), height=22)

ISSUE_TOP = ISSUE_HDR_ROW + 1
for n in range(1, 11):
    r = ISSUE_TOP + n - 1
    ws_dash.cell(row=r, column=1, value=n)
    ws_dash.cell(row=r, column=2,
        value=f'=IFERROR(INDEX($AP${CALC_TOP+1}:$AP${CALC_BOTTOM},MATCH($A{r},$AU${CALC_TOP+1}:$AU${CALC_BOTTOM},0)),"")')
    ws_dash.cell(row=r, column=3,
        value=f'=IFERROR(INDEX($AQ${CALC_TOP+1}:$AQ${CALC_BOTTOM},MATCH($A{r},$AU${CALC_TOP+1}:$AU${CALC_BOTTOM},0)),"")')
    ws_dash.cell(row=r, column=4,
        value=f'=IFERROR(INDEX($AR${CALC_TOP+1}:$AR${CALC_BOTTOM},MATCH($A{r},$AU${CALC_TOP+1}:$AU${CALC_BOTTOM},0)),"")')
    ws_dash.cell(row=r, column=5,
        value=f'=IFERROR(INDEX($AS${CALC_TOP+1}:$AS${CALC_BOTTOM},MATCH($A{r},$AU${CALC_TOP+1}:$AU${CALC_BOTTOM},0)),"")')
    for j in range(1, 6):
        cell = ws_dash.cell(row=r, column=j)
        cell.font = BODY_FONT
        cell.border = BORDER_ALL
        cell.alignment = CENTER if j != 2 else LEFT
        if j == 5:
            cell.number_format = "0.0%"
    if (n % 2) == 0:
        for j in range(1, 6):
            ws_dash.cell(row=r, column=j).fill = ALT_ROW_FILL
ISSUE_BOTTOM = ISSUE_TOP + 9

ws_dash.conditional_formatting.add(
    f"D{ISSUE_TOP}:D{ISSUE_BOTTOM}",
    FormulaRule(formula=[f'$D{ISSUE_TOP}>=3'], fill=PatternFill("solid", fgColor=RED_FILL), font=Font(color=RED, bold=True)))
ws_dash.conditional_formatting.add(
    f"D{ISSUE_TOP}:D{ISSUE_BOTTOM}",
    FormulaRule(formula=[f'AND($D{ISSUE_TOP}>0,$D{ISSUE_TOP}<3)'], fill=PatternFill("solid", fgColor=AMBER_FILL)))

# ---- Action / Escalation stat tiles (5 small cards to the right of Top 10 Issues) ----
STAT_TOP = ISSUES_SEC_ROW
stat_defs = [
    ("Open Actions",
     f'=COUNTIFS(Tbl_ActionTracker[Department],IF({DEPT_FILTER_CELL}="All","*",{DEPT_FILTER_CELL}),'
     f'Tbl_ActionTracker[Owner],IF({OWNER_FILTER_CELL}="All","*",{OWNER_FILTER_CELL}),'
     f'Tbl_ActionTracker[Priority],IF({PRIORITY_FILTER_CELL}="All","*",{PRIORITY_FILTER_CELL}),'
     f'Tbl_ActionTracker[Status],"Open")', "count"),
    ("Overdue Actions",
     f'=COUNTIFS(Tbl_ActionTracker[Department],IF({DEPT_FILTER_CELL}="All","*",{DEPT_FILTER_CELL}),'
     f'Tbl_ActionTracker[Owner],IF({OWNER_FILTER_CELL}="All","*",{OWNER_FILTER_CELL}),'
     f'Tbl_ActionTracker[Priority],IF({PRIORITY_FILTER_CELL}="All","*",{PRIORITY_FILTER_CELL}),'
     f'Tbl_ActionTracker[Overdue?],"Yes")', "count"),
    ("Actions Due Today",
     f'=COUNTIFS(Tbl_ActionTracker[Department],IF({DEPT_FILTER_CELL}="All","*",{DEPT_FILTER_CELL}),'
     f'Tbl_ActionTracker[Owner],IF({OWNER_FILTER_CELL}="All","*",{OWNER_FILTER_CELL}),'
     f'Tbl_ActionTracker[Priority],IF({PRIORITY_FILTER_CELL}="All","*",{PRIORITY_FILTER_CELL}),'
     f'Tbl_ActionTracker[Due Date],TODAY(),Tbl_ActionTracker[Status],"<>Closed")', "count"),
    ("Today's Escalations (High Priority, Due/Overdue)",
     f'=COUNTIFS(Tbl_ActionTracker[Department],IF({DEPT_FILTER_CELL}="All","*",{DEPT_FILTER_CELL}),'
     f'Tbl_ActionTracker[Owner],IF({OWNER_FILTER_CELL}="All","*",{OWNER_FILTER_CELL}),'
     f'Tbl_ActionTracker[Priority],"High",Tbl_ActionTracker[Due Date],"<="&TODAY(),Tbl_ActionTracker[Status],"<>Closed")', "count"),
    ("Previous Day Action Closure %",
     f'=IFERROR(COUNTIFS(Tbl_ActionTracker[Due Date],TODAY()-1,Tbl_ActionTracker[Status],"Closed")'
     f'/COUNTIFS(Tbl_ActionTracker[Due Date],TODAY()-1),0)', "pct"),
]
STAT_CARD_W = 5
STAT_CARD_H = 4
for idx, (label, formula, kind) in enumerate(stat_defs):
    left = 15 + idx * STAT_CARD_W
    right = left + STAT_CARD_W - 1
    top = STAT_TOP
    bottom = top + STAT_CARD_H - 1
    for rr in range(top, bottom + 1):
        for cc in range(left, right + 1):
            ws_dash.cell(row=rr, column=cc).fill = CARD_FILL
    label_row = top + 1
    value_row = top + 2
    ws_dash.merge_cells(start_row=label_row, start_column=left, end_row=label_row, end_column=right)
    lc = ws_dash.cell(row=label_row, column=left, value=label.upper())
    lc.font = Font(name=FONT_NAME, size=8.5, bold=True, color="C7D1E0")
    lc.alignment = CENTER
    lc.fill = CARD_FILL
    ws_dash.merge_cells(start_row=value_row, start_column=left, end_row=value_row, end_column=right)
    vc = ws_dash.cell(row=value_row, column=left, value=formula)
    vc.font = Font(name=FONT_NAME, size=18, bold=True, color=WHITE)
    vc.alignment = CENTER
    vc.fill = CARD_FILL
    vc.number_format = "0%" if kind == "pct" else "0"

wb.save("/home/user/hira-repo/dist/DMS_Dashboard.xlsx")
print(f"Top 10 Issues ({ISSUE_TOP}-{ISSUE_BOTTOM}) and action stat tiles complete.")

# ----------------------------------------------------------------------------
# TODAY'S ESCALATIONS — live drill-down list (High priority, due today or overdue, not closed)
# ----------------------------------------------------------------------------
ESC_SEC_ROW = STAT_TOP + STAT_CARD_H + 1
ws_dash.merge_cells(f"N{ESC_SEC_ROW}:Z{ESC_SEC_ROW}")
ws_dash.cell(row=ESC_SEC_ROW, column=14, value="TODAY'S ESCALATIONS — High priority, due or overdue, open now").font = SECTION_FONT
ws_dash.cell(row=ESC_SEC_ROW, column=14).fill = SECTION_FILL
ws_dash.row_dimensions[ESC_SEC_ROW].height = 20

esc_headers = ["Action ID", "Department", "Issue", "Owner", "Due Date", "Days Overdue"]
ESC_HDR_ROW = ESC_SEC_ROW + 1
for j, h in enumerate(esc_headers):
    ws_dash.cell(row=ESC_HDR_ROW, column=14 + j, value=h)
style_header_row(ws_dash, ESC_HDR_ROW, 14, 14 + len(esc_headers) - 1, height=22)

AT = "Tbl_ActionTracker"
ESC_TOP = ESC_HDR_ROW + 1
ESC_ROWS = 8
esc_cond = (f'(({AT}[Priority]="High"))*(({AT}[Status]<>"Closed"))*(({AT}[Due Date]<=TODAY()))')
for n in range(1, ESC_ROWS + 1):
    r = ESC_TOP + n - 1
    match_pos = (f'AGGREGATE(15,6,(ROW({AT}[Action ID])-ROW(INDEX({AT}[Action ID],1))+1)/({esc_cond}),{n})')
    ws_dash.cell(row=r, column=14, value=f'=IFERROR(INDEX({AT}[Action ID],{match_pos}),"")')
    ws_dash.cell(row=r, column=15, value=f'=IFERROR(INDEX({AT}[Department],{match_pos}),"")')
    ws_dash.cell(row=r, column=16, value=f'=IFERROR(INDEX({AT}[Issue],{match_pos}),"")')
    ws_dash.cell(row=r, column=17, value=f'=IFERROR(INDEX({AT}[Owner],{match_pos}),"")')
    ws_dash.cell(row=r, column=18, value=f'=IFERROR(INDEX({AT}[Due Date],{match_pos}),"")')
    ws_dash.cell(row=r, column=18).number_format = "dd-mmm"
    ws_dash.cell(row=r, column=19, value=f'=IFERROR(INDEX({AT}[Days Overdue],{match_pos}),"")')
    for j in (14, 15, 16, 17, 18, 19):
        cell = ws_dash.cell(row=r, column=j)
        cell.font = BODY_FONT
        cell.border = BORDER_ALL
        cell.alignment = CENTER if j != 16 else LEFT
    if (n % 2) == 0:
        for j in (14, 15, 16, 17, 18, 19):
            ws_dash.cell(row=r, column=j).fill = ALT_ROW_FILL
ESC_BOTTOM = ESC_TOP + ESC_ROWS - 1

ws_dash.conditional_formatting.add(
    f"S{ESC_TOP}:S{ESC_BOTTOM}",
    FormulaRule(formula=[f'AND(ISNUMBER($S{ESC_TOP}),$S{ESC_TOP}>0)'], fill=PatternFill("solid", fgColor=RED_FILL), font=Font(color=RED, bold=True)))

wb.save("/home/user/hira-repo/dist/DMS_Dashboard.xlsx")
print(f"Escalations list rows {ESC_TOP}-{ESC_BOTTOM}.")

# ----------------------------------------------------------------------------
# Helper cells for chart data (action status distribution, gauge remainder)
# ----------------------------------------------------------------------------
AS_TOP = CALC_BOTTOM + 3
ws_dash.cell(row=AS_TOP - 1, column=42, value="Action status distribution (chart source)").font = Font(
    name=FONT_NAME, size=9, italic=True, color="8A93A6")
ws_dash.cell(row=AS_TOP, column=42, value="Status")
ws_dash.cell(row=AS_TOP, column=43, value="Count")
status_list = ["Open", "In Progress", "Closed"]
for i, st in enumerate(status_list):
    r = AS_TOP + 1 + i
    ws_dash.cell(row=r, column=42, value=st)
    ws_dash.cell(row=r, column=43, value=f'=COUNTIFS(Tbl_ActionTracker[Status],$AP{r})')
    for c in (28, 29):
        ws_dash.cell(row=r, column=c).font = Font(name=FONT_NAME, size=8, color="8A93A6")
AS_BOTTOM = AS_TOP + len(status_list)

GAUGE_TOP = AS_BOTTOM + 2
ws_dash.cell(row=GAUGE_TOP - 1, column=42, value="Gauge helper (chart source)").font = Font(
    name=FONT_NAME, size=9, italic=True, color="8A93A6")
ws_dash.cell(row=GAUGE_TOP, column=42, value="Segment")
ws_dash.cell(row=GAUGE_TOP, column=43, value="Value")
ws_dash.cell(row=GAUGE_TOP + 1, column=42, value="Achieved")
ws_dash.cell(row=GAUGE_TOP + 1, column=43, value=f"={SCORE_CELLS['Overall Plant Score']}")
ws_dash.cell(row=GAUGE_TOP + 2, column=42, value="Remaining")
ws_dash.cell(row=GAUGE_TOP + 2, column=43, value=f"=MAX(0,1-{SCORE_CELLS['Overall Plant Score']})")
for rr in (GAUGE_TOP + 1, GAUGE_TOP + 2):
    for c in (28, 29):
        ws_dash.cell(row=rr, column=c).font = Font(name=FONT_NAME, size=8, color="8A93A6")

wb.save("/home/user/hira-repo/dist/DMS_Dashboard.xlsx")
print("Chart helper cells complete.")

# ----------------------------------------------------------------------------
# CHARTS
# ----------------------------------------------------------------------------
CHART_SEC_ROW = max(ISSUE_BOTTOM, ESC_BOTTOM) + 2
ws_dash.merge_cells(f"A{CHART_SEC_ROW}:Z{CHART_SEC_ROW}")
ws_dash.cell(row=CHART_SEC_ROW, column=1, value="PERFORMANCE CHARTS").font = SECTION_FONT
ws_dash.cell(row=CHART_SEC_ROW, column=1).fill = SECTION_FILL
ws_dash.row_dimensions[CHART_SEC_ROW].height = 20

CHART_ROW_1 = CHART_SEC_ROW + 1
CHART_ROW_2 = CHART_ROW_1 + 17
CHART_ROW_3 = CHART_ROW_2 + 17

# 1) GAUGE (doughnut) — Overall Plant Score
gauge = DoughnutChart()
gauge.title = "Overall Plant Score (Gauge)"
gauge.height = 8.5
gauge.width = 11.5
gauge.holeSize = 70
data = Reference(ws_dash, min_col=43, min_row=GAUGE_TOP + 1, max_row=GAUGE_TOP + 2)
cats = Reference(ws_dash, min_col=42, min_row=GAUGE_TOP + 1, max_row=GAUGE_TOP + 2)
gauge.add_data(data, titles_from_data=False)
gauge.set_categories(cats)
from openpyxl.chart.marker import DataPoint
achieved_pt = DataPoint(idx=0)
achieved_pt.graphicalProperties.solidFill = ACCENT_TEAL
remaining_pt = DataPoint(idx=1)
remaining_pt.graphicalProperties.solidFill = MID_GREY
gauge.series[0].data_points = [achieved_pt, remaining_pt]
gauge.dataLabels = DataLabelList()
gauge.dataLabels.showPercent = False
gauge.dataLabels.showVal = True
ws_dash.add_chart(gauge, f"A{CHART_ROW_1}")

# 2) BULLET-STYLE CHART — Achievement % vs 100% target line, by department (bar+line combo)
bullet_bar = BarChart()
bullet_bar.type = "bar"
bullet_bar.title = "Department Achievement % vs Target (Bullet-style)"
bullet_bar.height = 8.5
bullet_bar.width = 11.5
data = Reference(ws_dash, min_col=5, min_row=DEPT_HDR_ROW, max_row=DEPT_TABLE_BOTTOM)
cats = Reference(ws_dash, min_col=1, min_row=DEPT_TABLE_TOP, max_row=DEPT_TABLE_BOTTOM)
bullet_bar.add_data(data, titles_from_data=True)
bullet_bar.set_categories(cats)
bullet_bar.x_axis.numFmt = "0%"
bullet_bar.series[0].graphicalProperties.solidFill = ACCENT_BLUE
bullet_bar.legend = None
ws_dash.add_chart(bullet_bar, f"H{CHART_ROW_1}")

# 3) COLUMN CHART — Target vs Actual by department
col_chart = BarChart()
col_chart.type = "col"
col_chart.grouping = "clustered"
col_chart.title = "Target vs Actual by Department (Headline KPI)"
col_chart.height = 8.5
col_chart.width = 11.5
data = Reference(ws_dash, min_col=3, min_row=DEPT_HDR_ROW, max_col=4, max_row=DEPT_TABLE_BOTTOM)
cats = Reference(ws_dash, min_col=1, min_row=DEPT_TABLE_TOP, max_row=DEPT_TABLE_BOTTOM)
col_chart.add_data(data, titles_from_data=True)
col_chart.set_categories(cats)
col_chart.series[0].graphicalProperties.solidFill = STEEL
col_chart.series[1].graphicalProperties.solidFill = ACCENT_TEAL
ws_dash.add_chart(col_chart, f"O{CHART_ROW_1}")

# 4) LINE / TREND CHART — Overall plant achievement % last 90 days
line_chart = LineChart()
line_chart.title = "Plant Overall Achievement % — 90 Day Trend"
line_chart.height = 8.5
line_chart.width = 11.5
trend_data_col = 2 + len(DEPARTMENTS)  # add an "Overall" column reference — use column L helper instead
ws_trend.cell(row=hdr_row, column=trend_data_col + 1, value="Plant Overall")
for d in range(N_DAYS):
    r = data_start + d
    cols = [get_column_letter(2 + i) for i in range(len(DEPARTMENTS))]
    avg_formula = "=AVERAGE(" + ",".join(f"{c}{r}" for c in cols) + ")"
    ws_trend.cell(row=r, column=trend_data_col + 1, value=avg_formula).number_format = "0%"
data = Reference(ws_trend, min_col=trend_data_col + 1, min_row=hdr_row, max_row=data_end)
cats = Reference(ws_trend, min_col=1, min_row=data_start, max_row=data_end)
line_chart.add_data(data, titles_from_data=True)
line_chart.set_categories(cats)
line_chart.y_axis.numFmt = "0%"
line_chart.series[0].graphicalProperties.line.solidFill = ACCENT_BLUE
line_chart.series[0].graphicalProperties.line.width = 20000
line_chart.series[0].smooth = False
line_chart.legend = None
ws_dash.add_chart(line_chart, f"A{CHART_ROW_2}")

# 5) PARETO CHART — Top 10 issues (bar + cumulative % line, secondary axis)
pareto_bar = BarChart()
pareto_bar.type = "col"
pareto_bar.title = "Pareto — Top Issues by Red Occurrences"
pareto_bar.height = 8.5
pareto_bar.width = 11.5
data = Reference(ws_dash, min_col=4, min_row=ISSUE_HDR_ROW, max_row=ISSUE_BOTTOM)
cats = Reference(ws_dash, min_col=2, min_row=ISSUE_TOP, max_row=ISSUE_BOTTOM)
pareto_bar.add_data(data, titles_from_data=True)
pareto_bar.set_categories(cats)
pareto_bar.series[0].graphicalProperties.solidFill = RED
pareto_bar.y_axis.title = "Red Count"
pareto_bar.y_axis.majorGridlines = None

# cumulative % helper column (F) next to issues table
ws_dash.cell(row=ISSUE_HDR_ROW, column=6, value="Cum %")
for n in range(1, 11):
    r = ISSUE_TOP + n - 1
    ws_dash.cell(row=r, column=6,
        value=f'=IFERROR(SUM($D${ISSUE_TOP}:$D{r})/SUM($D${ISSUE_TOP}:$D${ISSUE_BOTTOM}),0)')
    ws_dash.cell(row=r, column=6).number_format = "0%"
    ws_dash.cell(row=r, column=6).font = BODY_FONT
    ws_dash.cell(row=r, column=6).border = BORDER_ALL
    ws_dash.cell(row=r, column=6).alignment = CENTER
ws_dash.cell(row=ISSUE_HDR_ROW, column=6).font = HEADER_FONT
ws_dash.cell(row=ISSUE_HDR_ROW, column=6).fill = HEADER_FILL
ws_dash.cell(row=ISSUE_HDR_ROW, column=6).alignment = CENTER

cum_line = LineChart()
data = Reference(ws_dash, min_col=6, min_row=ISSUE_HDR_ROW, max_row=ISSUE_BOTTOM)
cum_line.add_data(data, titles_from_data=True)
cum_line.y_axis.axId = 200
cum_line.y_axis.title = "Cumulative %"
cum_line.y_axis.numFmt = "0%"
cum_line.y_axis.crosses = "max"
cum_line.series[0].graphicalProperties.line.solidFill = NAVY
cum_line.series[0].graphicalProperties.line.width = 18000
cum_line.series[0].smooth = False
pareto_bar.y_axis.crosses = "autoZero"
pareto_bar += cum_line
ws_dash.add_chart(pareto_bar, f"H{CHART_ROW_2}")

# 6) ACTION STATUS CHART — pie of Open / In Progress / Closed
status_pie = PieChart()
status_pie.title = "Action Status Distribution"
status_pie.height = 8.5
status_pie.width = 11.5
data = Reference(ws_dash, min_col=43, min_row=AS_TOP + 1, max_row=AS_BOTTOM)
cats = Reference(ws_dash, min_col=42, min_row=AS_TOP + 1, max_row=AS_BOTTOM)
status_pie.add_data(data, titles_from_data=False)
status_pie.set_categories(cats)
status_pie.series[0].graphicalProperties.solidFill = ACCENT_BLUE
status_pie.dataLabels = DataLabelList()
status_pie.dataLabels.showVal = True
status_pie.dataLabels.showPercent = True
from openpyxl.chart.marker import DataPoint as DP
pts = [DP(idx=0), DP(idx=1), DP(idx=2)]
pts[0].graphicalProperties.solidFill = RED
pts[1].graphicalProperties.solidFill = AMBER
pts[2].graphicalProperties.solidFill = GREEN
status_pie.series[0].data_points = pts
ws_dash.add_chart(status_pie, f"O{CHART_ROW_2}")

# 7) DEPARTMENT COMPARISON CHART — radar of Achievement % across departments
radar = RadarChart()
radar.type = "filled"
radar.title = "Department Comparison — Achievement %"
radar.height = 8.5
radar.width = 25
data = Reference(ws_dash, min_col=5, min_row=DEPT_HDR_ROW, max_row=DEPT_TABLE_BOTTOM)
cats = Reference(ws_dash, min_col=1, min_row=DEPT_TABLE_TOP, max_row=DEPT_TABLE_BOTTOM)
radar.add_data(data, titles_from_data=True)
radar.set_categories(cats)
radar.y_axis.numFmt = "0%"
radar.series[0].graphicalProperties.solidFill = "2E75B64D"
radar.series[0].graphicalProperties.line.solidFill = ACCENT_BLUE
ws_dash.add_chart(radar, f"A{CHART_ROW_3}")

CHART_BLOCK_BOTTOM = CHART_ROW_3 + 17

wb.save("/home/user/hira-repo/dist/DMS_Dashboard.xlsx")
print(f"All 7 charts added. Chart block bottom ~ row {CHART_BLOCK_BOTTOM}.")

# ----------------------------------------------------------------------------
# FINAL DASHBOARD POLISH
# ----------------------------------------------------------------------------
# hide the calc-engine helper columns (AB:AG) — pure formula plumbing, not for user editing
for col_idx in range(42, 48):
    ws_dash.column_dimensions[get_column_letter(col_idx)].hidden = True

for col_letter, w in {"A": 13, "B": 11, "C": 11, "D": 11, "E": 12, "F": 10, "G": 8,
                       "H": 8, "I": 8, "J": 8, "K": 8, "L": 8, "M": 8, "N": 11, "O": 12,
                       "P": 30, "Q": 16, "R": 10, "S": 10, "T": 8, "U": 8, "V": 8,
                       "W": 8, "X": 8, "Y": 8, "Z": 8}.items():
    ws_dash.column_dimensions[col_letter].width = w

for r in range(ESC_TOP, ESC_BOTTOM + 1):
    ws_dash.row_dimensions[r].height = 30

ws_dash.sheet_view.showGridLines = False
ws_dash.print_area = f"A1:Z{CHART_BLOCK_BOTTOM}"
ws_dash.page_setup.orientation = "landscape"
ws_dash.page_setup.paperSize = ws_dash.PAPERSIZE_A3
ws_dash.page_setup.fitToWidth = 1
ws_dash.page_setup.fitToHeight = 0
ws_dash.sheet_properties.pageSetUpPr = PageSetupProperties(fitToPage=True)
ws_dash.page_margins = PageMargins(left=0.3, right=0.3, top=0.4, bottom=0.4, header=0.2, footer=0.2)

# Print setup for the data sheets too (landscape, fit to width) for convenience
for ws in (ws_master, ws_kpim, ws_action, ws_chal, ws_trend, ws_month):
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr = PageSetupProperties(fitToPage=True)
    ws.page_margins = PageMargins(left=0.3, right=0.3, top=0.4, bottom=0.4, header=0.2, footer=0.2)

# Force Excel to recalc everything on open (safe since we rely purely on formulas)
wb.calculation.fullCalcOnLoad = True

wb.active = wb.sheetnames.index("Dashboard")
for name in wb.sheetnames:
    wb[name].sheet_view.tabSelected = (name == "Dashboard")
ws_dash.sheet_view.selection[0].activeCell = "A1"
ws_dash.sheet_view.selection[0].sqref = "A1"

wb.properties.title = "Advanced Daily Management System (DMS) Dashboard"
wb.properties.creator = "DMS Dashboard Generator"
wb.properties.subject = "Plant Daily Management System"
wb.properties.description = ("Executive DMS dashboard: enter data only in the Master KPI sheet; "
                              "Dashboard, Trend Analysis and Monthly Summary refresh automatically.")

wb.save("/home/user/hira-repo/dist/DMS_Dashboard.xlsx")
print("Final polish complete. Workbook saved.")
