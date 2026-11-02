// resend-webhook: receives Resend email events (delivered, opened, clicked,
// bounced, complained, ...), verifies the Standard Webhooks (svix) signature,
// and persists each event to comptrove_ops.email_events for the outreach
// pipeline. No CORS — this is server-to-server; browsers get nothing.
//
// Activation (one SQL insert, fail-closed until then):
//   insert into comptrove_ops.secrets (name, value)
//   values ('resend_webhook_secret', '<whsec_... from the Resend dashboard>');
// Then point the Resend webhook at:
//   https://dcyjmftriqayqaonitlx.supabase.co/functions/v1/resend-webhook
const TOLERANCE_SEC = 300; // reject timestamps older/newer than 5 minutes
// per-instance secret cache (module scope survives between warm requests)
const cache: Record<string, unknown> = {};

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function hmacB64(secret: Uint8Array, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", secret as unknown as ArrayBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  let bin = "";
  new Uint8Array(sig).forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "GET") return json(200, { ok: true, service: "resend-webhook" });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const sbUrl = Deno.env.get("SUPABASE_URL") || "";
  const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!sbUrl || !sbKey) return json(500, { error: "not configured" });

  const rpc = async (fn: string, body: Record<string, unknown>) =>
    (await fetch(sbUrl + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: { "Authorization": "Bearer " + sbKey, "apikey": sbKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    })).json();

  // fetch the signing secret (cached per instance; fail closed when unset)
  let secret: string | null = (cache as { v?: string; at?: number }).v || null;
  const now = Date.now();
  if (!secret || now - ((cache as any).at || 0) > 5 * 60 * 1000) {
    const s = await rpc("rs_get_secret", { p_name: "resend_webhook_secret" });
    if (typeof s !== "string" || !s) return json(503, { error: "webhook secret not configured" });
    secret = s;
    (cache as any).v = s; (cache as any).at = now;
  }
  const raw = await req.text();
  if (raw.length > 256_000) return json(413, { error: "payload too large" });

  // svix (Standard Webhooks) verification
  const id = req.headers.get("svix-id") || "";
  const ts = req.headers.get("svix-timestamp") || "";
  const sigHeader = req.headers.get("svix-signature") || "";
  if (!id || !ts || !sigHeader) return json(401, { error: "missing svix headers" });
  const age = Math.abs(Math.floor(Date.now() / 1000) - parseInt(ts, 10));
  if (!Number.isFinite(age) || age > TOLERANCE_SEC) return json(401, { error: "stale timestamp" });
  const b64key = secret!.startsWith("whsec_") ? secret!.slice(6) : secret!;
  let keyBytes: Uint8Array;
  try { keyBytes = b64decode(b64key); } catch (_e) { return json(500, { error: "secret is not valid base64" }); }
  const expected = await hmacB64(keyBytes, `${id}.${ts}.${raw}`);
  const passed = sigHeader.split(" ").some((part) => {
    const [v, sig] = part.split(",");
    return v === "v1" && !!sig && sig.length === expected.length && sig === expected;
  });
  if (!passed) return json(401, { error: "invalid signature" });

  // verified: parse and persist
  let evt: any;
  try { evt = JSON.parse(raw); } catch (_e) { return json(400, { error: "invalid json" }); }
  const type = String(evt?.type || "").slice(0, 100);
  const d = evt?.data || {};
  const ok = await rpc("rs_record_email_event", {
    p_event_type: type || "unknown",
    p_email: String(d?.to?.[0] || d?.email_to || d?.recipient || "").toLowerCase().slice(0, 254) || null,
    p_email_id: String(d?.email_id || "").slice(0, 200) || null,
    p_subject: String(d?.subject || "").slice(0, 500) || null,
    p_link_url: String(d?.click?.url || "").slice(0, 1000) || null,
    p_user_agent: String(d?.open?.user_agent || "").slice(0, 500) || null,
    p_tags: Array.isArray(d?.tags) ? d?.tags : null,
    p_raw: evt,
    p_received_at: evt?.created_at ? new Date(evt.created_at).toISOString() : null,
  });
  if (ok !== true) return json(500, { error: "event not recorded" });
  return json(200, { ok: true });
});
