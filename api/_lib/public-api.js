// Shared server-only plumbing for the Phase 1 API. Never log credentials/bodies.
const { createHash } = require('node:crypto');
const AUTH_URL = 'https://bnxermyboeigvwonfrzx.supabase.co';
const ALLOWED_EMAILS = ['bspain@spaincos.com', 'eval-bot@spaincos.com'];
const MAX_BODY_BYTES = 128 * 1024;

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'X-Content-Type-Options': 'nosniff',
    ...(status === 401 ? { 'WWW-Authenticate': 'Bearer' } : {}),
    ...(status === 405 ? { Allow: 'GET, POST, OPTIONS' } : {}),
  });
  res.end(status === 204 ? undefined : JSON.stringify(body));
}

async function requestJson(url, init = {}, timeout = 10000) {
  return fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(timeout) });
}

async function authenticate(req) {
  const header = req.headers.authorization;
  const match = typeof header === 'string' && header.match(/^Bearer ([^\s]+)$/i);
  if (!match || match[1].length > 4096) throw new ApiError(401, 'invalid_api_key', 'A Bearer API key or user JWT is required.');
  const token = match[1];
  // Fixed auth project: do not accidentally verify users against the model project.
  let user, keyId;
  if (token.startsWith('sk-spaincos-')) {
    if (!/^sk-spaincos-[A-Za-z0-9_-]{8,200}$/.test(token)) throw new ApiError(401, 'invalid_api_key', 'Invalid or revoked API key.');
    const svc = process.env.PUBLIC_API_AUTH_SERVICE_ROLE_KEY;
    if (!svc) throw new ApiError(503, 'auth_unavailable', 'API-key verification is not configured.');
    const headers = { apikey: svc, Authorization: `Bearer ${svc}` };
    try {
      const hash = createHash('sha256').update(token).digest('hex');
      const lookup = await requestJson(`${AUTH_URL}/rest/v1/api_keys?select=id,user_id,revoked_at&key_hash=eq.${hash}&limit=1`, { headers }, 6000);
      if (!lookup.ok) throw new Error('lookup failed');
      const row = (await lookup.json())?.[0];
      if (!row || row.revoked_at || !row.user_id) throw new ApiError(401, 'invalid_api_key', 'Invalid or revoked API key.');
      const response = await requestJson(`${AUTH_URL}/auth/v1/admin/users/${encodeURIComponent(row.user_id)}`, { headers }, 6000);
      if (!response.ok) throw new Error('user lookup failed');
      user = await response.json();
      keyId = row.id;
      // Deliberately no last_used_at write: usage ledger integration is gated below.
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(503, 'auth_unavailable', 'API-key verification is temporarily unavailable.');
    }
  } else {
    const anon = process.env.PUBLIC_API_AUTH_ANON_KEY;
    if (!anon) throw new ApiError(503, 'auth_unavailable', 'JWT verification is not configured.');
    try {
      const response = await requestJson(`${AUTH_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: anon } });
      if (response.status === 401 || response.status === 403) throw new ApiError(401, 'invalid_api_key', 'Invalid or expired user JWT.');
      if (!response.ok) throw new Error('auth failed');
      user = await response.json();
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(503, 'auth_unavailable', 'JWT verification is temporarily unavailable.');
    }
  }
  if (!user?.id) throw new ApiError(401, 'invalid_api_key', 'Invalid credentials.');
  const confirmed = keyId || user.email_confirmed_at || user.confirmed_at;
  if (!confirmed || !ALLOWED_EMAILS.includes(String(user.email || '').toLowerCase())) {
    throw new ApiError(403, 'account_not_allowed', 'This site is private.');
  }
  return { userId: user.id, keyId, token };
}

async function readBody(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
    throw new ApiError(415, 'unsupported_media_type', 'Content-Type must be application/json.');
  }
  if (Number(req.headers['content-length']) > MAX_BODY_BYTES) throw new ApiError(413, 'payload_too_large', 'Request exceeds 128 KiB.');
  let raw;
  // Vercel may pre-parse the body; tests also cover streamed Node requests.
  if (req.body !== undefined) {
    raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  } else {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      const buf = Buffer.from(chunk);
      size += buf.length;
      if (size > MAX_BODY_BYTES) throw new ApiError(413, 'payload_too_large', 'Request exceeds 128 KiB.');
      chunks.push(buf);
    }
    raw = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) throw new ApiError(413, 'payload_too_large', 'Request exceeds 128 KiB.');
  let body;
  try { body = JSON.parse(raw); } catch { throw new ApiError(400, 'invalid_json', 'Request must contain valid JSON.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'invalid_request', 'Request must be a JSON object.');
  return body;
}

// Explicit owner/infra wiring point. No URL or credential is accepted from callers.
// Only the auth project's function host is permitted; never forward JWTs to arbitrary hosts.
async function proxyUpstream(url, token, body) {
  let target;
  try { target = new URL(url); } catch { throw new ApiError(503, 'upstream_not_configured', 'Upstream URL is invalid.'); }
  if (target.origin !== AUTH_URL || !target.pathname.startsWith('/functions/v1/') || target.username || target.password || target.search || target.hash) {
    throw new ApiError(503, 'upstream_not_configured', 'Upstream must be an auth-project Supabase function URL.');
  }
  return requestJson(target.href, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, 25000);
}

async function upstreamJson(response) {
  // Do not relay provider error bodies, headers, stack traces, or secrets.
  if (!response.ok) {
    const status = [402, 429, 503].includes(response.status) ? response.status : 502;
    throw new ApiError(status, status === 429 ? 'rate_limited' : 'upstream_error', 'Upstream request failed.');
  }
  try { return await response.json(); } catch { throw new ApiError(502, 'invalid_upstream_response', 'Upstream returned invalid JSON.'); }
}

function endpoint(docs, execute) {
  return async (req, res) => {
    try {
      if (req.method === 'OPTIONS') return json(res, 204);
      if (req.method === 'GET') return json(res, 200, {
        ...docs,
        api_keys: {
          header: 'Authorization: Bearer <sk-spaincos-... or signed-in user JWT>',
          issuance: 'Create/revoke keys in Settings > API Keys; keys are shown only at creation.',
          verification: 'SHA-256 hash lookup against the existing api_keys table, or auth-project JWT validation. Owner/QA allowlist still applies.',
          query_string_keys: false,
        },
        phase: 'Phase 1: no billing or distributed rate-limit integration; private allowlist remains enforced.',
      });
      if (req.method !== 'POST') throw new ApiError(405, 'method_not_allowed', 'Use GET, POST, or OPTIONS.');
      const principal = await authenticate(req);
      const body = await readBody(req);
      // RATE-LIMIT HOOK (owner/infra gated): await enforceDistributedLimit(principal.keyId || principal.userId, docs.endpoint);
      // USAGE LEDGER HOOK: gateway-chat v190 reserves via credits_reserve before
      // work and settles via credits_settle after completion (including failure/refund).
      // Do not enable without approved per-endpoint costs and idempotency semantics:
      // const hold = await reserveUsage(principal, requestId, body);
      const result = await execute(body, principal);
      // await settleUsage(hold, actualUsage); // also settle/refund in the failure path
      return json(res, 200, result);
    } catch (e) {
      const error = e instanceof ApiError ? e : new ApiError(e?.name === 'TimeoutError' || e?.name === 'AbortError' ? 504 : 502, 'upstream_unavailable', 'Upstream request could not be completed.');
      return json(res, error.status, { error: { message: error.message, type: error.status < 500 ? 'invalid_request_error' : 'api_error', code: error.code } });
    }
  };
}

module.exports = { ApiError, endpoint, requestJson, proxyUpstream, upstreamJson };
