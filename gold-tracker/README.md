# Gold Tracker 🪙

A small dashboard for building up a gold savings stash. You record each coin, bar or piece you buy,
and it shows how many grams you hold and what they're worth at today's price.

## Features

- **Total grams saved**, also shown in sovereigns (1 sovereign = 8 g), plus pure-gold grams (22K
  counts as 91.6% pure). When you hold PAXG, it also shows how your grams split between physical
  gold and PAXG.
- **Today's price per gram** for 24K and 22K, along with the 10 g rate and today's change. It also
  shows the price of 1 sovereign (8 g) in 22K and 24K, and of 1 PAXG (one troy ounce). It refreshes every 10 minutes.
- **Value vs. cost**: what your gold is worth today, the total you've invested, gain or loss in
  money and %, and your average cost per gram.
- **Savings goal**: set a target in grams and see a progress bar and how much is left.
- **Chart** of grams held over time, one step up per purchase, with the goal line.
- **Per-purchase table**: what you paid per gram, its value today and the gain on that purchase.
  You can edit or delete any purchase.
- **Local price options**: the live spot price is the international rate. You can add a
  *local premium %* (in India, import duty plus 3% GST put retail about 9% above spot). You can
  also enter a *manual 24K rate*, such as your jeweller's or bank's rate today.
- **Physical gold or PAXG**: each purchase is either physical gold (24K or 22K, with weight in grams
  or sovereigns) or PAXG. For a PAXG buy, such as a dollar-cost-averaging buy, you enter the dollars
  you spent and the price per PAXG (or the PAXG amount you received). One PAXG is backed by one fine
  troy ounce, so the buy is saved as that many grams (1 PAXG = 31.1 g). It is valued at the plain
  spot price, without the local premium.
- **Currencies**: USD (the default), INR, AED, GBP, EUR, SGD, CAD and AUD.
- **Backup**: export or import your data as JSON.

## Stack

- **Frontend** (`client/`): React, Vite and Tailwind CSS v4. Your purchases and settings are
  stored in the browser (`localStorage`). There is no account and no database.
- **Backend** (`server/`): a small Express server. It hosts the built client and serves
  `GET /api/price?currency=USD`, which returns the 24K price per gram. Prices come from
  goldprice.org. If that fails, it uses gold-api.com with an exchange rate from open.er-api.com
  or frankfurter.app. Prices are cached for 10 minutes. If every source is down, it serves the
  last good price and marks it stale.

## Running locally

```bash
cd gold-tracker/server && npm install && npm start      # price API on :4400
cd gold-tracker/client && npm install && npm run dev    # app on :5173, proxies /api to :4400
```

For a production build, run `npm run build` in `client/`. Then run `npm start` in `server/` and
open http://localhost:4400.

## Notes

- Your data is stored per browser. Export a backup before you switch devices or clear browser
  data.
- Amounts paid are stored in the currency you entered them in. Switching currency doesn't convert
  past purchases.
- Spot price is not the price you'd get when selling. Jewellers deduct making charges and
  sometimes apply a buy-back discount. Use the manual rate if you want the dashboard to show your
  realistic resale value.
