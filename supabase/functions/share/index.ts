// share — public read-only share links for ai.spaincos.com
// Actions (POST JSON): create, revoke (authenticated); get (UNAUTHENTICATED, GET ?id= or POST).
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "https://bnxermyboeigvwonfrzx.supabase.co";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const ALLOWED_EMAILS = ["bspain@spaincos.com", "eval-bot@spaincos.com"];
const MAX_MESSAGES = 200;
const MAX_CONTENT = 100_000;
const MAX_SOURCES = 100;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

function rest(key: string, isService: boolean) {
  const h: Record<string, string> = { "apikey": isService ? key : ANON, "Authorization": `Bearer ${key}`, "Content-Type": "application/json" };
  return async (method: string, path: string, body?: unknown, prefer = "return=representation") => {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
      method, headers: { ...h, Prefer: prefer }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15_000),
    });
    const t = await r.text();
    if (!r.ok) throw new Error(`db ${r.status}: ${t.slice(0, 200)}`);
    return t ? JSON.parse(t) : null;
  };
}

const ID_RE = /^[A-Za-z0-9_-]{12}$/;
function newId(): string {
  const a = new Uint8Array(12); crypto.getRandomValues(a);
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  return Array.from(a, (x) => abc[x & 63]).join(""); // 64 symbols -> unbiased
}

// Keep only role / content / sources(title,url).
function sanitize(messages: unknown) {
  const arr = Array.isArray(messages) ? messages.slice(0, MAX_MESSAGES) : [];
  return arr.map((m: any) => {
    const role = m?.role === "user" ? "user" : "assistant";
    const out: { role: string; content: string; sources?: Array<{ title: string; url: string }> } = { role, content: String(m?.content ?? "").slice(0, MAX_CONTENT) };
    if (role === "assistant" && Array.isArray(m?.sources)) {
      out.sources = m.sources.slice(0, MAX_SOURCES).map((s: any) => typeof s === "string"
        ? { title: s.slice(0, 300), url: s.slice(0, 1000) }
        : { title: String(s?.title ?? s?.name ?? s?.url ?? "").slice(0, 300), url: String(s?.url ?? s?.link ?? "").slice(0, 1000) })
        .filter((s: { url: string }) => /^https?:\/\//i.test(s.url));
    }
    return out;
  }).filter((m) => m.content.length > 0);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  let b: any = {};
  if (req.method === "GET") {
    const u = new URL(req.url);
    b = { action: u.searchParams.get("action") || "get", id: u.searchParams.get("id") };
  } else if (req.method === "POST") {
    try { b = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  } else return json({ error: "GET or POST only" }, 405);
  const action = String(b?.action || "");

  // ---- PUBLIC GET (no auth) ----
  if (action === "get") {
    const id = String(b?.id || "");
    if (!ID_RE.test(id)) return json({ error: "Not found" }, 404);
    if (!svc) return json({ error: "service key unavailable" }, 500);
    try {
      const rows = await rest(svc, true)("GET", `shared_threads?id=eq.${id}&revoked_at=is.null&select=title,messages&limit=1`);
      if (!rows?.length) return json({ error: "This link is unavailable or was revoked." }, 404);
      return json({ title: String(rows[0].title ?? ""), messages: sanitize(rows[0].messages) });
    } catch { return json({ error: "Lookup failed" }, 500); }
  }

  // ---- AUTH (same pattern as monitors) ----
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Not authenticated — sign in again." }, 401);
  const token = authHeader.slice(7).trim();
  const authCheck = await fetch(`${SB_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: ANON }, signal: AbortSignal.timeout(10_000) });
  if (!authCheck.ok) return json({ error: "Not authenticated — sign in again." }, 401);
  const user = await authCheck.json();
  const userId: string = user?.id ?? "";
  if (!userId) return json({ error: "Not authenticated — sign in again." }, 401);
  if (!ALLOWED_EMAILS.includes(String(user?.email ?? "").toLowerCase())) return json({ error: "This site is private." }, 403);
  if (!svc) return json({ error: "service key unavailable" }, 500);
  const db = rest(svc, true);
  // Same service-role, waitUntil, fail-open analytics pipeline as gateway-chat.
  const logAnalyticsEvent = (eventType: string, payload: Record<string, unknown>, model: string | null, creditsDelta: number) => {
    try {
      const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      if (!svcKey) return;
      const job = fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/analytics_events`, {
        method: "POST",
        headers: { "apikey": svcKey, "Authorization": `Bearer ${svcKey}`, "Content-Type": "application/json", "Prefer": "return=minimal" },
        body: JSON.stringify({ user_id: userId || null, event_type: eventType, payload, model, credits_delta: creditsDelta }),
        signal: AbortSignal.timeout(6_000)
      }).then((r) => { if (!r.ok) console.error("analytics insert failed:", eventType, r.status); }).catch(() => {});
      (globalThis as any).EdgeRuntime?.waitUntil?.(job);
    } catch (_e) { /* never break share on analytics */ }
  };

  try {
    switch (action) {
      case "create": {
        const messages = sanitize(b.messages);
        if (!messages.length) return json({ error: "messages are required" }, 400);
        const title = String(b.title || "Shared thread").trim().slice(0, 200);
        for (let i = 0; i < 3; i++) {
          const id = newId();
          try {
            await db("POST", "shared_threads", { id, user_id: userId, title, messages }, "return=minimal");
            logAnalyticsEvent("share", {
              thread_id: typeof b.thread_id === "string" ? b.thread_id : null,
              card_variant: ["answer", "streak", "ring", "nodedex"].includes(b.card_variant) ? b.card_variant : null
            }, null, 0);
            return json({ id });
          } catch (e) { if (!/23505|duplicate/.test(String((e as Error).message)) || i === 2) throw e; }
        }
        return json({ error: "id generation failed" }, 500);
      }
      case "revoke": {
        const id = String(b.id || "");
        if (!ID_RE.test(id)) return json({ error: "invalid id" }, 400);
        const rows = await db("PATCH", `shared_threads?id=eq.${id}&user_id=eq.${userId}&revoked_at=is.null`, { revoked_at: new Date().toISOString() });
        if (!rows?.length) return json({ error: "Not found" }, 404);
        return json({ ok: true });
      }
      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    const msg = String((e as Error).message);
    if (/relation .* does not exist|42P01|PGRST205/.test(msg)) return json({ error: "setup: run share/schema.sql" }, 404);
    return json({ error: msg.slice(0, 200) }, 500);
  }
});
