// /api/embeddings: explicit proxy contract; never triggers embed_context (which
// mutates private documents). No raw-text embedding HTTP action exists in v190.
const { ApiError, endpoint, proxyUpstream, upstreamJson } = require('./_lib/public-api');
const MODEL = 'text-embedding-3-small';

module.exports = endpoint({
  endpoint: '/api/embeddings',
  method: 'POST',
  request: { input: 'Non-empty string or array of 1-32 non-empty strings; <= 32000 total characters', model: `${MODEL} (default; 1536 dimensions)` },
  example: { input: ['Example text'], model: MODEL },
  response: { object: 'list', model: MODEL, data: [{ object: 'embedding', index: 0, embedding: ['1536 finite numbers'] }], usage: { prompt_tokens: 0, total_tokens: 0 } },
  availability: 'Owner/infra gated: returns 503 until PUBLIC_EMBEDDINGS_UPSTREAM_URL is configured to an authenticated raw-text embeddings function.',
}, async (body, principal) => {
  const model = body.model === undefined ? MODEL : body.model;
  if (model !== MODEL) throw new ApiError(400, 'invalid_model', `Only ${MODEL} is supported in Phase 1.`);
  const inputs = typeof body.input === 'string' ? [body.input] : body.input;
  if (!Array.isArray(inputs) || !inputs.length || inputs.length > 32 || inputs.some(s => typeof s !== 'string' || !s.trim()) || inputs.reduce((n, s) => n + s.length, 0) > 32000) {
    throw new ApiError(400, 'invalid_input', 'input must contain 1-32 non-empty strings totaling at most 32000 characters.');
  }
  // UPSTREAM WIRING POINT: create an auth-project function that authenticates the
  // forwarded Bearer key/JWT with the same api_keys/allowlist policy and invokes
  // https://api.openai.com/v1/embeddings with {input, model} using its server-side
  // OPENAI_API_KEY, as gateway-chat v190's semantic context path already does.
  // Keep that credential in Supabase secrets, NOT in this repo or client input.
  const url = process.env.PUBLIC_EMBEDDINGS_UPSTREAM_URL;
  if (!url) throw new ApiError(503, 'embeddings_not_configured', 'Raw-text embeddings upstream is not configured.');
  const d = await upstreamJson(await proxyUpstream(url, principal.token, { input: body.input, model }));
  const rows = d?.data;
  if (d?.model !== MODEL || !Array.isArray(rows) || rows.length !== inputs.length ||
      rows.some((row, i) => row?.index !== i || !Array.isArray(row.embedding) || row.embedding.length !== 1536 || row.embedding.some(n => typeof n !== 'number' || !Number.isFinite(n)))) {
    throw new ApiError(502, 'invalid_upstream_response', 'Embeddings upstream returned an invalid vector response.');
  }
  // Whitelist output fields instead of blindly relaying potentially sensitive metadata.
  const usage = d.usage;
  const validUsage = usage && [usage.prompt_tokens, usage.total_tokens].every(n => Number.isSafeInteger(n) && n >= 0);
  return { object: 'list', model, data: rows.map(row => ({ object: 'embedding', index: row.index, embedding: row.embedding })), ...(validUsage ? { usage: { prompt_tokens: usage.prompt_tokens, total_tokens: usage.total_tokens } } : {}) };
});
