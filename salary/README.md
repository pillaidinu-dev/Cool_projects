# Payday Ledger

A monthly salary spending tracker. Your take-home pay sits at the top like a pay stub. Spending and saving come off it, and you see what's left plus how much you can spend each day for the rest of the month.

Live tracker: https://claude.ai/artifact/XPkfUnnkabyQoFbXWKVAkc (private: only the owner and editors can see the numbers)

## What it does

- **Salary & budget setup**: monthly take-home salary, currency, and categories with optional monthly budgets. Tick "saving" on a category (for example Savings & investments) so money you put aside isn't counted as spending.
- **Per-month salary**: change the salary for one month (raise, unpaid leave, a short month) without touching the usual amount.
- **Other income**: bonuses, refunds and side income are added to that month's income.
- **Daily allowance**: what's left divided by the days remaining in the current month.
- **Budget by category**: spent against budget, marked when a category is near or over its limit.
- **Fixing mistakes**: every entry has Edit (amount, description, category, date) and Delete, both with undo. Tap a category under Budget by category to see its entries and change its monthly budget.
- **Entries by day**, **CSV download** per month, and a **six-month trend** of spent and saved against income.

## Files

| Path | What it is |
|---|---|
| `src/payday-ledger.html` | The tracker. Published as a claude.ai artifact using the `db`, `user` and `downloads` capabilities. Opened directly as a file, it saves to the browser's localStorage instead. |

Changes to `src/payday-ledger.html` only reach the live tracker when the artifact is republished to the URL above.

## Data model

Access rules restrict all reads and writes to the owner and editors (`admin`).

- `settings/main`: `{salary, currency, categories: [{id, name, budget, save}], startMonth, updatedAt}`
- `months/<YYYY-MM>`: `{salary}`, a salary override for one month
- `spends`: `{amount, label, cat, date: "YYYY-MM-DD", month: "YYYY-MM", at}`
- `income`: other income, `{amount, label, date, month, at}`

The usual salary counts from `startMonth`, the month the setup was first saved. Totals, what's left and the allowance are always derived from these records and never stored.
