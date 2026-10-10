# Snack Stall Ledger

Sales, spend and profit/loss tracker for a weekend South Indian snack stall, plus a sales projection workbook.

Live tracker: https://claude.ai/artifact/Vkw2pvpHC8Ltw2iUMbQD6M (private; share with helpers as Editor)

## Files

| Path | What it is |
|---|---|
| `src/snack-stall-ledger.html` | Source of the online tracker, published as a claude.ai artifact. Uses the artifact runtime's `db`, `user` and `downloads` capabilities. |
| `Snack_Stall_Ledger_Offline.html` | Generated single-file offline version. Stores data in the browser's localStorage; open it by double-clicking. |
| `Stall_Sales_Projection.xlsx` | Generated projection workbook (Inputs, Projection, What-if, Stock plan, Actuals). Opens in Excel or Numbers. |
| `scripts/build_offline.py` | Builds the offline HTML from `src/snack-stall-ledger.html`. |
| `scripts/build_xlsx.py` | Builds the projection workbook with openpyxl. |

## Rebuilding

```sh
python3 stall/scripts/build_offline.py   # after editing src/snack-stall-ledger.html
python3 stall/scripts/build_xlsx.py      # needs openpyxl
```

The workbook is written with formulas only; Excel and Numbers calculate the values when the file is opened.

Changes to `src/snack-stall-ledger.html` only reach the live tracker when the artifact is republished to the URL above.

## Online data model

The tracker's shared database has four collections:

- `settings/menu`: `{items: [{id, name, unit, price, stock}]}`
- `sales`: `{items: [{id, name, price, qty}], total, pay: "cash"|"zelle", at, by, fixedAt?}`
- `extras`: tips and other income, `{kind, note, amount, pay, at, by}`
- `expenses`: `{label, amount, at}`

Totals, stock left and profit are always derived from these records, never stored.
