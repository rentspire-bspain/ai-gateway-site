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
    [/\bspaincos\b/gi, "BoundView"]
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
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null, false);
    while (walker.nextNode()) scrubNode(walker.currentNode);
  }
  function start() {
    scrubAll(document.documentElement);
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
