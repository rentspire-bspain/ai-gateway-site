#!/usr/bin/env node
// gen-csp-sri.mjs — adds SRI to pinned CDN scripts and writes a hash-based CSP <meta> into index.html.
// Usage: node tools/gen-csp-sri.mjs index.html [--check]
// Re-run after ANY edit to an inline <script> (its hash changes). --check exits 1 if index.html is stale.
import fs from "node:fs"; import crypto from "node:crypto";
const file = process.argv[2] || "index.html"; const check = process.argv.includes("--check");
let html = fs.readFileSync(file, "utf8");
const sha = (buf, alg = "sha256") => `${alg}-${crypto.createHash(alg).update(buf).digest("base64")}`;
const PINNED = { // exact versions (floating @2 / @12 / @3 ranges are not SRI-safe)
  "@supabase/supabase-js@2": "@supabase/supabase-js@2.45.4/dist/umd/supabase.js", "marked@12/marked.min.js": "marked@12.0.2/marked.min.js", "dompurify@3/dist/purify.min.js": "dompurify@3.1.7/dist/purify.min.js",
};
for (const [from, to] of Object.entries(PINNED)) html = html.replace(`cdn.jsdelivr.net/npm/${from}"`, `cdn.jsdelivr.net/npm/${to}"`);
html = html.replace("jszip@3.10.1/dist/jszip.min.js", "jszip@3.10.1/dist/jszip.min.js");
// jszip is added dynamically at runtime (sc.src=...); give it sc.integrity/sc.crossOrigin in index.html by hand (see spec).
// SRI for every external jsdelivr <script src>
const tags = [...html.matchAll(/<script src="(https:\/\/cdn\.jsdelivr\.net\/[^"]+)"(?![^>]*integrity)[^>]*><\/script>/g)];
for (const m of tags) {
  const buf = Buffer.from(await (await fetch(m[1])).arrayBuffer());
  html = html.replace(m[0], `<script src="${m[1]}" integrity="${sha(buf, "sha384")}" crossorigin="anonymous"></script>`);
}
// inline script hashes
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => `'${sha(Buffer.from(m[1], "utf8"))}'`);
const SB = "https://bnxermyboeigvwonfrzx.supabase.co";
const csp = [
  "default-src 'self'",
  `script-src 'self' https://cdn.jsdelivr.net ${inline.join(" ")}`,   // no 'unsafe-inline': only the hashed inline blocks run; dynamic import() of pdfjs/jszip/katex from jsdelivr is allowed
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",        // inline style attributes are used widely; katex.css from jsdelivr (has SRI)
  "font-src 'self' https://frontend-cdn.perplexity.ai https://cdn.jsdelivr.net data:",
  "img-src 'self' data: blob: https:",                                // search image results need https:; answer markdown images are stripped by safe-url.js
  `connect-src 'self' ${SB} https://geocoding-api.open-meteo.com https://api.open-meteo.com https://www.google.com`,
  "worker-src 'self' blob: https://cdn.jsdelivr.net", "media-src 'self' blob: data: https:",
  "object-src 'none'", "base-uri 'none'", "form-action 'self'",
].join("; ");
// NOTE: GitHub Pages cannot send headers, so frame-ancestors / report-only are unavailable. Put Cloudflare (or any proxy) in front to add
// `Content-Security-Policy: <same> ; frame-ancestors 'none'` plus X-Content-Type-Options, Referrer-Policy.
const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
html = /<meta http-equiv="Content-Security-Policy"[^>]*>/.test(html) ? html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, meta) : html.replace(/<head>/i, `<head>\n${meta}\n<meta name="referrer" content="strict-origin-when-cross-origin">`);
if (check) { process.exit(fs.readFileSync(file, "utf8") === html ? 0 : 1); }
fs.writeFileSync(file, html); console.log("ok", { inlineScripts: inline.length, sri: tags.length });
