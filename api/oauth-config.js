// /api/oauth-config — returns public OAuth client configuration for Settings > Connectors.
// Never reads or exposes client secrets; returns null per provider until OAuth apps are registered.
function cleanVal(v) {
  if (typeof v !== 'string') return '';
  const s = v.trim();
  if (!s || /^(null|undefined|todo|tbd|your[_-]|replace[_-]|placeholder)/i.test(s)) return '';
  return s;
}

function buildEntry(clientId, extra = {}) {
  const id = cleanVal(clientId);
  if (!id) return null;
  const out = { clientId: id };
  for (const [k, v] of Object.entries(extra)) {
    const cv = cleanVal(v);
    if (cv) out[k] = cv;
  }
  return out;
}

module.exports = async (req, res) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { ...headers, Allow: 'GET, OPTIONS' });
    res.end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { ...headers, Allow: 'GET, OPTIONS' });
    res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
    return;
  }

  const host = cleanVal(req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || 'ai.spaincos.com';
  const proto = /^localhost(?::|$)|^127\.0\.0\.1(?::|$)/.test(host) ? 'http' : 'https';
  const redirectUri = cleanVal(process.env.CONNECTOR_OAUTH_REDIRECT_URI) || `${proto}://${host}/api/oauth-callback`;

  const providers = {
    slack: buildEntry(process.env.SLACK_OAUTH_CLIENT_ID, {
      scope: process.env.SLACK_OAUTH_SCOPE,
      userScope: process.env.SLACK_OAUTH_USER_SCOPE,
    }),
    dropbox: buildEntry(process.env.DROPBOX_OAUTH_CLIENT_ID, {
      scope: process.env.DROPBOX_OAUTH_SCOPE,
    }),
    outlook: buildEntry(process.env.OUTLOOK_OAUTH_CLIENT_ID || process.env.MICROSOFT_OAUTH_CLIENT_ID, {
      scope: process.env.OUTLOOK_OAUTH_SCOPE || process.env.MICROSOFT_OAUTH_SCOPE,
      tenant: process.env.MICROSOFT_OAUTH_TENANT_ID,
    }),
    box: buildEntry(process.env.BOX_OAUTH_CLIENT_ID, {
      scope: process.env.BOX_OAUTH_SCOPE,
    }),
    google: buildEntry(process.env.GOOGLE_OAUTH_CLIENT_ID, {
      scope: process.env.GOOGLE_OAUTH_SCOPE,
    }),
    github: buildEntry(process.env.GITHUB_OAUTH_CLIENT_ID, {
      scope: process.env.GITHUB_OAUTH_SCOPE,
    }),
  };

  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  res.end(JSON.stringify({ ok: true, redirectUri, providers }));
};
