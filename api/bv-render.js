// /api/bv-render — serves the SPA HTML with the BoundView brand applied SERVER-SIDE.
// v283: the runtime DOM scrub (modules/brand.js) repaints ~10s after load — the owner
// screenshot showed "Welcome to ai.spaincos" and "you@spaincos.com" painting on
// boundview.com before the scrub caught up. This function applies the same brand MAP
// to the HTML BEFORE the browser ever sees it: zero flash, zero delay. The runtime
// scrub stays as the safety net for dynamically-rendered nodes.
// NOTE: this rewrite is boundview.com-only in effect — the Vercel project serves the
// boundview deployment; ai.spaincos.com is served by GitHub Pages and never hits it.
const fs = require("fs");
const path = require("path");

// the brand MAP (mirrors modules/brand.js — kept in sync deliberately)
const MAP = [
  [/ai\.spaincos\.com/g, "BoundView"],
  [/ai-spaincos/g, "BoundView"],
  [/spaincos-icon\.svg/gi, "boundview-icon.svg"],
  [/Spain Companies/g, "BoundView"],
  [/spaincos\.com/g, "boundview.com"],
  [/@spaincos/g, "@boundview"],
  [/\bspaincos\b/gi, "BoundView"],
  [/ai\.BoundView\b/g, "BoundView"],
];

function transformHtml(html) {
  // never touch <script> blocks: the CSP carries sha256 hashes of inline scripts —
  // rewriting script content would break the CSP and kill the page.
  const parts = html.split(/(<script[\s\S]*?<\/script>)/g);
  return parts
    .map((seg, i) => (i % 2 === 1 ? seg : MAP.reduce((s, [re, to]) => s.replace(re, to), seg)))
    .join("");
}

module.exports = async (req, res) => {
  const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };
  if (req.method === "OPTIONS") {
    res.writeHead(204, { ...headers, Allow: "GET, OPTIONS" });
    res.end();
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { ...headers, Allow: "GET, OPTIONS" });
    res.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
    return;
  }
  try {
    // index.html is bundled into the function (vercel.json includeFiles); the exact
    // bundle layout varies by runtime — check the known candidate paths.
    const candidates = [
      path.join(__dirname, "index.html"),
      path.join(__dirname, "../index.html"),
      path.join(process.cwd(), "index.html"),
      path.join(process.cwd(), "../index.html"),
    ];
    let file = candidates.find((c) => { try { return fs.existsSync(c); } catch { return false; } });
    const html = fs.readFileSync(file, "utf8");
    const out = transformHtml(html);
    res.writeHead(200, headers);
    res.end(req.method === "HEAD" ? undefined : out);
  } catch (e) {
    // never break the site over branding — fall back to a redirect to the raw asset
    res.writeHead(302, { Location: "/index.html" });
    res.end();
  }
};
