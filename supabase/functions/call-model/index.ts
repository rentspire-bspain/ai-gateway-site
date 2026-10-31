Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-gateway-token",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    // Gateway auth: if GATEWAY_TOKEN is set, every caller must present it
    // (Authorization: Bearer <token> or x-gateway-token header). The Supabase
    // publishable key is NOT sufficient — the edge gateway accepts any bearer.
    const gt = Deno.env.get("GATEWAY_TOKEN");
    if (gt) {
      const auth = req.headers.get("authorization") || "";
      const presented = auth.startsWith("Bearer ") ? auth.slice(7) : req.headers.get("x-gateway-token") || "";
      if (presented !== gt) {
        return new Response(JSON.stringify({ error: "unauthorized gateway token" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
      }
    }
    const { prompt, model, backend, messages, purpose, max_tokens } = await req.json();
    // THE FREE HOSTED MODELS (no hardware, no cost):
    //   - OpenRouter's free Flint (recursive/flint-v1.0:free) — the coding/agent model
    //   - OpenRouter's Free Models Router — the auto-routing free tier
    //   - Groq's free tier (qwen/qwen3.8-27b, etc.) — the fast summarization
    //   - Cloudflare Workers AI (glm-4.7-flash, gemma-4-26b, nemotron-3-120b) — 10K neurons/day free
    //   - The LiteLLM proxy (the local Mac, ai.spaincos.com) — the open-weight models on your hardware
    const DEFAULTS = {
      coding: "recursive/flint-v1.0:free",       // OpenRouter's free Flint
      flint: "recursive/flint-v1.0:free",        // explicit Flint alias (2026-10-28 fix: 'flint' previously fell through to the auto router)
      summary: "qwen/qwen3.8-27b",   // Groq's fast free summarization
      general: "qwen/qwen3.8-27b",                 // PINNED 2026-10-30: Groq free Qwen3.8-27B (was openrouter/auto, a random-model router)
    };
    const chosen = model || DEFAULTS[purpose] || DEFAULTS.general;
    // Route to the correct API based on the model (Groq models → Groq, others → OpenRouter)
    const isGroq = chosen.startsWith("qwen/") || chosen.includes("groq");
    const url = backend || Deno.env.get("MODEL_BACKEND_URL") || (isGroq ? "https://api.groq.com/openai/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions");
    const key = Deno.env.get("MODEL_BACKEND_KEY") || (isGroq ? Deno.env.get("GROQ_API_KEY") : Deno.env.get("OPENROUTER_API_KEY")) || "";
    // max_tokens: Groq's free tier enforces OTPM 1000 — cap output tokens unless the caller sets one.
    const cap = Math.min(Number(max_tokens) > 0 ? Number(max_tokens) : 1024, 1024);
    const body = messages
      ? { model: chosen, messages, max_tokens: cap }
      : { model: chosen, messages: [{ role: "user", content: prompt || "" }], max_tokens: cap };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let data = await res.json();
    if (!res.ok && isGroq && !model && !backend && !Deno.env.get("MODEL_BACKEND_URL")) {
      // Groq free tier rate-limited/unavailable: fall back to the named free Flint model (visible in data.model).
      const fb = DEFAULTS.flint;
      const r2 = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${Deno.env.get("OPENROUTER_API_KEY") || ""}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, model: fb }),
      });
      const d2 = await r2.json();
      if (r2.ok) { data = d2; data.x_fallback_from = chosen; }
    }
    return new Response(JSON.stringify(data), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});