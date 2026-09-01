// vending-tracker-api — stores one JSON document in KV, guarded by a bearer token.
// GET  /data           -> the document {rev, items, savedAt}
// PUT  /data {baseRev, items} -> saves if baseRev matches current rev, else 409 with current doc

const EMPTY = '{"rev":0,"items":[]}';

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
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
    if (url.pathname !== '/data') return json({ error: 'not found' }, 404, cors);

    const auth = req.headers.get('Authorization') || '';
    if (!env.AUTH_TOKEN || auth !== `Bearer ${env.AUTH_TOKEN}`) {
      return json({ error: 'unauthorized' }, 401, cors);
    }

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
      const doc = { rev: cur.rev + 1, items: body.items, savedAt: new Date().toISOString() };
      await env.DATA.put('doc', JSON.stringify(doc));
      return json({ ok: true, rev: doc.rev }, 200, cors);
    }

    return json({ error: 'method not allowed' }, 405, cors);
  },
};
