# Public API Phase 1

This PR adds Vercel Node serverless handlers, matching the existing `api/connectors.js` runtime rather than Deno or Vercel Edge Runtime. It does not deploy any function, change pricing, write a usage ledger, or open access beyond the existing owner/QA allowlist.

## Authentication

Both POST routes accept `Authorization: Bearer <credential>`. Credentials are never accepted in query strings, logged, or returned.

- **API keys:** Existing `sk-spaincos-...` keys are SHA-256 hashed and resolved against `api_keys.key_hash` in the auth project `bnxermyboeigvwonfrzx`. Revoked/unknown keys return 401. The associated user is fetched through the admin API and checked against the same owner/QA email allowlist as live gateway-chat v190.
- **User JWTs:** The auth project's `/auth/v1/user` validates the token remotely. A confirmed email and the same allowlist are required; decoding a JWT locally is not trusted.
- **Configuration:** Set `PUBLIC_API_AUTH_SERVICE_ROLE_KEY` to the auth project's service role in the server-only Vercel environment for opaque-key lookup. Set `PUBLIC_API_AUTH_ANON_KEY` to that project's anon key for JWT verification. Missing/unavailable verification returns 503, never bypasses authentication. These deliberately prefixed variables avoid confusing the separate model project's credentials.
- **Issuance/revocation:** Use the existing Settings > API Keys flow. This change adds no new plaintext keys, key table, migration, or gateway_config-based master credential.

Auth was checked against the deployed auth-project gateway-chat v190. The repository's `supabase/functions/gateway-chat` copy and the separate model-project gateway-chat v28 are stale for this purpose and were not changed.

## Search

```sh
curl https://ai.spaincos.com/api/search \
  -H "Authorization: Bearer ${SPAINCOS_API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{"query":"renewable energy storage","mode":"search"}'
```

`query` is a non-empty string up to 300 characters. `mode` defaults to `search`; `quick`, `search`, and `deep` cap the response at 3, 6, and 12 results respectively. Modes change breadth, not a multi-step research budget, and are not guarantees of result count.

```json
{
  "object": "search.results",
  "query": "renewable energy storage",
  "mode": "search",
  "results": [
    {"rank": 1, "title": "Example", "url": "https://example.com/", "excerpt": "..."}
  ],
  "provider": "free-sources"
}
```

If `PUBLIC_SEARCH_UPSTREAM_URL` is set, this is an authenticated proxy to a future standalone auth-project Supabase search function. That function must accept `{query, mode}`, enforce the existing auth policy, and return `{results:[{title,url,excerpt}]}` in relevance order. Only HTTPS function URLs in the fixed auth project are accepted, and redirects are rejected.

There is currently no standalone raw-search HTTP action in gateway-chat v190: `toolWebSearch` is a private helper. Without an upstream, this route mirrors its actual Sonar invocation (`/chat/completions`, `model: sonar`, `max_tokens: 600`) when the server-only `PERPLEXITY_API_KEY` is configured, then uses its free-source routing: CoinGecko plus Google News for crypto prices, Google News for time-sensitive queries, otherwise Wikipedia summaries and DuckDuckGo abstracts with a news fallback. No key is needed for the free sources.

Ranking is provider relevance order, not a new learned ranker. URLs are deduplicated, invalid/non-HTTP URLs removed, and numeric ranks assigned after filtering. Unlike the chat helper, a synthesized Sonar answer is never mislabeled as a search finding; actual `search_results` and citations are returned. Wikipedia/abstract requests are parallelized while preserving result order. A successful search with no matches returns an empty array; total source outage returns 502.

## Embeddings

```sh
curl https://ai.spaincos.com/api/embeddings \
  -H "Authorization: Bearer ${SPAINCOS_API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{"input":["Example text"],"model":"text-embedding-3-small"}'
```

`input` accepts a string or 1-32 non-empty strings, totaling at most 32,000 characters. Only `text-embedding-3-small` is supported, matching the gateway's 1536-dimensional semantic-context path.

This endpoint is deliberately owner/infra gated. It returns 503 `embeddings_not_configured` until `PUBLIC_EMBEDDINGS_UPSTREAM_URL` is configured to a dedicated authenticated auth-project Supabase function. The live gateway's `embed_context` path mutates stored personal documents, so this route must not point at gateway-chat or invoke that action.

The upstream must validate the forwarded API key/JWT with the same allowlist, call OpenAI `/v1/embeddings` with `{input, model}` and its own server-side `OPENAI_API_KEY`, then return the OpenAI-compatible `{model,data:[{index,embedding}],usage}` shape. This matches the gateway's provider invocation, but creating/deploying that raw-text adapter and setting secrets is a separate owner-authorized infrastructure step. No OpenAI secret is copied to Vercel by this change.

Responses validate vector count, sequential indices, exact model, 1536 finite numeric dimensions, and safe token-usage integers. Only expected public fields are relayed; private upstream metadata is dropped.

## Common behavior and rollout gates

- **Self-documentation:** Unauthenticated GET on either route returns JSON request/response contracts, API-key guidance, and explicit Phase 1 limits. OPTIONS returns a CORS preflight.
- **Errors:** JSON `{error:{message,type,code}}`; 400 invalid input, 401 invalid credentials, 403 private-account restriction, 405 wrong method, 413 body over 128 KiB, 415 non-JSON, 429 upstream limit, 502 bad/failed upstream, 503 unavailable configuration/auth, 504 timeout.
- **CORS:** Wildcard origins, no cookies or credentialed CORS, only GET/POST/OPTIONS and Authorization/Content-Type. Auth is checked per POST. Provider bodies and secrets are never included in errors.
- **Rate-limit hook:** Commented in `api/_lib/public-api.js`, keyed to resolved key/user identity. A distributed enforcement store and approved limits remain infra-gated; there is no misleading in-memory limiter.
- **Usage-ledger hook:** Commented reserve/settle placement references gateway-chat v190's `credits_reserve`/`credits_settle` pattern, including refund/error handling and idempotency requirements. No credits are reserved or charged in Phase 1, and no pricing/billing source is modified.
- **Release gate:** Do not broadly publish before distributed rate limiting, metering policy, secret provisioning, upstream embeddings deployment, and a live authenticated smoke test are approved. No secret provisioning, deployment, merge, or live API-key issuance is part of this PR.

## Verification

Run `node --test tests/public-api.test.js`. Tests use fake keys and mocked fetch only, covering JWT and opaque-key auth, revocation, allowlist, body bounds, CORS, self-documentation, provider/proxy contracts, ranking/deduplication, fallback ordering, configuration gates, vector validation, and sanitized failures.

The mandatory repository pre-push QA hook still runs unchanged. It exercises the existing live product, not these undeployed routes; the mocked endpoint suite is the local verification for this PR.
