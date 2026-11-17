// Run: node --test tests/public-api.test.js (no credentials or network required).
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { createHash } = require('node:crypto');
const search = require('../api/search');
const embeddings = require('../api/embeddings');
const { proxyUpstream } = require('../api/_lib/public-api');
const ENV_KEYS = ['PUBLIC_API_AUTH_ANON_KEY', 'PUBLIC_API_AUTH_SERVICE_ROLE_KEY', 'PUBLIC_SEARCH_UPSTREAM_URL', 'PUBLIC_EMBEDDINGS_UPSTREAM_URL', 'PERPLEXITY_API_KEY'];
const originalEnv = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]));
const originalFetch = global.fetch;
const user = { id: 'test-user', email: 'bspain@spaincos.com', email_confirmed_at: '2026-01-01' };
const apiKey = 'sk-spaincos-test_key_only';
let calls, route;
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
beforeEach(() => {
  ENV_KEYS.forEach(k => delete process.env[k]);
  process.env.PUBLIC_API_AUTH_ANON_KEY = 'test-anon';
  process.env.PUBLIC_API_AUTH_SERVICE_ROLE_KEY = 'test-service';
  calls = [];
  route = async url => {
    if (url.endsWith('/auth/v1/user')) return reply(user);
    if (url.includes('/rest/v1/api_keys?')) return reply([{ id: 'key-id', user_id: user.id, revoked_at: null }]);
    if (url.includes('/auth/v1/admin/users/')) return reply(user);
    throw new Error(`Unexpected request: ${url}`);
  };
  global.fetch = async (url, init) => { calls.push({ url: String(url), init }); return route(String(url), init); };
});
afterEach(() => {
  global.fetch = originalFetch;
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key];
  }
});
async function invoke(handler, { method = 'POST', body = { query: 'test' }, token = 'user-jwt', headers = {}, stream = false } = {}) {
  const req = Readable.from(stream ? [typeof body === 'string' ? body : JSON.stringify(body)] : []);
  req.method = method;
  req.headers = { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers };
  if (!stream) req.body = body;
  let status, responseHeaders, result;
  await handler(req, {
    writeHead(s, h) { status = s; responseHeaders = h; },
    end(data) { result = data === undefined ? undefined : JSON.parse(data); },
  });
  return { status, headers: responseHeaders, body: result };
}
for (const [name, handler] of [['search', search], ['embeddings', embeddings]]) {
  test(`${name}: public GET docs and OPTIONS never authenticate`, async () => {
    const docs = await invoke(handler, { method: 'GET', token: null });
    assert.equal(docs.status, 200);
    assert.ok(docs.body.api_keys.header.includes('Bearer'));
    const options = await invoke(handler, { method: 'OPTIONS', token: null });
    assert.equal(options.status, 204);
    assert.equal(options.headers['Access-Control-Allow-Origin'], '*');
    assert.equal(calls.length, 0);
  });
  test(`${name}: invalid method and missing auth are JSON errors`, async () => {
    const method = await invoke(handler, { method: 'DELETE' });
    assert.equal(method.status, 405);
    assert.equal(method.headers.Allow, 'GET, POST, OPTIONS');
    const auth = await invoke(handler, { token: null });
    assert.equal(auth.status, 401);
    assert.equal(auth.body.error.code, 'invalid_api_key');
    assert.equal(auth.headers['Cache-Control'], 'no-store');
    assert.equal(calls.length, 0);
  });
}
test('JWTs are remotely validated and confirmed/allowlisted, not decoded locally', async () => {
  for (const deniedUser of [{ ...user, email: 'other@example.com' }, { ...user, email_confirmed_at: null }]) {
    route = async () => reply(deniedUser);
    assert.equal((await invoke(search)).status, 403);
  }
  route = async () => reply({}, 401);
  assert.equal((await invoke(search)).status, 401);
  route = async () => reply({}, 500);
  assert.equal((await invoke(search)).status, 503);
  delete process.env.PUBLIC_API_AUTH_ANON_KEY;
  assert.equal((await invoke(search)).status, 503);
});
test('opaque keys are SHA256-hashed for lookup and never forwarded to the provider', async () => {
  process.env.PERPLEXITY_API_KEY = 'test-provider';
  const base = route;
  route = async (url, init) => url.includes('api.perplexity.ai') ? reply({ citations: ['https://example.com/a'] }) : base(url, init);
  const r = await invoke(search, { token: apiKey });
  assert.equal(r.status, 200);
  const hash = createHash('sha256').update(apiKey).digest('hex');
  assert.ok(calls[0].url.includes(`key_hash=eq.${hash}`));
  assert.ok(calls.every(c => !c.url.includes(apiKey)));
  assert.equal(calls[2].init.headers.Authorization, 'Bearer test-provider');
  assert.ok(!JSON.stringify(r.body).includes(apiKey));
});
test('invalid, revoked, unavailable, or non-allowlisted keys fail closed', async () => {
  assert.equal((await invoke(search, { token: 'sk-spaincos-x' })).status, 401);
  route = async () => reply([{ id: 'key-id', user_id: user.id, revoked_at: '2026-01-01' }]);
  assert.equal((await invoke(search, { token: apiKey })).status, 401);
  route = async () => reply([]);
  assert.equal((await invoke(search, { token: apiKey })).status, 401);
  route = async () => { throw new Error('secret-like provider detail'); };
  const outage = await invoke(search, { token: apiKey });
  assert.equal(outage.status, 503);
  assert.ok(!JSON.stringify(outage).includes('secret-like'));
  delete process.env.PUBLIC_API_AUTH_SERVICE_ROLE_KEY;
  assert.equal((await invoke(search, { token: apiKey })).status, 503);
});
test('JSON parsing, content type, object shape and byte limits', async () => {
  for (const body of ['{bad', 'null', '[]', '123']) assert.equal((await invoke(search, { body, stream: true })).status, 400);
  assert.equal((await invoke(search, { headers: { 'content-type': 'text/plain' } })).status, 415);
  assert.equal((await invoke(search, { body: { query: 'x'.repeat(131073) } })).status, 413);
  assert.equal((await invoke(search, { body: 'x'.repeat(131073), stream: true })).status, 413);
  assert.equal((await invoke(search, { headers: { 'content-length': '131073' } })).status, 413);
});
test('search rejects invalid query and mode before provider work', async () => {
  for (const body of [{}, { query: '' }, { query: '  ' }, { query: [] }, { query: 'x'.repeat(301) }, { query: 'ok', mode: 'toString' }, { query: 'ok', mode: null }, { query: 'ok', mode: { toString: 'quick' } }]) {
    assert.equal((await invoke(search, { body })).status, 400);
  }
  assert.ok(calls.every(c => c.url.includes('/auth/v1/user')));
});
test('Sonar uses exact gateway wire contract; ranks/deduplicates/sanitizes findings', async () => {
  process.env.PERPLEXITY_API_KEY = 'test-provider';
  const base = route;
  route = async (url, init) => {
    if (!url.includes('api.perplexity.ai')) return base(url, init);
    assert.deepEqual(JSON.parse(init.body), { model: 'sonar', messages: [{ role: 'user', content: 'test' }], max_tokens: 600 });
    return reply({
      search_results: [{ title: 'First', url: 'https://example.com/a', snippet: 'A' }, { title: 'Unsafe', url: 'javascript:alert(1)' }],
      citations: ['https://example.com/a', 'https://example.com/b', 'https://example.com/c', 'https://example.com/d'],
      choices: [{ message: { content: 'Must never be exposed as ranked evidence.' } }],
    });
  };
  for (const [mode, count] of [['quick', 3], ['search', 4], ['deep', 4]]) {
    const r = await invoke(search, { body: { query: 'test', mode } });
    assert.equal(r.status, 200);
    assert.equal(r.body.results.length, count);
    assert.equal(r.body.results[0].rank, 1);
    assert.equal(r.body.results[0].title, 'First');
    assert.equal(r.body.provider, 'sonar');
    assert.ok(!JSON.stringify(r.body).includes('Must never'));
  }
});
test('free-source fallback keeps Wikipedia order, then DuckDuckGo', async () => {
  const base = route;
  route = async (url, init) => {
    if (url.includes('/auth/')) return base(url, init);
    if (url.includes('list=search')) return reply({ query: { search: [{ title: 'One' }, { title: 'Two' }] } });
    if (url.includes('/page/summary/')) return reply({ extract: 'Summary', content_urls: { desktop: { page: `https://en.wikipedia.org/wiki/${url.split('/').pop()}` } } });
    if (url.includes('duckduckgo')) return reply({ AbstractText: 'Abstract', Heading: 'Third', AbstractURL: 'https://example.com/third' });
    throw new Error('Unexpected request');
  };
  const r = await invoke(search, { stream: true });
  assert.equal(r.status, 200);
  assert.equal(r.body.provider, 'free-sources');
  assert.deepEqual(r.body.results.map(x => x.title), ['One', 'Two', 'Third']);
});
test('Sonar failure falls back to news without leaking provider errors', async () => {
  process.env.PERPLEXITY_API_KEY = 'test-provider';
  const base = route;
  route = async (url, init) => {
    if (url.includes('/auth/')) return base(url, init);
    if (url.includes('perplexity')) return reply({ error: 'provider-secret-detail' }, 401);
    if (url.includes('news.google')) return new Response('<rss><item><title><![CDATA[Headline]]></title><link>https://example.com/news</link><pubDate>Today</pubDate></item></rss>');
    throw new Error('Unexpected request');
  };
  const r = await invoke(search, { body: { query: 'latest news' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.results[0].title, 'Headline');
  assert.ok(!JSON.stringify(r.body).includes('provider-secret'));
});
test('all source failures return 502, not a fabricated empty success', async () => {
  const base = route;
  route = async (url, init) => url.includes('/auth/') ? base(url, init) : reply({}, 503);
  assert.equal((await invoke(search)).status, 502);
});
test('proxy wiring only forwards normalized body and Bearer to fixed Supabase host', async () => {
  process.env.PUBLIC_SEARCH_UPSTREAM_URL = 'https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/public-search';
  const base = route;
  route = async (url, init) => {
    if (!url.includes('/functions/')) return base(url, init);
    assert.deepEqual(JSON.parse(init.body), { query: 'test', mode: 'search' });
    assert.equal(init.headers.Authorization, 'Bearer user-jwt');
    assert.equal(init.redirect, 'error');
    return reply({ results: [{ title: 'A', url: 'https://example.com/' }], private_metadata: 'not relayed' });
  };
  const r = await invoke(search, { body: { query: 'test', admin: true } });
  assert.equal(r.status, 200);
  assert.equal(r.body.provider, 'gateway-proxy');
  assert.ok(!JSON.stringify(r.body).includes('not relayed'));
  for (const url of ['http://127.0.0.1/', 'https://evil.example/', 'https://bnxermyboeigvwonfrzx.supabase.co/rest/v1/api_keys', 'not-a-url']) {
    await assert.rejects(proxyUpstream(url, 'jwt', {}), e => e.status === 503);
  }
});
test('proxy failures, non-JSON and malformed output are sanitized', async () => {
  process.env.PUBLIC_SEARCH_UPSTREAM_URL = 'https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/public-search';
  const base = route;
  for (const [response, status] of [[reply({ secret: 'hidden' }, 429), 429], [new Response('not json'), 502], [reply({}), 502], [reply({ error: 'hidden' }, 500), 502]]) {
    route = async (url, init) => url.includes('/functions/') ? response : base(url, init);
    const r = await invoke(search);
    assert.equal(r.status, status);
    assert.ok(!JSON.stringify(r.body).includes('hidden'));
  }
});
test('embeddings validates input/model and deliberately gates missing upstream', async () => {
  for (const body of [{}, { input: '' }, { input: [] }, { input: [null] }, { input: Array(33).fill('x') }, { input: 'x'.repeat(32001) }, { input: 'x', model: 'arbitrary-model' }]) {
    assert.equal((await invoke(embeddings, { body })).status, 400);
  }
  const r = await invoke(embeddings, { body: { input: 'hello' } });
  assert.equal(r.status, 503);
  assert.equal(r.body.error.code, 'embeddings_not_configured');
});
test('embeddings relays validated vectors and safe usage, no internal metadata', async () => {
  process.env.PUBLIC_EMBEDDINGS_UPSTREAM_URL = 'https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/public-embeddings';
  const base = route;
  route = async (url, init) => {
    if (!url.includes('/functions/')) return base(url, init);
    assert.deepEqual(JSON.parse(init.body), { input: ['hello', 'world'], model: 'text-embedding-3-small' });
    return reply({ model: 'text-embedding-3-small', data: [0, 1].map(index => ({ index, embedding: Array(1536).fill(0.1), secret: 'hidden' })), usage: { prompt_tokens: 2, total_tokens: 2, internal: 'hidden' }, secret: 'hidden' });
  };
  const r = await invoke(embeddings, { body: { input: ['hello', 'world'] } });
  assert.equal(r.status, 200);
  assert.equal(r.body.data[1].embedding.length, 1536);
  assert.equal(r.body.usage.total_tokens, 2);
  assert.ok(!JSON.stringify(r.body).includes('hidden'));
});
test('embeddings rejects incorrect dimensions, indices, values, model and count', async () => {
  process.env.PUBLIC_EMBEDDINGS_UPSTREAM_URL = 'https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/public-embeddings';
  const base = route;
  const valid = { model: 'text-embedding-3-small', data: [{ index: 0, embedding: Array(1536).fill(0.1) }] };
  for (const d of [{ ...valid, model: 'wrong' }, { ...valid, data: [] }, { ...valid, data: [{ index: 1, embedding: Array(1536).fill(0) }] }, { ...valid, data: [{ index: 0, embedding: [0] }] }, { ...valid, data: [{ index: 0, embedding: Array(1536).fill('0') }] }]) {
    route = async (url, init) => url.includes('/functions/') ? reply(d) : base(url, init);
    assert.equal((await invoke(embeddings, { body: { input: 'hello' } })).status, 502);
  }
});
