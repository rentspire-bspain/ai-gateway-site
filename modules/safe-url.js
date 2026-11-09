/* safe-url.js — URL scheme validation and DOMPurify hardening. Load right after purify.min.js.
   SafeUrl.http(u)      -> normalised http(s) URL string or "" (blocks javascript:, data:, vbscript:, blob:, file:)
   SafeUrl.install(DP)  -> DOMPurify hook: anchors get http(s)/mailto/#only + rel/target; <img> may only load
                           data:image/{png,jpeg,gif,webp} or same-origin; external <img> is replaced by a text link,
                           which closes the "render an image to exfiltrate data in the query string" channel. */
(function (root) {
  "use strict";
  function http(u, base) {
    try { var x = new URL(String(u == null ? "" : u).trim(), base || (root.location && root.location.href) || undefined);
      return (x.protocol === "http:" || x.protocol === "https:") ? x.toString() : ""; } catch (e) { return ""; }
  }
  function sameOrigin(u) { try { return new URL(u, root.location.href).origin === root.location.origin; } catch (e) { return false; } }
  function install(DP) {
    if (!DP || DP.__safeUrlInstalled) return;
    DP.__safeUrlInstalled = true;
    DP.addHook("afterSanitizeAttributes", function (node) {
      if (!node || !node.tagName) return;
      var tag = node.tagName.toLowerCase();
      if (tag === "a" && node.hasAttribute("href")) {
        var h = node.getAttribute("href");
        if (h.charAt(0) !== "#" && !/^mailto:/i.test(h) && !http(h)) node.removeAttribute("href");
        else if (h.charAt(0) !== "#") { node.setAttribute("target", "_blank"); node.setAttribute("rel", "noopener noreferrer nofollow"); }
      }
      if (tag === "img") {
        var s = node.getAttribute("src") || "";
        var ok = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+\/=]+$/i.test(s) || (http(s) && sameOrigin(s));
        if (!ok) {
          var ext = http(s);
          if (ext && node.parentNode) {
            var a = node.ownerDocument.createElement("a"); a.setAttribute("href", ext); a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer nofollow");
            a.textContent = "[image: " + (node.getAttribute("alt") || new URL(ext).hostname) + "]";
            node.parentNode.replaceChild(a, node);
          } else if (node.parentNode) node.parentNode.removeChild(node);
        }
      }
    });
  }
  var api = { http: http, install: install };
  if (root.DOMPurify) install(root.DOMPurify); // auto-install when loaded after purify.min.js
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.SafeUrl = api;
})(typeof window !== "undefined" ? window : globalThis);
