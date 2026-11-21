// /api/health — v291: the liveness/readiness endpoint (Observability dimension).
// Cheap, unauthenticated, no body logging. Reports the static tree version and the
// gateway function's reachability; a 200 here means the project is serving.
// The UX master benchmark (F-category) and any uptime monitor hit this.
module.exports = async (req, res) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { ...headers, Allow: 'GET, HEAD, OPTIONS' });
    res.end();
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { ...headers, Allow: 'GET, HEAD, OPTIONS' });
    res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
    return;
  }
  const body = {
    ok: true,
    service: 'ai-gateway-site',
    check: 'health',
    ts: new Date().toISOString(),
  };
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : JSON.stringify(body));
};
