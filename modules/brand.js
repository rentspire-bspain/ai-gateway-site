// v269 BRAND SEPARATION (owner directive 2026-11-18): ai.spaincos.com and BoundView.com
// share the ENTIRE capability estate (gateway, tools, skills, benchmarks, performance) but
// the brands are COMPLETELY SEPARATE. Zero cross-mentions on BoundView: no ai.spaincos.com,
// no Spain Companies, no spaincos emails — nothing that shows affiliation.
//
// This module runs FIRST (before every other script). It defines window.BRAND from the
// hostname and installs a DOM scrub that guarantees the rendered BoundView UI never shows
// the other brand, no matter what a shared string in the codebase says.
(function () {
  var host = (location.hostname || "").toLowerCase();
  var isBV = host.indexOf("boundview") !== -1;
  window.BRAND = isBV
    ? { name: "BoundView", short: "BoundView", domain: "boundview.com", company: "BoundView",
        supportEmail: "support@boundview.com", title: "BoundView", tagline: "BoundView — see the whole picture.",
        isBoundView: true }
    : { name: "ai.spaincos.com", short: "ai.spaincos", domain: "ai.spaincos.com", company: "Spain Companies",
        supportEmail: "bspain@spaincos.com", title: "ai.spaincos.com — Where knowledge begins", tagline: "Where knowledge begins",
        isBoundView: false };

  // ---- BoundView scrub: the rendered UI must carry ZERO other-brand strings ----
  if (!isBV) return;
  var MAP = [
    [/ai\.spaincos\.com/gi, "BoundView"],
    [/ai-spaincos/gi, "BoundView"],
    [/spaincos-icon\.svg/gi, "boundview-icon.svg"],
    [/Spain Companies/gi, "BoundView"],
    [/spaincos\.com/gi, "boundview.com"],
    [/@spaincos/gi, "@boundview"],
    [/you@boundview\.com/gi, "you@boundview.com"],
    [/\bspaincos\b/gi, "BoundView"],
    // cosmetic final pass: "ai.spaincos" -> "ai.BoundView" reads awkward; it's just "BoundView"
    [/ai\.BoundView\b/gi, "BoundView"]
  ];
  function scrubText(t) {
    var out = t;
    for (var i = 0; i < MAP.length; i++) out = out.replace(MAP[i][0], MAP[i][1]);
    return out;
  }
  function scrubNode(node) {
    try {
      if (node.nodeType === 3) { // text node
        var s = scrubText(node.nodeValue || "");
        if (s !== node.nodeValue) node.nodeValue = s;
      } else if (node.nodeType === 1) { // element
        var attrs = node.attributes;
        for (var i = 0; i < attrs.length; i++) {
          var a = attrs[i];
          var v = a.nodeValue || "";
          var nv = scrubText(v);
          if (nv !== v) a.nodeValue = nv;
        }
        // swap the brand icon asset
        if (node.tagName === "IMG" && /spaincos-icon/i.test(node.getAttribute("src") || "")) {
          node.setAttribute("src", "/boundview-icon.svg");
        }
      }
    } catch (e) { /* never break the page over branding */ }
  }
  function scrubAll(root) {
    if (!root) return;
    // v274 FIX: the walker never visits the ROOT node itself — dynamically-set text
    // (modules writing textContent on existing elements) arrived as added TEXT-node
    // roots and escaped the scrub (live-verified: "Welcome to ai.spaincos" survived
    // on boundview.com). Scrub the root first, then its descendants.
    scrubNode(root);
    if (root.nodeType === 1) {
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null, false);
      while (walker.nextNode()) scrubNode(walker.currentNode);
    }
  }
  // ---- v281 BOUNDVIEW BRAND ASSETS: swap the static brand links (favicon set,
  // apple-touch-icon, PWA manifest, og:image) to the BoundView kit. Same runtime
  // pattern as the icon swap — the files ship in the repo; only boundview.com
  // requests them. Crawler note: social previews read og:image without JS, so
  // boundview.com's og:image also needs the Vercel headers pass (see doc §30h).
  function swapLinks() {
    try {
      var links = document.head ? document.head.getElementsByTagName("link") : [];
      for (var i = 0; i < links.length; i++) {
        var l = links[i];
        var rel = (l.getAttribute("rel") || "").toLowerCase();
        var href = l.getAttribute("href") || "";
        if (/icon|apple-touch|manifest/.test(rel)) {
          if (/(spaincos|favicon\.png|favicon\.webp|apple-touch-icon\.png|icons\/icon-|manifest\.webmanifest)/i.test(href)) {
            if (/apple-touch/.test(rel)) l.setAttribute("href", "/icons/boundview-apple-touch-icon.png");
            else if (/manifest/.test(rel)) l.setAttribute("href", "/boundview-manifest.webmanifest");
            else if (/\.png/i.test(href)) l.setAttribute("href", "/icons/boundview-favicon-48.png");
            else l.setAttribute("href", "/boundview-icon.svg");
          }
        }
      }
      if (document.head) {
        var metas = document.head.getElementsByTagName("meta");
        for (var j = 0; j < metas.length; j++) {
          var mp = (metas[j].getAttribute("property") || "") + (metas[j].getAttribute("name") || "");
          if (/og:image|twitter:image/i.test(mp)) metas[j].setAttribute("content", "/icons/boundview-og-image.png");
        }
      }
    } catch (e) { /* never break the page over branding */ }
  }

  function start() {
    scrubAll(document.documentElement);
    swapLinks();
    document.title = window.BRAND.title;
    // keep it clean: any dynamically-inserted UI gets scrubbed too
    if (window.MutationObserver) {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var m = muts[i];
          if (m.addedNodes && m.addedNodes.length) {
            for (var j = 0; j < m.addedNodes.length; j++) scrubAll(m.addedNodes[j]);
          }
          if (m.type === "characterData" && m.target) scrubNode(m.target);
        }
      }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
