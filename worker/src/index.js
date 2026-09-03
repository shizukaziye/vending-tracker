// vending-tracker-api — stores one JSON document in KV, guarded by a bearer token.
// GET  /data                      -> the document {rev, items, settings, history, savedAt}
// PUT  /data {baseRev, items, settings, history} -> saves if baseRev matches current rev, else 409 with current doc
// GET  /market/search?q=&line=    -> TCGplayer product candidates with market prices (proxied; browsers can't call it directly)
// GET  /market/price?ids=1,2,3    -> fresh market price per TCGplayer product id

const EMPTY = '{"rev":0,"items":[]}';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const LINES = { pokemon: 'pokemon', riftbound: 'riftbound', 'one piece': 'one piece card game' };

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

async function tcgSearch(q, line) {
  const body = {
    algorithm: 'sales_synonym_v2', from: 0, size: 12,
    filters: { term: line ? { productLineName: [line] } : {}, range: {}, match: {} },
    listingSearch: { context: { cart: {} }, filters: { term: { sellerStatus: 'Live', channelId: 0 }, range: { quantity: { gte: 1 } }, exclude: { channelExclusion: 0 } } },
    context: { cart: {}, shippingCountry: 'US' }, settings: { useFuzzySearch: true, didYouMean: {} }, sort: {},
  };
  const r = await fetch(`https://mp-search-api.tcgplayer.com/v1/search/request?q=${encodeURIComponent(q)}&isList=false&mpfev=3116`, {
    method: 'POST', body: JSON.stringify(body),
    headers: { 'User-Agent': UA, 'Content-Type': 'application/json', Accept: 'application/json', Origin: 'https://www.tcgplayer.com', Referer: 'https://www.tcgplayer.com/' },
  });
  if (!r.ok) throw new Error(`tcgplayer search HTTP ${r.status}`);
  const d = await r.json();
  const kw = { pokemon: 'pokemon', riftbound: 'riftbound', 'one piece card game': 'one piece' }[line] || null;
  const res = (d?.results?.[0]?.results || []).filter((x) => !kw || (x.productLineName || '').toLowerCase().includes(kw));
  return res.map((x) => ({
    productId: Math.round(x.productId), productName: x.productName, setName: x.setName,
    productLine: x.productLineName, marketPrice: x.marketPrice ?? null, lowestPrice: x.lowestPrice ?? null,
    url: x.productUrlName ? `https://www.tcgplayer.com/product/${Math.round(x.productId)}/${x.productUrlName}` : `https://www.tcgplayer.com/product/${Math.round(x.productId)}`,
  }));
}

async function tcgPrice(id) {
  const r = await fetch(`https://mp-search-api.tcgplayer.com/v1/product/${id}/details?mpfev=3116`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  return { productId: id, productName: d.productName, setName: d.setName, marketPrice: d.marketPrice ?? null, lowestPrice: d.lowestPrice ?? null };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin');
    const cors = {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const auth = req.headers.get('Authorization') || '';
    if (!env.AUTH_TOKEN || auth !== `Bearer ${env.AUTH_TOKEN}`) {
      return json({ error: 'unauthorized' }, 401, cors);
    }

    if (url.pathname === '/market/search' && req.method === 'GET') {
      const q = (url.searchParams.get('q') || '').trim();
      if (!q) return json({ error: 'q required' }, 400, cors);
      const line = LINES[(url.searchParams.get('line') || '').toLowerCase()] || null;
      try {
        return json({ results: await tcgSearch(q, line) }, 200, cors);
      } catch (e) {
        return json({ error: String(e) }, 502, cors);
      }
    }

    if (url.pathname === '/market/price' && req.method === 'GET') {
      const ids = (url.searchParams.get('ids') || '').split(',').map((s) => parseInt(s, 10)).filter(Boolean).slice(0, 25);
      const out = {};
      await Promise.all(ids.map(async (id) => {
        try { out[id] = await tcgPrice(id); } catch (e) { out[id] = { productId: id, error: String(e) }; }
      }));
      return json({ prices: out, checkedAt: new Date().toISOString() }, 200, cors);
    }

    if (url.pathname !== '/data') return json({ error: 'not found' }, 404, cors);

    if (req.method === 'GET') {
      const doc = await env.DATA.get('doc');
      return new Response(doc || EMPTY, { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    if (req.method === 'PUT') {
      let body;
      try {
        body = await req.json();
      } catch {
        return json({ error: 'bad json' }, 400, cors);
      }
      if (!Array.isArray(body.items)) return json({ error: 'items must be an array' }, 400, cors);
      const cur = JSON.parse((await env.DATA.get('doc')) || EMPTY);
      if ((body.baseRev ?? -1) !== cur.rev) {
        return json({ error: 'conflict', doc: cur }, 409, cors);
      }
      const doc = { rev: cur.rev + 1, items: body.items, settings: body.settings ?? cur.settings ?? {}, history: body.history ?? cur.history ?? {}, savedAt: new Date().toISOString() };
      await env.DATA.put('doc', JSON.stringify(doc));
      return json({ ok: true, rev: doc.rev }, 200, cors);
    }

    return json({ error: 'method not allowed' }, 405, cors);
  },
};
