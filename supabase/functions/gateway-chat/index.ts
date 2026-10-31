// gateway-chat: the authenticated chat proxy. verify_jwt=true — the platform rejects
// any request without a valid Supabase user JWT before this code runs.
// Proxies to call-model (provider keys + routing) and records every call in ops.llm_requests.
Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const started = Date.now();
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { messages, purpose, model, max_tokens } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages array required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const capped = messages.slice(-20).map(m => ({
      role: m.role === "assistant" || m.role === "user" || m.role === "system" ? m.role : "user",
      content: String(m.content || "").slice(0, 4000),
    }));
    const res = await fetch(url + "/functions/v1/call-model", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + serviceKey },
      body: JSON.stringify({ messages: capped, purpose, model, max_tokens: Math.min(Number(max_tokens) || 512, 1024) }),
      signal: AbortSignal.timeout(60_000),
    });
    const data = await res.json();
    // Ledger every call (best-effort via plain PostgREST insert — never blocks the chat).
    try {
      await fetch(url + "/rest/v1/llm_requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + serviceKey,
          "apikey": serviceKey,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({
          caller: "gateway-chat",
          product: "ai.spaincos.com",
          alias: purpose ?? model ?? null,
          resolved_model: data?.model ?? null,
          served_by: data?.provider ?? (data?.x_groq ? "groq" : null),
          data_class: "public",
          prompt_tokens: data?.usage?.prompt_tokens ?? null,
          completion_tokens: data?.usage?.completion_tokens ?? null,
          latency_ms: Date.now() - started,
          status: res.ok ? "ok" : "error",
          request_id: data?.id ?? null,
          error: res.ok ? null : String(data?.error ?? "upstream error").slice(0, 200),
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (_ledgerError) { /* ledger is best-effort */ }
    return new Response(JSON.stringify(data), { status: res.status, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});