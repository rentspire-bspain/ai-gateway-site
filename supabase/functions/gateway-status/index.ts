// gateway-status: public model fleet status. Runs a tiny live test per model,
// measures latency, and caches results for 60s so page loads don't burn the free tiers.
const CACHE = { at: 0, results: null as any[] | null };

async function testModel(purpose: string, name: string, provider: string, model: string, use: string) {
  const started = Date.now();
  try {
    // v349: production call-model runs cross-project (dcyj) — probe the REAL fleet, and
    // authenticate with the outbound gateway token (GATEWAY_TOKEN_B || GATEWAY_TOKEN), not
    // the service-role key (the service key was only accepted while it happened to equal the
    // primary token; the 11-23 rotation broke that equality and every lane showed "unauthorized").
    const cmTok = Deno.env.get("GATEWAY_TOKEN_B") || Deno.env.get("GATEWAY_TOKEN") || "";
    const res = await fetch(`${Deno.env.get("CALL_MODEL_URL") || "https://dcyjmftriqayqaonitlx.supabase.co/functions/v1/call-model"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${cmTok}`,
      body: JSON.stringify({ purpose, messages: [{ role: "user", content: "Reply with exactly: OK" }], max_tokens: 512 }),
      signal: AbortSignal.timeout(25_000),
    });
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    const ok = res.ok && content.length > 0;
    return {
      name, provider, model, use,
      status: ok ? "pass" : "fail",
      latency_ms: Date.now() - started,
      returned_model: data?.model ?? null,
      fallback_from: data?.x_fallback_from ?? null,
      error: ok ? (data?.x_fallback_from ? `served by fallback (${data?.model}); ${data.x_fallback_from} failed` : null) : (data?.error?.message ?? data?.error ?? "no content returned"),
      tested_at: new Date().toISOString(),
    };
  } catch (e: any) {
    return {
      name, provider, model, use,
      status: "fail",
      latency_ms: Date.now() - started,
      returned_model: null,
      error: String(e?.message ?? e).slice(0, 200),
      tested_at: new Date().toISOString(),
    };
  }
}

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const force = new URL(req.url).searchParams.get("force") === "1";
  if (!force && CACHE.results && Date.now() - CACHE.at < 60_000) {
    return new Response(JSON.stringify({ results: CACHE.results, cached: true, tested_at: new Date(CACHE.at).toISOString() }), { headers: { ...cors, "Content-Type": "application/json" } });
  }
  const results = await Promise.all([
    testModel("summary", "Qwen3.8-27B", "Groq free tier", "qwen/qwen3.8-27b", "Fast summarization, digests, weekday report composition."),
    testModel("flint", "Flint v1.0", "OpenRouter free tier", "recursive/flint-v1.0:free", "Coding + agent work. Fixed 2026-10-28: the flint purpose now routes correctly."),
    testModel("general", "Auto (DeepSeek V4.1 Flash)", "OpenRouter (paid, fractions of a cent per call)", "deepseek/deepseek-v4.1-flash-1017", "Default for general Q&A. Pinned 2026-10-31 after eval (74.2% vs Qwen 19.4%); falls back to Flint on error."),
  ]);
  CACHE.at = Date.now();
  CACHE.results = results;
  return new Response(JSON.stringify({ results, cached: false, tested_at: new Date(CACHE.at).toISOString() }), { headers: { ...cors, "Content-Type": "application/json" } });
});