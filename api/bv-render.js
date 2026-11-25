// /api/bv-render — v329a (adds boundview-only /pricing page; includeFiles glob extended — forces rebuild)
// prior: v328a (cache bust: force function rebuild so includeFiles picks up privacy.es.html fix; no logic change)
// /api/bv-render — serves the SPA HTML with the BoundView brand applied SERVER-SIDE.
// v283: the runtime DOM scrub (modules/brand.js) repaints ~10s after load — the owner
// screenshot showed "Welcome to ai.spaincos" and "you@spaincos.com" painting on
// boundview.com before the scrub caught up. This function applies the same brand MAP
// to the HTML BEFORE the browser ever sees it: zero flash, zero delay. The runtime
// scrub stays as the safety net for dynamically-rendered nodes.
// NOTE (v290): the BoundView transform is applied ONLY when the request host is a
// boundview hostname. This same Vercel project ALSO serves ai.spaincos.com (DNS
// CNAMEs ai.spaincos.com to cname.vercel-dns.com — the "GitHub Pages serves it"
// assumption in v283 was wrong), and serving the transformed HTML there shipped
// BoundView branding to every ai.spaincos.com user (found by the v290 UX master
// benchmark, check H2). Non-boundview hosts get the RAW index.html.
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

const BV_LD = "{\"@context\":\"https://schema.org\",\"@graph\":[{\"@type\":\"Organization\",\"@id\":\"https://boundview.com/#org\",\"name\":\"BoundView\",\"legalName\":\"CanonIntel LLC\",\"url\":\"https://boundview.com/\",\"logo\":\"https://boundview.com/icons/boundview-icon-512.png\",\"contactPoint\":{\"@type\":\"ContactPoint\",\"contactType\":\"customer support\",\"email\":\"support@boundview.com\"}},{\"@type\":\"WebSite\",\"@id\":\"https://boundview.com/#website\",\"name\":\"BoundView\",\"url\":\"https://boundview.com/\",\"publisher\":{\"@id\":\"https://boundview.com/#org\"}},{\"@type\":\"WebApplication\",\"@id\":\"https://boundview.com/#app\",\"name\":\"BoundView\",\"url\":\"https://boundview.com/\",\"description\":\"AI research with sources, and Neurons rewards for verified activity.\",\"applicationCategory\":\"BusinessApplication\",\"operatingSystem\":\"Web\",\"browserRequirements\":\"Requires JavaScript\",\"publisher\":{\"@id\":\"https://boundview.com/#org\"}},{\"@type\":\"BreadcrumbList\",\"itemListElement\":[{\"@type\":\"ListItem\",\"position\":1,\"name\":\"BoundView\",\"item\":\"https://boundview.com/\"}]}]}";

function transformHtml(html) {
  // never touch <script> blocks: the CSP carries sha256 hashes of inline scripts —
  // rewriting script content would break the CSP and kill the page.
  const parts = html.split(/(<script[\s\S]*?<\/script>)/g);
  const scrub = (s) => {
    // v299: email addresses are USER DATA, never brand copy — never rewrite them
    // (the signed-in account's email must not become a fabricated boundview address).
    const emails = [];
    s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, (m) => {
      emails.push(m);
      return `\u0000E${emails.length - 1}\u0000`;
    });
    s = MAP.reduce((acc, [re, to]) => acc.replace(re, to), s);
    s = s.replace(/\u0000E(\d+)\u0000/g, (_, n) => emails[+n]);
    // exception: the login PLACEHOLDER is brand copy, not a real address — rewrite it
    // at the attribute level (the segment is the whole HTML chunk, not the value).
    s = s.replace(/placeholder="you@spaincos\.com"/g, 'placeholder="you@boundview.com"');
    return s;
  };
  return parts
    .map((seg, i) => (i % 2 === 1 ? seg : scrub(seg)))
    .join("")
    // PWA manifest brand fix (v297 follow-up): boundview.com linked the SHARED
    // /manifest.webmanifest — installing the PWA there would show "ai.spaincos"
    // in the OS app list (brand leak found by the desktop lane). Route the link
    // to the dedicated boundview-manifest.webmanifest (name/icons already live).
    .replace(
      /<link\s+rel="manifest"\s+href="\/manifest\.webmanifest"\s*\/?>/,
      '<link rel="manifest" href="/boundview-manifest.webmanifest">'
    )
    // crawler-visible structured data (data block, not executed — CSP-safe); brand.js skips its copy when present
    .replace("</head>", '<script type="application/ld+json" data-bv="1">' + BV_LD + "</script></head>")
    // v352 (U-ONB-01, batch 33): brand-specific landing value proposition — the shared
    // hero subtitle becomes the BoundView value prop (matches the tagline + description),
    // so the ≤5s first impression states what the product is.
    .replace('<p class="landing-subtitle">Ask anything. Powered by open-weight models.</p>',
      '<p class="landing-subtitle">Ask anything — see the whole picture. AI research with sources, powered by open-weight models.</p>')
    // v351 (U-SEO-02/04, batch 29): crawler-visible STATIC head tags — meta description
    // (118 chars, within the 70–160 window) and the canonical URL, both present in the
    // pre-JS response so non-executing crawlers see them. brand.js skips its runtime
    // duplicates: the canonical link would double up, so it is inserted only here.
    .replace("</title>", "</title>\n" +
      '<meta name="description" content="BoundView — see the whole picture. AI research with sources, and Neurons rewards for verified activity.">\n' +
      '<link rel="canonical" href="https://boundview.com/">');
}

module.exports = async (req, res) => {
  // v291: security headers on every response (the vercel.json headers block does not
  // apply to function-routed paths — the function owns its response headers).
  const headers = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(self), geolocation=()",
  };
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
    const host = String(req.headers.host || "").toLowerCase();
    const isBoundViewHost = /(^|\.)boundview\.com$/.test(host);
    // v322: legal/docs pages are served HOST-AWARE. The old static routes gave
    // boundview.com the raw ai.spaincos terms to every non-JS client (crawler brand
    // leak — the brand-split guard was JavaScript-only). boundview hosts get the
    // dedicated .boundview.html pages; every other host gets the raw page.
    const qpage = String((req.url || "").split("?")[1] || "").match(/page=([a-z-]+)/);
    if (qpage) {
      const page = qpage[1];
      // v328 (RESUME-20261123-1630-BND): Spanish pages routed through this function so
      // the boundview host NEVER serves ai.spaincos-branded bytes. Pinned v326 policy
      // (ES on boundview -> English boundview page) is preserved, but enforced with a
      // SERVER-SIDE 307 instead of the JavaScript-only brand-split guard (which left
      // AI titles/canonicals in the pre-JS response on boundview.com/es/*).
      if (page.startsWith("es-")) {
        const rest = page.slice(3);
        const allowedEs = { terms: 1, privacy: 1, docs: 1, help: 1, status: 1, verify: 1, offline: 1 };
        if (!allowedEs[rest]) { res.writeHead(404, headers); res.end("not found"); return; }
        if (isBoundViewHost) {
          res.writeHead(307, { ...headers, Location: "/" + rest, "Content-Type": "text/plain; charset=utf-8" });
          res.end(req.method === "HEAD" ? undefined : "redirect");
          return;
        }
        const baseEs = `${rest}.es.html`;
        const candsEs = [path.join(__dirname, baseEs), path.join(__dirname, "../" + baseEs), path.join(process.cwd(), baseEs), path.join(process.cwd(), "../" + baseEs)];
        const fEs = candsEs.find((c) => { try { return fs.existsSync(c); } catch { return false; } });
        if (!fEs) { res.writeHead(404, headers); res.end("page not bundled"); return; }
        const htmlEs = fs.readFileSync(fEs, "utf8");
        res.writeHead(200, { ...headers, "Content-Type": "text/html; charset=utf-8" });
        res.end(req.method === "HEAD" ? undefined : htmlEs);
        return;
      }
      const allowed = { terms: 1, privacy: 1, docs: 1, help: 1, status: 1 };
      if (page === "pricing" && !isBoundViewHost) { res.writeHead(404, headers); res.end("not found"); return; }
      if (page === "pricing") allowed.pricing = 1;
      if (!allowed[page]) { res.writeHead(404, headers); res.end("not found"); return; }
      const base = isBoundViewHost ? `${page}.boundview.html` : `${page}.html`;
      const cands = [path.join(__dirname, base), path.join(__dirname, "../" + base), path.join(process.cwd(), base), path.join(process.cwd(), "../" + base)];
      const f = cands.find((c) => { try { return fs.existsSync(c); } catch { return false; } });
      if (!f) { res.writeHead(404, headers); res.end("page not bundled"); return; }
      const html = fs.readFileSync(f, "utf8");
      res.writeHead(200, { ...headers, "Content-Type": "text/html; charset=utf-8" });
      res.end(req.method === "HEAD" ? undefined : html);
      return;
    }
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
    // v290: transform ONLY for boundview hosts — every other host (ai.spaincos.com
    // included, which this same project serves) gets the RAW html. The transform is
    // the BoundView brand kit; applying it to ai.spaincos.com is a brand leak.
    // v351 (U-SEO-06 hardening): non-BoundView hosts get a STATIC crawler-visible
    // noindex in the pre-JS response — the runtime brand.js noindex stays as the
    // safety net, but crawlers that never execute JS now see it too.
    const out = isBoundViewHost
      ? transformHtml(html)
      : html.replace("</title>", '</title>\n<meta name="robots" content="noindex, nofollow">');
    res.writeHead(200, headers);
    res.end(req.method === "HEAD" ? undefined : out);
  } catch (e) {
    // never break the site over branding — fall back to a redirect to the raw asset
    res.writeHead(302, { Location: "/index.html" });
    res.end();
  }
};
