# Vending Tracker

Inventory and sales tracker for a Pokemon / Riftbound / One Piece vending business.

- **Page** (`index.html`): one self-contained file on GitHub Pages. Track products
  (game, type, quantity, unit cost, purchase date, payment method, source, location,
  tags, notes), record sales (with channel and fees), filter by location, game,
  tag, channel, or status, and see stats: stock value at cost, revenue, realized
  profit after fees, and breakdowns by location, game, and sale channel.
- **API** (`worker/`): a Cloudflare Worker that stores one JSON document in KV,
  guarded by a bearer token. The page asks for the Worker URL and token once per
  device and keeps them in that browser.

The repo holds no data and no secrets. All data lives in the Worker's KV store.

## Deploy the Worker

```
cd worker
npx wrangler kv namespace create DATA        # put the id in wrangler.jsonc
npx wrangler secret put AUTH_TOKEN           # your secret token
npx wrangler deploy
```

Local dev: `npx wrangler dev` (token comes from `.dev.vars`, not committed).
