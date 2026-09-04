# Vending Tracker

Inventory tracker for a Pokemon / Riftbound / One Piece vending business, plus a separate
personal collection. Every item is acquired, then either sold or traded. Stock on hand is
valued at a set share of TCGplayer market price (90% by default).

- **Page** (`index.html`): one self-contained file on GitHub Pages.
  - **Cards view** (default): one tile per product (all order lines of the same product and
    condition consolidated, quantity summed, cost averaged) with the TCGplayer image, set, rarity and
    collector number, condition and finish, market price with the change since the last price
    snapshot, quantity on hand, cost and gain, and a ⋮ menu (Sell, Trade, move between books,
    Market price, Details, Edit, Delete). Clicking the image opens Details with a price history
    sparkline and the list of lots (each order line with its date, cost, source, buyer and
    location, editable one by one). Selling, trading or moving from a consolidated tile draws
    from the oldest lot first; setting a market price applies to every lot. List view is the old table; hover a row for details.
  - **Facets** on the left, all derived automatically and combinable: status, game, type (sealed or
    single), product kind, set, rarity, printing (standard, showcase, promo, overnumbered,
    signature), condition, finish, language, source, location, who paid, market-price state, and
    your own tags. Counts update as you narrow. Search, sort, and "hide sold out" sit above.
  - **Overview strip** at the top of every view: value at 90%, unrealized gain, day and week change,
    cost basis, total spent, realized profit, return on spend, units in transit. The **Overview**
    tab adds top holdings, biggest movers, and breakdowns by game, set, type, printing, location,
    source, who paid, condition, spend by month, sales and trades by month, and channel. It follows
    the active filters, so you can get an overview of one set or one game.
  - **Price history**: every price refresh (page button or the nightly import) records one point
    per product per day; changes and movers come from that.
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
