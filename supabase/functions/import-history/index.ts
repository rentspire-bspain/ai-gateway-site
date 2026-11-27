// import-history v1 (owner directive 2026-11-27): user-facing history import.
// Accepts Perplexity conversations.json, Claude conversations.json, and OpenAI
// conversations.json. Authenticated to the caller; rows are scoped to the
// caller's user_id; threads deduped by provider+external id.
import { corsFor, preflight } from "../_shared/cors.js";

const SB = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return preflight(req, cors);
  const rj = (data: unknown, status = 200) => new Response(JSON.stringify(data, null, 2), { status, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    if (req.method !== "POST") return rj({ error: "POST only" }, 405);
    // authenticate
    const auth = req.headers.get("authorization") || "";
    const me = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: SERVICE, Authorization: auth } });
    if (!me.ok) return rj({ error: "sign in first" }, 401);
    const user = await me.json();
    const userId = String(user.id);
    const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", "Prefer": "return=minimal" };

    const body = await req.json();
    const payload = body.payload; // array of provider conversation objects
    const provider = String(body.provider || "auto");
    if (!Array.isArray(payload) || !payload.length) return rj({ error: "no conversations found in file" }, 400);

    // ---- normalize each provider's shape to { external_id, title, messages:[{role,content,created_at}] } ----
    const norm: Array<{ xid: string; title: string; msgs: Array<{ role: string; content: string; created_at?: string }> }> = [];
    for (const c of payload) {
      if (c.uuid && c.mapping) {
        // Perplexity: tree mapping — take terminal chain in order
        const nodes: any = c.mapping;
        const leaf = Object.values(nodes).find((n: any) => n.children && !n.children.length && n.message);
        // walk from root
        const rootKey = Object.keys(nodes).find((k: string) => !nodes[k].parent);
        const chain: any[] = [];
        let cur = rootKey && nodes[rootKey];
        while (cur) { if (cur.message) chain.push(cur.message); cur = cur.children && cur.children.length ? nodes[cur.children[0]] : null; }
        const msgs = chain.filter((m: any) => m.author && (m.author.role === "user" || m.author.role === "assistant") && m.content && m.content.parts)
          .map((m: any) => ({ role: m.author.role, content: m.content.parts.join("\n"), created_at: m.create_time ? new Date(m.create_time * 1000).toISOString() : undefined }));
        if (msgs.length) norm.push({ xid: `pplx:${c.uuid}`, title: String(c.title || c.name || "Imported thread"), msgs });
      } else if (c.uuid && Array.isArray(c.chat_messages)) {
        // Claude
        const msgs = c.chat_messages.map((m: any) => ({ role: m.sender === "human" ? "user" : "assistant", content: String(m.text || ""), created_at: m.created_at }));
        norm.push({ xid: `claude:${c.uuid}`, title: String(c.name || "Imported Claude thread"), msgs: msgs.filter((m: any) => m.content) });
      } else if (c.title && Array.isArray(c.messages)) {
        // OpenAI export: conversations.json with {title, messages:[{author:{role},content,create_time}]}
        const msgs = c.messages.filter((m: any) => m.author && (m.author.role === "user" || m.author.role === "assistant") && m.content)
          .map((m: any) => ({ role: m.author.role, content: typeof m.content === "string" ? m.content : (m.content.parts || []).join("\n"), created_at: m.create_time ? new Date(m.create_time * 1000).toISOString() : undefined }));
        if (msgs.length) norm.push({ xid: `oai:${c.title}`.slice(0, 120), title: String(c.title), msgs });
      }
    }
    if (!norm.length) return rj({ error: "unrecognized export format — expected Perplexity, Claude, or OpenAI conversations JSON", provider }, 400);

    // ---- insert threads + messages, dedup by (user, xid) ----
    let threadsNew = 0, msgsNew = 0, skipped = 0;
    for (const t of norm.slice(0, 2000)) {
      const ex = await (await fetch(`${SB}/rest/v1/threads?user_id=eq.${userId}&slug=eq.${encodeURIComponent(t.xid)}&select=id`, { headers: H })).json();
      if (Array.isArray(ex) && ex.length) { skipped++; continue; }
      const ins = await fetch(`${SB}/rest/v1/threads`, { method: "POST", headers: H, body: JSON.stringify({ user_id: userId, title: t.title.slice(0, 200), slug: t.xid.slice(0, 200) }) });
      if (!ins.ok) continue;
      const row = await (await fetch(`${SB}/rest/v1/threads?user_id=eq.${userId}&slug=eq.${encodeURIComponent(t.xid)}&select=id&order=created_at.desc&limit=1`, { headers: H })).json();
      const tid = Array.isArray(row) && row[0] ? row[0].id : null;
      if (!tid) continue;
      threadsNew++;
      const rows = t.msgs.slice(0, 500).map((m, i) => ({ thread_id: tid, role: m.role, content: m.content.slice(0, 100000), created_at: m.created_at || new Date(Date.now() + i).toISOString() }));
      for (let i = 0; i < rows.length; i += 100) {
        const rr = await fetch(`${SB}/rest/v1/messages_archive`, { method: "POST", headers: H, body: JSON.stringify(rows.slice(i, i + 100)) });
        if (rr.ok) msgsNew += Math.min(100, rows.length - i);
      }
    }
    return rj({ ok: true, user: user.email, conversations_in_file: payload.length, recognized: norm.length, threads_imported: threadsNew, messages_imported: msgsNew, already_imported: skipped });
  } catch (e) {
    return rj({ error: String(e) }, 500);
  }
});
