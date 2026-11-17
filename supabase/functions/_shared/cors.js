// cors.js — origin-pinned CORS. Browser calls come only from the site origin; server-to-server
// functions (call-model, history-import) should send NO CORS headers at all (use serverOnly()).
export const SITE_ORIGINS = ["https://ai.spaincos.com"];

/** @param {Request} req @param {{origins?:string[], extraHeaders?:string[], allowLocalhost?:boolean}} o */
export function corsFor(req, o = {}) {
  const origins = o.origins || SITE_ORIGINS;
  const origin = req.headers.get("origin") || "";
  const ok = origins.includes(origin) || (o.allowLocalhost === true && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  const h = {
    "Vary": "Origin",
    "Access-Control-Allow-Headers": ["authorization", "x-client-info", "apikey", "content-type", ...(o.extraHeaders || [])].join(", "),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "600",
  };
  if (ok) h["Access-Control-Allow-Origin"] = origin;
  return h;
}
/** Preflight from a disallowed origin gets 403 and no ACAO header. */
export function preflight(req, cors) {
  const origin = req.headers.get("origin") || "";
  return new Response(cors["Access-Control-Allow-Origin"] === origin ? "ok" : "forbidden", { status: cors["Access-Control-Allow-Origin"] === origin ? 200 : 403, headers: cors });
}
export const serverOnly = () => ({});
