// /api/connectors — transparent proxy to the Supabase connectors edge function.
// Why: Google's OAuth prompt shows the CALLBACK's domain as the app identity.
// Routing the callback through ai.spaincos.com makes Google display
// "You're signing back in to ai.spaincos.com" instead of the raw Supabase ref.
// Forwards method, query string, auth headers and body; relays status, redirects and JSON.
const UPSTREAM = 'https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/connectors';
const HOP = ['connection', 'host', 'content-length', 'transfer-encoding', 'accept-encoding', 'x-forwarded-host', 'x-forwarded-proto', 'x-vercel-id', 'x-vercel-forwarded-for'];

module.exports = async (req, res) => {
  try {
    const qs = (req.url || '').includes('?') ? (req.url || '').slice((req.url || '').indexOf('?')) : '';
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);

    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (HOP.includes(k) || k.startsWith('x-vercel')) continue;
      if (Array.isArray(v)) headers[k] = v.join(', '); else if (typeof v === 'string') headers[k] = v;
    }
    headers['accept-encoding'] = 'identity';

    const r = await fetch(UPSTREAM + qs, {
      method: req.method,
      headers,
      body: (req.method === 'GET' || req.method === 'HEAD') ? undefined : body,
      redirect: 'manual',
    });

    const out = {};
    r.headers.forEach((v, k) => { if (!HOP.includes(k)) out[k] = v; });
    res.writeHead(r.status, out);
    const buf = Buffer.from(await r.arrayBuffer());
    res.end(buf);
  } catch (e) {
    res.writeHead(502, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: 'connector proxy failed', detail: String(e && e.message || e).slice(0, 160) }));
  }
};
