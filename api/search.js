// /api/search: raw ranked findings, never synthesized chat or personal context.
// Mirrors gateway-chat v190 tool-loop.ts::toolWebSearch's Sonar wire contract
// and free-source routing. The live helper is private, not an HTTP endpoint.
const { ApiError, endpoint, requestJson, proxyUpstream, upstreamJson } = require('./_lib/public-api');

const LIMITS = { quick: 3, search: 6, deep: 12 };
const UA = { 'User-Agent': 'ai-spaincos-gateway/1.0 (public-api web_search)' };
const clean = text => String(text || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
const safeUrl = value => {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; }
};

function rankResults(findings, limit) {
  const seen = new Set();
  return findings.flatMap(f => {
    const url = safeUrl(f?.url);
    if (!url || seen.has(url)) return [];
    seen.add(url);
    return [{ title: String(f.title || 'Web source').slice(0, 500), url, excerpt: String(f.excerpt || f.extract || '').slice(0, 2000) }];
  }).slice(0, limit).map((f, index) => ({ rank: index + 1, ...f }));
}

async function freeSearch(query, limit) {
  const findings = [];
  let successes = 0;
  const get = async (url, headers) => {
    const r = await requestJson(url, { headers }, 6000);
    if (!r.ok) throw new Error('source failed');
    successes++;
    return r;
  };
  const news = async q => {
    try {
      const r = await get(`https://news.google.com/rss/search?q=${encodeURIComponent(q.slice(0, 200))}&hl=en-US&gl=US&ceid=US:en`);
      for (const m of [...(await r.text()).matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, limit)) {
        const field = tag => clean(m[1].match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1]);
        if (field('title')) findings.push({ title: field('title'), url: field('link'), excerpt: `${field('pubDate')} - live headline from Google News.` });
      }
    } catch { /* same best-effort fallback as the tool loop */ }
  };
  const coins = { bitcoin: 'bitcoin', btc: 'bitcoin', ethereum: 'ethereum', eth: 'ethereum', solana: 'solana', dogecoin: 'dogecoin', xrp: 'ripple', ripple: 'ripple', cardano: 'cardano', litecoin: 'litecoin' };
  const coin = query.match(/\b(bitcoin|btc|ethereum|eth|solana|dogecoin|xrp|ripple|cardano|litecoin)\b/i);
  if (coin && /price|worth|cost|trading|quote/i.test(query)) {
    const id = coins[coin[1].toLowerCase()];
    try {
      const d = await (await get(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`)).json();
      if (d[id]?.usd) findings.push({ title: 'CoinGecko live price', url: `https://www.coingecko.com/en/coins/${id}`, excerpt: `Current price: ${d[id].usd} USD, fetched ${new Date().toISOString()}. 24h change: ${d[id].usd_24h_change ?? 'n/a'}%.` });
    } catch { /* continue to news */ }
    await news(`${coin[1]} price`);
  } else if (/latest|news|headline|today|this (week|month|year)|current events|breaking|score|won|released|announced|20(2[4-9]|3\d)/i.test(query)) {
    await news(query);
  } else {
    // Preserve the tool-loop's Wikipedia rank order, regardless of fetch latency.
    const wiki = (async () => {
      try {
        const d = await (await get(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=${Math.min(limit, 10)}&format=json`, UA)).json();
        return (await Promise.all((d?.query?.search || []).slice(0, limit).map(async ({ title }) => {
          try {
            const s = await (await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, UA)).json();
            return s?.extract ? { title, url: s?.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`, excerpt: String(s.extract).slice(0, 700) } : null;
          } catch { return null; }
        }))).filter(Boolean);
      } catch { return []; }
    })();
    const ddg = (async () => {
      try {
        const d = await (await get(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`)).json();
        return d?.AbstractText ? [{ title: d.Heading || 'DuckDuckGo', url: d.AbstractURL, excerpt: String(d.AbstractText).slice(0, 500) }] : [];
      } catch { return []; }
    })();
    const [w, d] = await Promise.all([wiki, ddg]);
    findings.push(...w, ...d);
    if (!findings.length) await news(query);
  }
  if (!findings.length && !successes) throw new ApiError(502, 'search_unavailable', 'Search providers are temporarily unavailable.');
  return findings;
}

module.exports = endpoint({
  endpoint: '/api/search',
  method: 'POST',
  request: { query: 'A focused search query (1-300 characters)', mode: 'quick | search (default) | deep' },
  example: { query: 'renewable energy storage', mode: 'search' },
  response: { query: '...', mode: 'search', results: [{ rank: 1, title: '...', url: 'https://example.com/', excerpt: '...' }], provider: 'gateway-proxy | sonar | free-sources' },
  ranking: 'Provider relevance order, deduplicated by URL. Modes cap results at 3/6/12; deep is not a multi-step research agent.',
}, async (body, principal) => {
  if (typeof body.query !== 'string' || !body.query.trim() || body.query.length > 300) throw new ApiError(400, 'invalid_query', 'query must be a non-empty string of at most 300 characters.');
  const query = body.query.trim();
  const mode = body.mode === undefined ? 'search' : body.mode;
  if (typeof mode !== 'string' || !Object.hasOwn(LIMITS, mode)) throw new ApiError(400, 'invalid_mode', 'mode must be quick, search, or deep.');
  const limit = LIMITS[mode];
  let findings, provider;
  // Preferred wiring once a standalone search function is available. Do NOT set
  // this to gateway-chat: its chat contract is not a ranked-results API.
  if (process.env.PUBLIC_SEARCH_UPSTREAM_URL) {
    const data = await upstreamJson(await proxyUpstream(process.env.PUBLIC_SEARCH_UPSTREAM_URL, principal.token, { query, mode }));
    if (!Array.isArray(data?.results)) throw new ApiError(502, 'invalid_upstream_response', 'Search upstream must return a results array.');
    findings = data.results;
    provider = 'gateway-proxy';
  } else {
    const key = process.env.PERPLEXITY_API_KEY;
    if (key) {
      try {
        const r = await requestJson('https://api.perplexity.ai/chat/completions', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model: 'sonar', messages: [{ role: 'user', content: query }], max_tokens: 600 }),
        }, 9000);
        if (r.ok) {
          const d = await r.json();
          findings = Array.isArray(d.search_results) ? d.search_results.map(f => ({ title: f.title, url: f.url, excerpt: f.snippet || '' })) : [];
          for (const url of Array.isArray(d.citations) ? d.citations : []) findings.push({ title: 'Web source', url, excerpt: '' });
          if (!rankResults(findings, limit).length) findings = undefined;
          else provider = 'sonar';
        }
      } catch { /* fall through to gateway's free-source path */ }
    }
    if (!findings) { findings = await freeSearch(query, limit); provider = 'free-sources'; }
  }
  const results = rankResults(findings, limit);
  return { object: 'search.results', query, mode, results, provider, ...(results.length ? {} : { note: 'No results found.' }) };
});
