# Vending Tracker

Inventory tracker for a Pokemon / Riftbound / One Piece vending business, plus a separate
personal collection. Every item is acquired, then either sold or traded. Stock on hand is
valued at a set share of TCGplayer market price (90% by default).

- **Page** (`index.html`): one self-contained file on GitHub Pages.
  - **Two books.** Business is the primary inventory. Personal collection is kept apart.
    Moving something to the collection ("→ PC") books a sale from the business at the
    valuation price and creates the twin item in the personal book at that cost. "→ Biz"
    does the reverse.
  - **Sell** records units, price, channel and fees. **Trade** records units traded away,
    the dollar value received, what came back and with whom, and can add the return as
    new inventory in one step (linked from the Traded tab).
  - **Market price** per item: the `$` button searches TCGplayer through the Worker and
    lets you pick the product, or set a manual price. `↻ Prices` refreshes every matched
    item. Auto-matched items (from the Target import) show an orange `auto ✎` badge until
    you confirm or change them; the "Auto-matched (review)" filter lists them.
  - **Stats** per book: value at 90% of market, on-hand cost, unrealized gain, realized
    profit split into sales and trades, and breakdowns by location, game and channel.
- **API** (`worker/`): a Cloudflare Worker that stores one JSON document in KV behind a
  bearer token, and proxies TCGplayer search and price lookups (`/market/search`,
  `/market/price`) since browsers cannot call TCGplayer directly.
- **Target orders** flow in automatically from `~/target-orders` (`vending_sync.py`): one
  business item per order line, tax spread into unit cost, location = the address group,
  payer = the employee, tags `target` plus `incoming` or `delivered`. Canceled orders are
  removed unless units were already sold.

The repo holds no data and no secrets. All data lives in the Worker's KV store.

## Deploy the Worker

```
cd worker
npx wrangler secret put AUTH_TOKEN           # your secret token (once)
npx wrangler deploy
```

Local dev: `npx wrangler dev` (token comes from `.dev.vars`, not committed).
