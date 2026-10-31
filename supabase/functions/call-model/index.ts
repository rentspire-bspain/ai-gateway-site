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
      general: "deepseek/deepseek-v4.1-flash-1017", // PINNED 2026-10-31: DeepSeek V4.1 Flash via OpenRouter (PAID, ~$0.0003/call). Eval: 74.2% vs Qwen 19.4% (eval/RESULTS.md)
    };
    let chosen = model || DEFAULTS[purpose] || DEFAULTS.general;
    const isGroqId = (m: string) => m.startsWith("qwen/") || m.includes("groq");
    const isFree = (m: string) => isGroqId(m) || m.endsWith(":free");
    const sbUrl = Deno.env.get("SUPABASE_URL") || "";
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const sbHeaders = { "Authorization": `Bearer ${sbKey}`, "apikey": sbKey };
    const custom = !!backend || !!Deno.env.get("MODEL_BACKEND_URL");
    // SPEND TRIPWIRE: every paid call writes one tiny object to the private Storage bucket 'gateway-meter'
    // under today's UTC date prefix (no DB migration needed). Past DAILY_PAID_CALL_CAP objects per UTC day
    // (default 2000, about $0.60 at $0.0003/call) paid models are downgraded to free Qwen and the response
    // carries x_budget_exceeded. Meter errors fail open (availability over a few cents).
    const DAILY_CAP = Number(Deno.env.get("DAILY_PAID_CALL_CAP")) || 2000;
    const dayKey = new Date().toISOString().slice(0, 10);
    let budgetExceeded = false;
    const paid = !custom && !isFree(chosen);
    let paidToday: number | null = null;
    let meterDiag = "";
    if (paid && sbUrl) {
      try {
        const l = await fetch(`${sbUrl}/storage/v1/object/list/gateway-meter`, { method: "POST",
          headers: { ...sbHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ prefix: dayKey, limit: DAILY_CAP, offset: 0 }), signal: AbortSignal.timeout(5000) });
        meterDiag = `list:${l.status}`;
        if (!l.ok) {
          await fetch(`${sbUrl}/storage/v1/bucket`, { method: "POST", headers: { ...sbHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({ id: "gateway-meter", name: "gateway-meter", public: false }), signal: AbortSignal.timeout(5000) })
            .then((cr) => { meterDiag += ` create:${cr.status}`; });
          paidToday = 0;
        } else if (l.ok) { const arr = await l.json(); paidToday = Array.isArray(arr) ? arr.length : null; }
      } catch (e) { meterDiag += ` err:${String(e).slice(0, 80)}`; }
      if (paidToday !== null && paidToday >= DAILY_CAP) { budgetExceeded = true; chosen = DEFAULTS.summary; }
    }
    const callOne = async (m: string, mt: number) => {
      const g = isGroqId(m);
      const url = backend || Deno.env.get("MODEL_BACKEND_URL") || (g ? "https://api.groq.com/openai/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions");
      const key = Deno.env.get("MODEL_BACKEND_KEY") || (g ? Deno.env.get("GROQ_API_KEY") : Deno.env.get("OPENROUTER_API_KEY")) || "";
      const msgs = messages ? messages : [{ role: "user", content: prompt || "" }];
      const r = await fetch(url, { method: "POST", headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: m, messages: msgs, max_tokens: mt }), signal: AbortSignal.timeout(55_000) });
      let d: any; try { d = await r.json(); } catch (_e) { d = { error: "bad upstream response" }; }
      const content = d?.choices?.[0]?.message?.content;
      return { ok: r.ok && !d?.error && typeof content === "string" && content.length > 0, d };
    };
    // max_tokens: Groq free tier enforces OTPM 1000 (cap 1024); OpenRouter reasoning models get 2048.
    const capFor = (m: string) => Math.min(Number(max_tokens) > 0 ? Number(max_tokens) : 2048, isGroqId(m) ? 1024 : 2048);
    let { ok, d: data } = await callOne(chosen, capFor(chosen));
    if (paid && !budgetExceeded && sbUrl) {
      const obj = `${dayKey}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.json`;
      const put = () => fetch(`${sbUrl}/storage/v1/object/gateway-meter/${obj}`, { method: "POST", headers: { ...sbHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ model: chosen, purpose: purpose ?? null, ok, usage: data?.usage ?? null }), signal: AbortSignal.timeout(5000) });
      try {
        let pr = await put();
        if (!pr.ok) { // bucket missing on first use: create it, then retry once
          await fetch(`${sbUrl}/storage/v1/bucket`, { method: "POST", headers: { ...sbHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({ id: "gateway-meter", name: "gateway-meter", public: false }), signal: AbortSignal.timeout(5000) });
          pr = await put();
        }
        meterDiag += ` put:${pr.status}`;
      } catch (e) { meterDiag += ` puterr:${String(e).slice(0, 60)}`; }
    }
    // Fallback chain (only when the caller did not pin a model/backend): Qwen on Groq (free, works), then Flint.
    if (!ok && !model && !custom) {
      const chain = [DEFAULTS.summary, DEFAULTS.flint].filter((m) => m !== chosen);
      for (const fb of chain) {
        try {
          const r2 = await callOne(fb, capFor(fb));
          if (r2.ok) { data = r2.d; data.x_fallback_from = chosen; ok = true; break; }
        } catch (_e) { /* try next */ }
      }
    }
    if (paid && data && typeof data === "object") data.x_meter = { paid_today: paidToday, cap: DAILY_CAP, diag: meterDiag };
    if (budgetExceeded && data && typeof data === "object") data.x_budget_exceeded = { cap: DAILY_CAP, paid_calls_today: paidToday };
    return new Response(JSON.stringify(data), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});