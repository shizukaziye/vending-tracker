// vending-tracker-api — stores one JSON document in KV, guarded by a bearer token.
// GET  /data                      -> the document {rev, items, settings, history, savedAt}
// PUT  /data {baseRev, items, settings, history} -> saves if baseRev matches current rev, else 409 with current doc
// GET  /market/search?q=&line=    -> TCGplayer product candidates with market prices (proxied; browsers can't call it directly)
// GET  /market/price?ids=1,2,3    -> fresh market price per TCGplayer product id
// GET  /catalog/riftbound         -> every Riftbound printing (tcgcsv feed), cached in KV for 20h, for type-ahead adds
// GET  /catalog/sets?cat=3         -> the sets of a TCGplayer category (3 Pokémon, 89 Riftbound, 68 One Piece, 1 Magic, 20 Weiss, 85 Pokémon Japan), cached 24h
// GET  /catalog/set?cat=3&group=N  -> every card in one set with its Normal (and Foil) market price, cached 20h; the wishlist browser

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

const CATALOG_TTL = 20 * 3600 * 1000;
async function riftboundCatalog(env) {
  const cached = await env.DATA.get('catalog:riftbound', 'json');
  if (cached && Date.now() - cached.at < CATALOG_TTL) return cached;
  const h = { 'User-Agent': UA, Accept: 'application/json' };
  const groups = (await (await fetch('https://tcgcsv.com/tcgplayer/89/groups', { headers: h })).json()).results;
  const out = [];
  for (const g of groups) {
    const [pr, px] = await Promise.all([
      fetch(`https://tcgcsv.com/tcgplayer/89/${g.groupId}/products`, { headers: h }).then((r) => r.json()).catch(() => ({ results: [] })),
      fetch(`https://tcgcsv.com/tcgplayer/89/${g.groupId}/prices`, { headers: h }).then((r) => r.json()).catch(() => ({ results: [] })),
    ]);
    const price = {};
    for (const p of px.results || []) if (p.marketPrice != null && (price[p.productId] == null || p.marketPrice > price[p.productId])) price[p.productId] = p.marketPrice;
    for (const p of pr.results || []) {
      const ext = Object.fromEntries((p.extendedData || []).map((e) => [e.name, e.value]));
      out.push({ id: p.productId, n: p.name, s: g.name, num: ext.Number || null, r: ext.Rarity || null, p: price[p.productId] ?? null, u: p.url || null });
    }
  }
  const doc = { at: Date.now(), game: 'Riftbound', products: out };
  await env.DATA.put('catalog:riftbound', JSON.stringify(doc));
  return doc;
}

async function tcgcsv(path) {
  const r = await fetch('https://tcgcsv.com/tcgplayer/' + path, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!r.ok) throw new Error('tcgcsv HTTP ' + r.status);
  return (await r.json()).results || [];
}
async function catalogSets(env, cat) {
  const key = 'catalog:sets:' + cat, cached = await env.DATA.get(key, 'json');
  if (cached && Date.now() - cached.at < 24 * 3600 * 1000) return cached;
  const sets = (await tcgcsv(cat + '/groups')).map((g) => ({ id: g.groupId, name: g.name, abbr: g.abbreviation || '', date: (g.publishedOn || '').slice(0, 10) }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
  const doc = { at: Date.now(), cat, sets };
  await env.DATA.put(key, JSON.stringify(doc));
  return doc;
}
async function catalogSet(env, cat, group) {
  const key = 'catalog:set:' + cat + ':' + group, cached = await env.DATA.get(key, 'json');
  if (cached && Date.now() - cached.at < CATALOG_TTL) return cached;
  const [pr, px] = await Promise.all([tcgcsv(cat + '/' + group + '/products'), tcgcsv(cat + '/' + group + '/prices')]);
  const price = {};  // Normal wins over Foil (TCGplayer's product price is the Normal one); a single printing keeps whatever it has
  for (const p of px) { const e = (price[p.productId] ||= {}); e[p.subTypeName || 'Normal'] = p.marketPrice; }
  const products = pr.map((p) => {
    const ext = Object.fromEntries((p.extendedData || []).map((e) => [e.name, e.value])), e = price[p.productId] || {};
    const subs = Object.keys(e), normal = e.Normal ?? e.Holofoil ?? e[subs[0]] ?? null;
    return { id: p.productId, n: p.name, num: ext.Number || '', r: ext.Rarity || '', p: normal, pf: e.Foil ?? e['Reverse Holofoil'] ?? null, subs, url: p.url || null };
  }).filter((p) => !/^Code Card/i.test(p.n));
  const doc = { at: Date.now(), cat, group, products };
  await env.DATA.put(key, JSON.stringify(doc));
  return doc;
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
      'Access-Control-Allow-Methods': 'GET,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    // shared pages are public: GET /s/<id> serves a snapshot the owner published with PUT /share
    if (url.pathname.startsWith('/s/') && req.method === 'GET') {
      const id = url.pathname.slice(3).replace(/[^a-z0-9]/gi, '');
      const html = id && (await env.DATA.get('share:' + id));
      if (!html) return new Response('This shared page does not exist or was removed.', { status: 404, headers: { 'Content-Type': 'text/plain' } });
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=120', 'X-Robots-Tag': 'noindex' } });
    }

    const auth = req.headers.get('Authorization') || '';
    if (!env.AUTH_TOKEN || auth !== `Bearer ${env.AUTH_TOKEN}`) {
      return json({ error: 'unauthorized' }, 401, cors);
    }

    // share: PUT /share (body = html, ?id= to overwrite an existing link, ?title= for the index) -> {id, url}; GET /shares lists them; DELETE /share?id= removes one
    if (url.pathname === '/share' && req.method === 'PUT') {
      const html = await req.text();
      if (!html || html.length > 20_000_000) return json({ error: 'html required (max 20MB)' }, 400, cors);
      const index = (await env.DATA.get('share:index', 'json')) || [];
      let id = (url.searchParams.get('id') || '').replace(/[^a-z0-9]/gi, '');
      if (!id || !index.some((s) => s.id === id)) id = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
      await env.DATA.put('share:' + id, html);
      const entry = { id, title: (url.searchParams.get('title') || 'Shared page').slice(0, 80), at: new Date().toISOString(), bytes: html.length };
      const next = [entry, ...index.filter((s) => s.id !== id)].slice(0, 50);
      await env.DATA.put('share:index', JSON.stringify(next));
      return json({ ok: true, id, url: `${url.origin}/s/${id}`, shares: next }, 200, cors);
    }
    if (url.pathname === '/shares' && req.method === 'GET') return json({ shares: (await env.DATA.get('share:index', 'json')) || [] }, 200, cors);
    if (url.pathname === '/share' && req.method === 'DELETE') {
      const id = (url.searchParams.get('id') || '').replace(/[^a-z0-9]/gi, '');
      await env.DATA.delete('share:' + id);
      const next = ((await env.DATA.get('share:index', 'json')) || []).filter((s) => s.id !== id);
      await env.DATA.put('share:index', JSON.stringify(next));
      return json({ ok: true, shares: next }, 200, cors);
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

    if (url.pathname === '/catalog/sets' && req.method === 'GET') {
      const cat = parseInt(url.searchParams.get('cat') || '', 10); if (!cat) return json({ error: 'cat required' }, 400, cors);
      try { return new Response(JSON.stringify(await catalogSets(env, cat)), { headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=3600' } }); } catch (e) { return json({ error: String(e) }, 502, cors); }
    }
    if (url.pathname === '/catalog/set' && req.method === 'GET') {
      const cat = parseInt(url.searchParams.get('cat') || '', 10), group = parseInt(url.searchParams.get('group') || '', 10);
      if (!cat || !group) return json({ error: 'cat and group required' }, 400, cors);
      try { return new Response(JSON.stringify(await catalogSet(env, cat, group)), { headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=3600' } }); } catch (e) { return json({ error: String(e) }, 502, cors); }
    }
    if (url.pathname === '/catalog/riftbound' && req.method === 'GET') {
      try {
        const c = await riftboundCatalog(env);
        return new Response(JSON.stringify(c), { headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=3600' } });
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
