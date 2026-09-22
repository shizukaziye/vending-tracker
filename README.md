# Vending Tracker

Inventory tracker for a Pokemon / Riftbound / One Piece vending business, plus a separate
personal collection. Every item is acquired, then either sold or traded. Stock on hand is
valued at a set share of TCGplayer market price (85% by default; change it in settings).

- **Page** (`index.html`): one self-contained file on GitHub Pages.
  - **Adding stock**: type in the "Add" box at the top (e.g. `ahri sig`). Every Riftbound
    printing from the catalog appears as you type, with image, set, number, printing and market
    price; TCGplayer search results for other games follow a moment later. Pick one and it is
    added at quantity 1, matched and priced, with a "just added" strip to adjust quantity,
    cost, condition, location, source and who paid. Arrow keys and Enter work too. The old form
    is behind the small "manual" button. Cards sort by market price by default.
  - **Layout**: the toolbar (Add box, views, search, sort, card size S/M/L) stays pinned while
    you scroll and shows a one-line summary once the overview strip is off screen. Cards carry a
    colored stripe per game, cost / value / gain cells, and Sell / Trade / Value buttons on hover.
    Facets remember what you collapsed, get a search box when long, and have a per-facet reset.
    On phones: a bottom bar for the views, filters in a slide-over drawer, two cards per row.
    Keyboard: `/` Add box, `1`–`6` views, `f` filters, `r` review queue, `Esc` close, `?` help.
  - **Review queue**: "Review (n)" lists every auto-matched product with Accept / Change, plus
    Accept all. Each card and list row also has a ✓ accept button on its review badge.
  - **Cards view** (default): one tile per product (all order lines of the same product and
    condition consolidated, quantity summed, cost averaged) with the TCGplayer image, set, rarity and
    collector number, condition and finish, market price with the change since the last price
    snapshot, quantity on hand, cost and gain, and a ⋮ menu (Sell, Trade, move between books,
    Market price, Details, Edit, Delete). Clicking the image opens Details with tabs for details, lots, price history
    (7d / 30d / all, hover for values) and sales and the list of lots (each order line with its date, cost, source, buyer and
    location, editable one by one). Selling, trading or moving from a consolidated tile draws
    from the oldest lot first; setting a market price applies to every lot. List view is the old table; hover a row for details.
  - **Facets** on the left, all derived automatically and combinable: status, game, type (sealed or
    single), product kind, set, rarity, printing (standard, showcase, promo, overnumbered,
    signature), condition, finish, language, source, region, location, who paid, market-price
    state, and your own tags. Region is derived from the location: Zerokata, 6209 Kit Creek and
    Home are North Carolina; Bubububu and Symph are California; Cardmarket is Poland (the
    `REGIONS` table in the page). Combine it with Status to split delivered from in transit. Counts update as you narrow. Search, sort, and "hide sold out" sit above.
  - **Overview strip** at the top of every view: value at the set share of market, unrealized gain, 30-day change,
    cost basis on hand, total spent, value in transit, then one button per game and one per region
    (value on hand, plus in transit for regions) that filter the whole page. Three P&L tiles split the gain by source: **Target** and
    **Cardmarket** are their purchases only (worth at the valuation share now minus paid, with the
    bought-day figure under it); **Other** is every remaining row: purchases from other sources,
    sales, gifts, transfers and trades at their Txn P&L, and openings. The three add up to purchase
    P&L plus Txn P&L plus opening P&L. Total spent skips lots that came out of an opening, since
    their cost is the box already counted; it differs from cost basis by exactly what has left stock. The **Overview**
    tab adds top holdings, biggest movers, and breakdowns by game, set, type, printing, location,
    source, who paid, condition, spend by month, sales and trades by month, and channel. It follows
    the active filters, so you can get an overview of one set or one game. Click any strip tile for
    the math behind it: the formula with the real numbers filled in, then the products, moves
    or destinations that make it up.
  - **Price history**: every price refresh (page button or the nightly import) records one point
    per product per day; changes and movers come from that. A lot matched to several TCGplayer
  products at once (a promo set, `market.productIds`) is priced as the sum of its parts. A fixed
  `market.plus` (say, a master set's reverse holos) is added on top of that sum.
  - **Three books.** Business is the primary inventory. Personal collection and Decks are kept
    apart. "Move…" on a product picks a destination book: business ↔ collection moves are booked
    as a sale at the valuation price with a twin lot in the other book at that cost; anything
    into or out of Decks moves at cost, no profit or loss. Each book has its own ledger and stats.
  - **Sell** records units, price, channel and fees. Tick **Gift** for something given away: the
    price is 0 and the ledger and Sold tab flag it as a gift.
    **Open** (menu, sealed products only) breaks units into what came out: you list the contents
    with quantities per unit and market prices, the opened units leave stock, and each line
    becomes a new lot at the same location. The cost of the opened units is split across the
    lines by market value (evenly when nothing is priced; zero-priced lines take no cost). The
    ledger shows one "Opened" row per lot with the contents. **Trade** records units traded away,
    the dollar value received, what came back and with whom, and can add the return as
    new inventory in one step (linked from the Traded tab).
  - **Market price** per item: the `$` button searches TCGplayer through the Worker and
    lets you pick the product, or set a manual price. `↻ Prices` refreshes every matched
    item. Auto-matched items (from the Target import) show an orange `auto ✎` badge until
    you confirm or change them; the "Auto-matched (review)" filter lists them.
  - **Transactions**: a dated ledger of money in and out per book. Purchases are grouped per
    order (each Target order, Cardmarket shipment, Bandai order or lot buyout is one row with its
    total, counterparty, lines and who paid); sales, trades and moves to the personal collection
    come from the records on each product, and so do gifts and box openings. A lot bought from the
    other book ("→ Biz" / "→ PC", or an import from the collection) shows in the receiving book as a
    Transfer row with what was paid, counted in spend and in purchase P&L; the selling book shows
    the matching sale. Future-dated rows (a buyout paid next week) show as
    upcoming and stay out of the spent-to-date totals until the date passes. Every row that moves
    units out carries two measures: **Net profit** (received minus what the units cost) and
    **Txn P&L** (received minus what they were worth at the valuation share when they left; the
    valuation is stored on the record as `valueAt`). A gift is a loss of its cost in one and of
    its value in the other; a move to the collection at the valuation price is a Txn P&L of 0.
    An opening row measures the contents (at the valuation share) against the boxes' cost (Net
    profit) and against the sealed boxes' value (Txn P&L); both are stamped on the record when
    you open. Openings have their own "Opening P&L to date" tile since that gain is still in stock.
    A purchase row measures what was bought at the valuation share against what was paid: Net
    profit at today's prices, Txn P&L at the prices on the purchase date (from the price history;
    the earliest snapshot when none is older). Purchases get a "Purchase P&L to date" tile, also
    kept out of the cash tiles.
    Filter by type and month; the search box applies too. "Day totals" (on by default) puts a
    subtotal row above each day: what happened, units, out, in, net profit, Txn P&L, opening P&L.
    Every row also shows its **fair value**: what the units were worth at the valuation share at
    the time (sales, gifts, trades and transfers when they left; purchases on the day they were
    bought; openings the contents). Click any row to see every card in it with its image, market
    price and value. Moves and lots that carry the same `group` (a bundle sold together, a
    trade of several cards, cards bought for one price) show as one row with the combined numbers;
    a trade move can name the lots it brought in (`receivedIds`) and the row shows their images.
    A lot with category **Expense** (a vendor fee, an entry fee with nothing to show for it) is a
    single ledger row: the amount out, and the same amount as negative net profit and Txn P&L.
    Write it off with a $0 sale so it leaves stock; the ledger ignores that move.
  - **Wishlist** tab: pick a game and a set and the page lists every card in it (from the tcgcsv feed
    via the Worker, cached 20h) with the TCGplayer market price, how many the personal collection holds
    (PC) and how many sit in business or decks. Sort by any column, filter by text, rarity, ownership,
    wishlist status or price, tick cards and add them, or add one at a time. "My wishlist" shows every
    wanted card against what the collection has, with the cost of what is still missing; quantities,
    removal and a price refresh live there. The list is saved with the document as `settings.wishlist`.
    A lot with `share` (0.5 for a card owned half with someone) counts only that share of its
    market value; enter only your share of the cost. The card face shows the percentage.
  - **Overview tab** also opens with "Where the value is" (units, cost, value and gain per
    region, with a row per in-transit destination region and an all-in-transit total; the
    address-level table is further down) and "P&L by day"
    (every action per day with out, in, net profit, Txn P&L and opening P&L).
  - **Stats** per book: value at the set share of market, on-hand cost, unrealized gain, realized
    profit split into sales and trades, and breakdowns by location, game and channel.
- **Share**: the ↗ Share button builds a read-only page of what is on hand (pick any of the three
  books, optionally with what you paid), publishes it through the Worker and copies the link. Links
  are listed in the dialog; publish again to an existing link to refresh it, or remove it.
- **API** (`worker/`): a Cloudflare Worker that stores one JSON document in KV behind a
  bearer token, and proxies TCGplayer search and price lookups (`/market/search`,
  `/market/price`) since browsers cannot call TCGplayer directly. Shared pages: `PUT /share`
  (html body, `?id=` to overwrite, `?title=`), `GET /shares`, `DELETE /share?id=` behind the
  token; `GET /s/<id>` serves a published page to anyone with the link.
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
