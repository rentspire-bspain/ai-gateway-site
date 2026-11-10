/* ai.spaincos service worker (G6): offline app shell.
   - navigations: network-first, fall back to the cached shell (index.html) when offline
   - same-origin static assets (modules/, icons/, favicon): stale-while-revalidate
   - everything cross-origin (Supabase, gateway, CDNs) and all non-GET: untouched (never cached) */
const VERSION = "v93-shell";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./favicon.webp", "./icons/icon-192.png"]; // icon-512 (78 KB) is no longer precached: it only matters for install and is cached on first request by the stale-while-revalidate branch
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    const nreq = /^\/t\//.test(url.pathname) ? new Request("/index.html") : req; // thread slug deep link -> app shell
    e.respondWith(fetch(nreq).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put("./index.html", copy)).catch(() => {}); }
      return res;
    }).catch(() => caches.match("./index.html").then((r) => r || new Response("<h1>Offline</h1><p>ai.spaincos is offline and has no saved shell yet.</p>", { status: 503, headers: { "Content-Type": "text/html" } }))));
    return;
  }
  e.respondWith(caches.open(VERSION).then((c) => c.match(req).then((hit) => {
    const net = fetch(req).then((res) => { if (res && res.ok) c.put(req, res.clone()).catch(() => {}); return res; }).catch(() => hit);
    return hit || net;
  })));
});
