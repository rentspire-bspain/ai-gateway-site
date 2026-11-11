// /api/ledger-verify — server-side -2 credential proof for the R-010 ledger relay.
// Reads GITHUB_LEDGER_TOKEN from the ai-gateway production environment, calls
// the GitHub API as that principal, and returns the authenticated login.
// Auth: Bearer must equal the ledger token itself (constant-time compare);
// the token is never echoed. Verifies the relay can post GOs from owned infra.
const crypto = require('crypto');

module.exports = async (req, res) => {
  try {
    const tok = (process.env.GITHUB_LEDGER_TOKEN || '').trim();
    const got = ((req.headers.authorization || '').replace(/^Bearer /i, '')).trim();
    const authed = tok && got && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(tok));
    if (!authed) {
      res.writeHead(401, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
      return;
    }
    if (!tok) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ok: false, error: 'GITHUB_LEDGER_TOKEN not set in ai-gateway environment' }));
      return;
    }
    const r = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': 'Bearer ' + tok,
        'User-Agent': 'ledger-relay-verify',
        'Accept': 'application/vnd.github+json',
      },
    });
    const d = await r.json().catch(() => ({}));
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({
      ok: r.ok,
      login: d.login || null,
      id: d.id || null,
      verified_from: 'ai.spaincos.com serverless runtime (ai-gateway project)',
    }));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: false, error: String(e && e.message || e).slice(0, 160) }));
  }
};
