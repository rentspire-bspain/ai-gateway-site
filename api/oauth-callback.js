// /api/oauth-callback — honest OAuth redirect stub for ai.spaincos.com connectors (34c / 34e).
// Receives ?code=&state= (or ?error=) from Slack, Dropbox, Microsoft/Outlook, Box, Google, or GitHub.
// Stores the returned authorization code client-side for future gateway exchange (via
// /modules/oauth-callback-client.js under strict CSP — zero inline scripts) and renders:
//   "Callback received — paste-free flow pending gateway wiring"
// Also supports JSON callers (Accept: application/json or POST).

const PROVIDER_NAMES = {
  slack: 'Slack',
  dropbox: 'Dropbox',
  outlook: 'Outlook',
  microsoft: 'Outlook',
  box: 'Box',
  google: 'Google',
  gmail: 'Google',
  github: 'GitHub',
};

function escHtml(val) {
  return String(val == null ? '' : val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeProvider(rawProvider, state) {
  let p = String(rawProvider || '').trim().toLowerCase();
  if (!p && typeof state === 'string' && state.includes(':')) {
    p = state.slice(0, state.indexOf(':')).trim().toLowerCase();
  }
  if (p === 'microsoft' || p === 'msft' || p === 'entra') p = 'outlook';
  if (p === 'gmail' || p === 'gmail-gcal') p = 'google';
  p = p.replace(/[^a-z0-9_-]/g, '').slice(0, 32);
  return p || 'connector';
}

function redactCode(code) {
  const s = String(code || '').trim();
  if (!s) return '';
  if (s.length <= 8) return `${s.slice(0, 2)}…`;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c)));
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

function renderHtmlPage({ statusTitle, eyebrow, headline, subtext, provider, providerLabel, code, state, error, errorDescription, isSuccess }) {
  const pillClass = isSuccess ? 'pill ok' : 'pill warn';
  const pillText = isSuccess
    ? 'Callback received — paste-free flow pending gateway wiring'
    : (error ? 'Authorization not completed' : 'Awaiting authorization code');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(statusTitle)} — ai.spaincos.com</title>
<link rel="icon" type="image/png" href="/favicon.png?v=177">
<style>
  :root{--bg:#15171B;--bg-elevated:#1C1E23;--border:#2a2d33;--text:#eceef2;--text-muted:#9aa3ae;--accent:#3D9595;--accent-bg:rgba(61,149,149,.14);--warn:#e6b450;--warn-bg:rgba(230,180,80,.14);--radius:14px;--radius-sm:10px}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.55}
  .card{width:min(520px,100%);background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius);padding:28px}
  .eyebrow{margin:0;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--accent)}
  h1{margin:8px 0 10px;font-size:24px;line-height:1.25;font-weight:650}
  .pill{display:inline-block;padding:6px 10px;border-radius:var(--radius-sm);font-size:13px;font-weight:600;margin:4px 0 14px}
  .pill.ok{background:var(--accent-bg);color:#56ABAB}
  .pill.warn{background:var(--warn-bg);color:var(--warn)}
  .sub{margin:0 0 18px;font-size:14px;color:var(--text-muted)}
  .meta{border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:10px 0;margin:14px 0;display:grid;gap:6px;font-size:13px}
  .row{display:flex;justify-content:space-between;gap:12px}
  .k{color:var(--text-muted)}
  .v{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;text-align:right;overflow-wrap:anywhere}
  .note{font-size:12.5px;color:var(--text-muted);margin:10px 0 18px}
  .actions{display:flex;gap:10px;flex-wrap:wrap}
  .btn{display:inline-flex;align-items:center;justify-content:center;padding:10px 16px;border-radius:var(--radius-sm);font-size:14px;font-weight:600;text-decoration:none;cursor:pointer;border:1px solid transparent;font-family:inherit}
  .btn.primary{background:var(--accent);color:#fff}
  .btn.ghost{background:transparent;border-color:var(--border);color:var(--text)}
</style>
</head>
<body>
<main class="card" id="oauth-callback-root"
  data-provider="${escHtml(provider)}"
  data-code="${escHtml(code)}"
  data-state="${escHtml(state)}"
  data-error="${escHtml(error)}"
  data-error-description="${escHtml(errorDescription)}">
  <p class="eyebrow">${escHtml(eyebrow)}</p>
  <h1>${escHtml(headline)}</h1>
  <div class="${pillClass}" role="status">${escHtml(pillText)}</div>
  <p class="sub">${escHtml(subtext)}</p>
  <div class="meta">
    <div class="row"><span class="k">Provider</span><span class="v">${escHtml(providerLabel)}</span></div>
    <div class="row"><span class="k">Authorization code</span><span class="v">${escHtml(code ? redactCode(code) : (error ? 'None (denied)' : 'Missing'))}</span></div>
    <div class="row"><span class="k">OAuth state</span><span class="v" id="cb-state-status">${escHtml(state ? 'Received' : 'None')}</span></div>
  </div>
  <p class="note" id="cb-storage-note">${escHtml(isSuccess ? 'Saving callback state for ai.spaincos.com…' : 'You can return to Settings > Connectors to try again.')}</p>
  <div class="actions">
    <a class="btn primary" href="/#connector_stub=${encodeURIComponent(provider)}">Return to ai.spaincos.com</a>
    ${isSuccess ? '<button class="btn ghost" type="button" id="cb-close-btn">Close tab</button>' : ''}
  </div>
</main>
<script src="/modules/oauth-callback-client.js"></script>
</body>
</html>`;
}

module.exports = async (req, res) => {
  const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
  const baseHeaders = {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': csp,
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { ...baseHeaders, Allow: 'GET, POST, OPTIONS' });
    res.end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.writeHead(405, { ...baseHeaders, Allow: 'GET, POST, OPTIONS', 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
    return;
  }

  const rawUrl = req.url || '/api/oauth-callback';
  const parsed = new URL(rawUrl, 'https://ai.spaincos.com');
  const body = req.method === 'POST' ? await readJsonBody(req) : {};

  const code = String(parsed.searchParams.get('code') || body.code || '').trim();
  const state = String(parsed.searchParams.get('state') || body.state || '').trim();
  const error = String(parsed.searchParams.get('error') || body.error || '').trim();
  const errorDescription = String(parsed.searchParams.get('error_description') || body.error_description || '').trim();
  const provider = normalizeProvider(parsed.searchParams.get('provider') || body.provider || '', state);
  const providerLabel = PROVIDER_NAMES[provider] || (provider.charAt(0).toUpperCase() + provider.slice(1));

  const accept = String((req.headers && req.headers.accept) || '');
  const wantsJson = req.method === 'POST' || (accept.includes('application/json') && !accept.includes('text/html'));

  if (error) {
    if (wantsJson) {
      res.writeHead(400, { ...baseHeaders, 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        ok: false,
        status: 'error',
        stub: true,
        provider,
        state: state || null,
        error,
        error_description: errorDescription || null,
        message: error === 'access_denied' ? 'Access was not granted.' : `Authorization error: ${error}`,
      }));
      return;
    }
    const html = renderHtmlPage({
      statusTitle: 'OAuth callback error',
      eyebrow: `${providerLabel} OAuth`,
      headline: 'Authorization was not completed',
      subtext: errorDescription || (error === 'access_denied' ? 'Access was canceled or denied at the provider.' : `The provider returned error "${error}".`),
      provider,
      providerLabel,
      code: '',
      state,
      error,
      errorDescription,
      isSuccess: false,
    });
    res.writeHead(200, { ...baseHeaders, 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  if (!code) {
    if (wantsJson) {
      res.writeHead(400, { ...baseHeaders, 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        ok: false,
        status: 'missing_code',
        stub: true,
        provider,
        error: 'missing_code',
        message: 'Missing ?code= query parameter on OAuth callback.',
      }));
      return;
    }
    const html = renderHtmlPage({
      statusTitle: 'OAuth callback',
      eyebrow: 'Connector OAuth',
      headline: 'No authorization code in request',
      subtext: 'Start the connect flow from Settings > Connectors on ai.spaincos.com so the provider redirects back here with ?code=.',
      provider,
      providerLabel,
      code: '',
      state,
      error: '',
      errorDescription: '',
      isSuccess: false,
    });
    res.writeHead(400, { ...baseHeaders, 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  const stubMessage = 'Callback received — paste-free flow pending gateway wiring';

  if (wantsJson) {
    res.writeHead(200, { ...baseHeaders, 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      status: 'callback_received',
      stub: true,
      provider,
      state: state || null,
      code_received: true,
      code_preview: redactCode(code),
      message: stubMessage,
    }));
    return;
  }

  const html = renderHtmlPage({
    statusTitle: `${providerLabel} callback received`,
    eyebrow: `${providerLabel} OAuth`,
    headline: `${providerLabel} callback received`,
    subtext: `Authorization code received from ${providerLabel}. Server-side token exchange will run automatically once gateway OAuth app secrets are wired.`,
    provider,
    providerLabel,
    code,
    state,
    error: '',
    errorDescription: '',
    isSuccess: true,
  });
  res.writeHead(200, { ...baseHeaders, 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
};
