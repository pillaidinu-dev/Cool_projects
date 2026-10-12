"""Build the weekend sales projection workbook (formulas only, no hardcoded results).

Usage: python3 stall/scripts/build_xlsx.py
Writes stall/Stall_Sales_Projection.xlsx. Open it once in Excel or Numbers
(or run a LibreOffice recalc) so formula values are calculated.
"""
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.comments import Comment
from openpyxl.formatting.rule import CellIsRule

OUT = Path(__file__).resolve().parent.parent / "Stall_Sales_Projection.xlsx"
wb = Workbook()

F = "Arial"
BLUE = Font(name=F, color="0000FF")
BLACK = Font(name=F)
BOLD = Font(name=F, bold=True)
GREEN = Font(name=F, color="008000")
TITLE = Font(name=F, bold=True, size=14, color="2F6B2A")
NOTE = Font(name=F, italic=True, size=9, color="5D6B55")
HDR = Font(name=F, bold=True, color="FFFFFF")
HDR_FILL = PatternFill("solid", fgColor="2F6B2A")
YELLOW = PatternFill("solid", fgColor="FFFF00")
TOT_FILL = PatternFill("solid", fgColor="E8EEE1")
thin = Side(style="thin", color="B7C4AC")
TOP = Border(top=Side(style="thin", color="2F6B2A"))
MONEY = '$#,##0.00;($#,##0.00);"-"'
MONEY0 = '$#,##0;($#,##0);"-"'
INT = '#,##0;(#,##0);"-"'
PCT = '0.0%;(0.0%);"-"'
DEC = '#,##0.0;(#,##0.0);"-"'
ROWS = range(5, 11)  # six item slots, rows 5-10

def header(ws, row, labels, start=1):
    for i, t in enumerate(labels):
        c = ws.cell(row=row, column=start + i, value=t)
        c.font, c.fill = HDR, HDR_FILL
        c.alignment = Alignment(wrap_text=True, vertical="center", horizontal="center" if i else "left")
    ws.row_dimensions[row].height = 32

def put(ws, ref, value, font=BLACK, fmt=None, fill=None, bold=False):
    c = ws[ref]; c.value = value
    c.font = Font(name=F, bold=bold, color=font.color, italic=font.italic, size=font.size)
    if fmt: c.number_format = fmt
    if fill: c.fill = fill
    return c

def widths(ws, w):
    for col, v in w.items(): ws.column_dimensions[col].width = v

# ---------------- Inputs ----------------
ws = wb.active; ws.title = "Inputs"
put(ws, "A1", "Snack Stall: Projection Inputs", TITLE)
put(ws, "A2", "Blue text = numbers you can change. Yellow = guesses to replace with your own. Every other tab updates from this one.", NOTE)
header(ws, 4, ["Item", "Size", "Price ($)", "Ingredient cost per unit ($)", "Stock prepared (units)", "Low (units / day)", "Expected (units / day)", "High (units / day)", "Notes"])
items = [
    ("Medhu Vadai", "1 plate", 6, 50, 10, 20, 35),
    ("Paneer Puff", "1 piece", 4, 30, 10, 20, 35),
    ("Podi Idly", "1 plate", 8, 20, 8, 15, 25),
    ("Rose Milk", "10 oz", 3, 15, 12, 25, 40),
    ("Misc", "", 3, None, 0, 0, 0),
]
# Units actually sold, from the ledger (31 orders, exported Oct 12), and the real total spend.
ACTUAL_UNITS = [16, 21, 8, 8, 1]
ACTUAL_SPEND = 144
for r, it in zip(ROWS, items):
    name, size, price, stock, lo, ex, hi = it
    put(ws, f"A{r}", name, BLUE); put(ws, f"B{r}", size, BLUE)
    put(ws, f"C{r}", price, BLUE, MONEY)
    put(ws, f"D{r}", 0, BLUE, MONEY, YELLOW)
    put(ws, f"E{r}", stock, BLUE, INT)
    put(ws, f"F{r}", lo, BLUE, INT, YELLOW); put(ws, f"G{r}", ex, BLUE, INT, YELLOW); put(ws, f"H{r}", hi, BLUE, INT, YELLOW)
for r in (10,):
    for col, fmt in zip("CDEFGH", [MONEY, MONEY, INT, INT, INT, INT]):
        ws[f"{col}{r}"].number_format = fmt; ws[f"{col}{r}"].font = BLUE
    ws[f"A{r}"].font = BLUE; ws[f"B{r}"].font = BLUE
put(ws, "I5", "Prices: from the tracker (Rose Milk $3, Misc $3 as sold).", NOTE)
put(ws, "I6", "Units per day: my starting guesses for a small weekend stall. Replace with your own.", NOTE)
put(ws, "I7", "Stock: from the tracker (50 / 30 / 20 / 15; Misc not counted).", NOTE)
put(ws, "I8", "Ingredient cost: 0 because your $50 cooking items are in fixed costs. Enter a per-unit cost to model buying more for bigger days.", NOTE)
put(ws, "I9", "Misc: added in the tracker during the event. Row 10 is a spare row.", NOTE)
ws["D5"].comment = Comment("Leave at 0 if the $50 cooking items covers all your ingredients. If you'd buy more ingredients to sell more, enter the cost per plate/piece/cup here.", "Claude")

put(ws, "A12", "Fixed costs", BOLD)
put(ws, "B12", "Amount ($)", BOLD)
for r, (lab, amt, note) in zip(range(13, 17), [("Stall fee", 60, "From you."), ("Supplies", 50, "From you."), ("Cooking items", 50, "From you."), ("Other", 0, "Ice, cups, parking, etc.")]):
    put(ws, f"A{r}", lab); put(ws, f"B{r}", amt, BLUE, MONEY); put(ws, f"C{r}", note, NOTE)
put(ws, "A17", "Total fixed costs", BOLD); put(ws, "B17", "=SUM(B13:B16)", BLACK, MONEY, TOT_FILL, bold=True)
ws["A17"].border = TOP; ws["B17"].border = TOP

put(ws, "A19", "Event", BOLD)
put(ws, "A20", "Days open"); put(ws, "B20", 2, BLUE, INT); put(ws, "C20", "Saturday and Sunday.", NOTE)
put(ws, "A21", "Hours open per day"); put(ws, "B21", 6, BLUE, INT, YELLOW); put(ws, "C21", "Guess. Used only for items per hour.", NOTE)
widths(ws, {"A": 22, "B": 12, "C": 11, "D": 15, "E": 13, "F": 12, "G": 13, "H": 12, "I": 70})
ws.freeze_panes = "B5"

# ---------------- Projection ----------------
ps = wb.create_sheet("Projection")
put(ps, "A1", "Weekend Sales Projection", TITLE)
put(ps, "A2", "Units are per weekend (units per day x days open). Change the numbers on the Inputs tab.", NOTE)
header(ps, 4, ["Item", "Price ($)", "Low units", "Low sales ($)", "Expected units", "Expected sales ($)", "High units", "High sales ($)"])
for r in ROWS:
    put(ps, f"A{r}", f'=IF(Inputs!A{r}="","",Inputs!A{r})', GREEN)
    put(ps, f"B{r}", f"=Inputs!C{r}", GREEN, MONEY)
    for ucol, scol, icol in (("C", "D", "F"), ("E", "F", "G"), ("G", "H", "H")):
        put(ps, f"{ucol}{r}", f"=Inputs!{icol}{r}*Inputs!$B$20", GREEN, INT)
        put(ps, f"{scol}{r}", f"={ucol}{r}*$B{r}", BLACK, MONEY0)
put(ps, "A11", "Total", BOLD)
for col in "CDEFGH":
    put(ps, f"{col}11", f"=SUM({col}5:{col}10)", BLACK, INT if col in "CEG" else MONEY0, TOT_FILL, bold=True)
for col in "ABCDEFGH": ps[f"{col}11"].border = TOP
ps["A11"].fill = TOT_FILL; ps["B11"].fill = TOT_FILL

header(ps, 13, ["Summary", "Low", "Expected", "High"])
units = {"B": "C", "C": "E", "D": "G"}
sales = {"B": "D", "C": "F", "D": "H"}
lines = [
    (14, "Sales", lambda c: f"={sales[c]}11", MONEY0),
    (15, "Ingredient cost (per-unit)", lambda c: f"=SUMPRODUCT({units[c]}5:{units[c]}10,Inputs!$D$5:$D$10)", MONEY0),
    (16, "Fixed costs", lambda c: "=Inputs!$B$17", MONEY0),
    (17, "Profit / loss", lambda c: f"={c}14-{c}15-{c}16", MONEY0),
    (18, "Profit margin", lambda c: f"=IF({c}14=0,0,{c}17/{c}14)", PCT),
    (19, "Items sold (weekend)", lambda c: f"={units[c]}11", INT),
    (20, "Items per hour", lambda c: f"=IF(Inputs!$B$20*Inputs!$B$21=0,0,{c}19/(Inputs!$B$20*Inputs!$B$21))", DEC),
    (21, "Average price per item", lambda c: f"=IF({c}19=0,0,{c}14/{c}19)", MONEY),
    (22, "Profit per item before fixed costs", lambda c: f"=IF({c}19=0,0,({c}14-{c}15)/{c}19)", MONEY),
    (23, "Items to sell to break even", lambda c: f"=IF({c}22<=0,0,ROUNDUP(Inputs!$B$17/{c}22,0))", INT),
    (24, "Sales needed to break even ($)", lambda c: f"={c}23*{c}21", MONEY0),
]
for r, lab, fn, fmt in lines:
    put(ps, f"A{r}", lab, BOLD if r == 17 else BLACK)
    for c in "BCD":
        font = GREEN if r == 16 else BLACK
        put(ps, f"{c}{r}", fn(c), font, fmt, TOT_FILL if r == 17 else None, bold=(r == 17))
for c in "ABCD": ps[f"{c}17"].border = TOP
ps["A17"].fill = TOT_FILL
put(ps, "A26", "Break-even uses each scenario's mix of items. With mostly Paneer Puffs ($4) you need more items than with mostly Vadai or Idly ($6).", NOTE)
ps.conditional_formatting.add("B17:D17", CellIsRule(operator="lessThan", formula=["0"], font=Font(name=F, bold=True, color="C0392B")))
ps.conditional_formatting.add("B17:D17", CellIsRule(operator="greaterThan", formula=["0"], font=Font(name=F, bold=True, color="2F7D32")))
widths(ps, {"A": 34, "B": 12, "C": 12, "D": 13, "E": 13, "F": 14, "G": 12, "H": 13})
ps.freeze_panes = "B5"

# ---------------- What-if ----------------
wf = wb.create_sheet("What-if")
put(wf, "A1", "What-if: Weekend Profit", TITLE)
put(wf, "A2", "Weekend profit for each mix of items sold per day (down) and average price per item (across). Green = profit, red = loss. Change the blue numbers to test other cases.", NOTE)
put(wf, "A4", "Items sold per day / Avg price", BOLD)
for i, p in enumerate([4, 4.5, 5, 5.5, 6]):
    c = wf.cell(row=4, column=2 + i, value=p); c.font = Font(name=F, bold=True, color="0000FF"); c.number_format = MONEY; c.fill = TOT_FILL
for i, n in enumerate(range(10, 110, 10)):
    r = 5 + i
    c = wf.cell(row=r, column=1, value=n); c.font = Font(name=F, bold=True, color="0000FF"); c.number_format = INT; c.fill = TOT_FILL
    for j in range(5):
        col = "BCDEF"[j]
        put(wf, f"{col}{r}", f"=$A{r}*$B$18*({col}$4-$B$16)-$B$17", BLACK, MONEY0)
put(wf, "A16", "Ingredient cost per item"); put(wf, "B16", "=IF(Projection!C19=0,0,Projection!C15/Projection!C19)", GREEN, MONEY)
put(wf, "C16", "From the expected mix on Projection.", NOTE)
put(wf, "A17", "Fixed costs"); put(wf, "B17", "=Inputs!B17", GREEN, MONEY0)
put(wf, "A18", "Days open"); put(wf, "B18", "=Inputs!B20", GREEN, INT)
put(wf, "A20", "Your menu averages about $5 per item. Read down the $5.00 column to see how many items a day you need.", NOTE)
red = PatternFill("solid", fgColor="F8D7D3"); grn = PatternFill("solid", fgColor="D8EED5")
wf.conditional_formatting.add("B5:F14", CellIsRule(operator="lessThan", formula=["0"], fill=red))
wf.conditional_formatting.add("B5:F14", CellIsRule(operator="greaterThanOrEqual", formula=["0"], fill=grn))
widths(wf, {"A": 30, "B": 12, "C": 12, "D": 12, "E": 12, "F": 12})

# ---------------- Stock plan ----------------
st = wb.create_sheet("Stock plan")
put(st, "A1", "Stock Plan", TITLE)
put(st, "A2", "Checks whether what you're making covers the projected weekend sales. Enter stock on the Inputs tab.", NOTE)
header(st, 4, ["Item", "Stock prepared", "Expected units", "High units", "Left over (expected)", "Sales if all stock sells ($)", "Status"])
for r in ROWS:
    put(st, f"A{r}", f'=IF(Inputs!A{r}="","",Inputs!A{r})', GREEN)
    put(st, f"B{r}", f"=Inputs!E{r}", GREEN, INT)
    put(st, f"C{r}", f"=Projection!E{r}", GREEN, INT)
    put(st, f"D{r}", f"=Projection!G{r}", GREEN, INT)
    put(st, f"E{r}", f'=IF(OR(A{r}="",Inputs!E{r}=""),0,B{r}-C{r})', BLACK, INT)
    put(st, f"F{r}", f"=B{r}*Inputs!C{r}", BLACK, MONEY0)
    put(st, f"G{r}", f'=IF(A{r}="","",IF(Inputs!E{r}="","Stock not counted",IF(B{r}>=D{r},"Enough even for a busy weekend",IF(B{r}>=C{r},"Enough for expected","Short by "&(C{r}-B{r})&" for expected"))))', BLACK)
put(st, "A11", "Total", BOLD)
for col, fmt in zip("BCDEF", [INT, INT, INT, INT, MONEY0]):
    put(st, f"{col}11", f"=SUM({col}5:{col}10)", BLACK, fmt, TOT_FILL, bold=True)
for col in "ABCDEFG": st[f"{col}11"].border = TOP
st["A11"].fill = TOT_FILL; st["G11"].fill = TOT_FILL
put(st, "A13", "Left over below zero means you'd sell out before the expected number. Sales if all stock sells is the most you can earn with that stock.", NOTE)
st.conditional_formatting.add("E5:E10", CellIsRule(operator="lessThan", formula=["0"], font=Font(name=F, bold=True, color="C0392B")))
widths(st, {"A": 18, "B": 12, "C": 12, "D": 11, "E": 14, "F": 16, "G": 32})

# ---------------- Actuals ----------------
ac = wb.create_sheet("Actuals")
put(ac, "A1", "Actuals vs Projection", TITLE)
put(ac, "A2", "Units sold are from the tracker (31 orders, exported Oct 12). Actual sales = price x units sold. Yellow cells can be changed if more sales come in.", NOTE)
header(ac, 4, ["Item", "Price ($)", "Expected units", "Actual units sold", "Difference (units)", "Expected sales ($)", "Actual sales ($)\n= price x units"])
for r in ROWS:
    put(ac, f"A{r}", f'=IF(Inputs!A{r}="","",Inputs!A{r})', GREEN)
    put(ac, f"B{r}", f"=Inputs!C{r}", GREEN, MONEY)
    put(ac, f"C{r}", f"=Projection!E{r}", GREEN, INT)
    put(ac, f"D{r}", ACTUAL_UNITS[r - 5] if r - 5 < len(ACTUAL_UNITS) else None, BLUE, INT, YELLOW if r - 5 < len(ACTUAL_UNITS) else None)
    put(ac, f"E{r}", f'=IF(D{r}="",0,D{r}-C{r})', BLACK, INT)
    put(ac, f"F{r}", f"=B{r}*C{r}", BLACK, MONEY0)
    put(ac, f"G{r}", f"=B{r}*D{r}", BLACK, MONEY0)
put(ac, "A11", "Total", BOLD)
for col, fmt in zip("CDEFG", [INT, INT, INT, MONEY0, MONEY0]):
    put(ac, f"{col}11", f"=SUM({col}5:{col}10)", BLACK, fmt, TOT_FILL, bold=True)
for col in "ABCDEFG": ac[f"{col}11"].border = TOP
ac["A11"].fill = TOT_FILL; ac["B11"].fill = TOT_FILL

header(ac, 13, ["Profit", "Expected", "Actual"])
put(ac, "A14", "Sales"); put(ac, "B14", "=F11", BLACK, MONEY0); put(ac, "C14", "=G11", BLACK, MONEY0)
put(ac, "A15", "Ingredient cost (per-unit)"); put(ac, "B15", "=Projection!C15", GREEN, MONEY0); put(ac, "C15", "=SUMPRODUCT(D5:D10,Inputs!$D$5:$D$10)", BLACK, MONEY0)
put(ac, "A16", "Spend"); put(ac, "B16", "=Inputs!B17", GREEN, MONEY0); put(ac, "C16", ACTUAL_SPEND, BLUE, MONEY0, YELLOW)
put(ac, "D16", "Real spend from the tracker: stall fee $60, supplies $38, cooking items $45, Drift $1.", NOTE)
put(ac, "A17", "Profit / loss", BOLD)
put(ac, "B17", "=B14-B15-B16", BLACK, MONEY0, TOT_FILL, bold=True); put(ac, "C17", "=C14-C15-C16", BLACK, MONEY0, TOT_FILL, bold=True)
for c in "ABC": ac[f"{c}17"].border = TOP
ac["A17"].fill = TOT_FILL
put(ac, "A18", "Profit margin"); put(ac, "B18", "=IF(B14=0,0,B17/B14)", BLACK, PCT); put(ac, "C18", "=IF(C14=0,0,C17/C14)", BLACK, PCT)
put(ac, "D18", "Profit / sales: the share of each dollar of sales you kept.", NOTE)
put(ac, "A19", "Actual vs expected profit"); put(ac, "C19", "=C17-B17", BLACK, MONEY0)
put(ac, "A20", "Expected uses the Inputs guesses; Actual uses what the tracker recorded.", NOTE)
ac.conditional_formatting.add("E5:E11", CellIsRule(operator="lessThan", formula=["0"], font=Font(name=F, color="C0392B")))
ac.conditional_formatting.add("C19", CellIsRule(operator="lessThan", formula=["0"], font=Font(name=F, bold=True, color="C0392B")))
ac.conditional_formatting.add("B17:C18", CellIsRule(operator="lessThan", formula=["0"], font=Font(name=F, bold=True, color="C0392B")))
ac.conditional_formatting.add("B17:C17", CellIsRule(operator="greaterThan", formula=["0"], font=Font(name=F, bold=True, color="2F7D32")))
widths(ac, {"A": 26, "B": 12, "C": 12, "D": 13, "E": 13, "F": 14, "G": 15})
ac.freeze_panes = "B5"

for s in wb.worksheets:
    s.sheet_view.showGridLines = False
wb.save(OUT)
print("saved", OUT)
