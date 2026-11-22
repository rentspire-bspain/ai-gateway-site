// Shared pure helpers for the service worker (importScripts), the side panel (<script>) and node unit tests.
// No DOM and no chrome.* access in here, so everything is testable under plain node.
(function (root) {
  "use strict";

  // First-party origins the panel may embed. Anything else stored in settings falls back to the default,
  // so a corrupted or tampered storage value can never point the iframe at a third-party site.
  const SITES = ["https://ai.spaincos.com", "https://boundview.com"];
  const DEFAULTS = Object.freeze({ site: SITES[0], model: "", includePage: true, includeSelection: true });
  const MAX_SELECTION = 2000;
  const MAX_TITLE = 200;
  const MAX_QUESTION = 1000;
  const MODEL_RE = /^[A-Za-z0-9._-]{1,64}$/;

  function clean(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }
  function clip(s, n) { s = clean(s); return s.length > n ? s.slice(0, n) + "\u2026" : s; }

  function normalizeSettings(raw) {
    const r = raw && typeof raw === "object" ? raw : {};
    return {
      site: SITES.indexOf(r.site) >= 0 ? r.site : DEFAULTS.site,
      model: typeof r.model === "string" && MODEL_RE.test(r.model) ? r.model : "",
      includePage: typeof r.includePage === "boolean" ? r.includePage : DEFAULTS.includePage,
      includeSelection: typeof r.includeSelection === "boolean" ? r.includeSelection : DEFAULTS.includeSelection
    };
  }

  function isShareableUrl(u) { return /^https?:\/\//i.test(String(u || "")); }

  // Context-menu / command question (unchanged wording from v1.1.x so existing behaviour is preserved).
  function buildQuestion(info, tab) {
    const url = clean((info && info.pageUrl) || (tab && tab.url));
    const title = clip(tab && tab.title, MAX_TITLE);
    const where = title ? `"${title}" (${url})` : url;
    if (info && info.menuItemId === "ask-selection" && info.selectionText) {
      return `Explain this text selected on ${where}: "${clip(info.selectionText, MAX_SELECTION)}"`;
    }
    return `Read and summarize this page: ${where}`;
  }

  // Panel question with clearly labelled browser context. The site's composer is single-line, so one line.
  // ctx: { title, url, selection }, opts: { includePage, includeSelection }
  function buildContextQuestion(question, ctx, opts) {
    const q = clip(question, MAX_QUESTION);
    const o = Object.assign({ includePage: true, includeSelection: true }, opts || {});
    const c = ctx || {};
    const parts = [];
    if (o.includePage && isShareableUrl(c.url)) {
      const title = clip(c.title, MAX_TITLE);
      parts.push(title ? `Page: "${title}" (${clean(c.url)})` : `Page: ${clean(c.url)}`);
    }
    const sel = o.includeSelection ? clip(c.selection, MAX_SELECTION) : "";
    if (sel) parts.push(`Selected text: "${sel}"`);
    if (!parts.length) return q;
    return `[Context from my browser tab \u2014 ${parts.join(". ")}] My question: ${q || "Explain this."}`;
  }

  // One-click summary: same wording as the context menu so both entry points hit one code path.
  function buildSummaryQuestion(ctx) {
    const c = ctx || {};
    if (!isShareableUrl(c.url)) return "";
    return buildQuestion({ menuItemId: "ask-page", pageUrl: c.url }, { url: c.url, title: c.title });
  }

  // Dynamic declarativeNetRequest rule: the site now sends X-Frame-Options: DENY and CSP frame-ancestors 'none'
  // (vercel.json, 2026-11-22), which blocks the side-panel iframe. Strip them ONLY for sub-frames requested by
  // this extension's own pages, keeping the rest of the server CSP (object-src/base-uri).
  function frameRules(extId) {
    return [{
      id: 1,
      priority: 1,
      action: {
        type: "modifyHeaders",
        responseHeaders: [
          { header: "x-frame-options", operation: "remove" },
          { header: "content-security-policy", operation: "set", value: "object-src 'none'; base-uri 'none'" }
        ]
      },
      condition: {
        requestDomains: SITES.map((s) => s.replace("https://", "")),
        resourceTypes: ["sub_frame"],
        initiatorDomains: [String(extId)]
      }
    }];
  }

  // Keep only well-formed {value,label} model options reported by the site bridge.
  function sanitizeModelOptions(list) {
    if (!Array.isArray(list)) return [];
    const out = [];
    for (const o of list.slice(0, 60)) {
      if (o && typeof o.value === "string" && MODEL_RE.test(o.value)) out.push({ value: o.value, label: clip(o.label || o.value, 80) });
    }
    return out;
  }

  const api = { SITES, DEFAULTS, MAX_SELECTION, MAX_TITLE, MAX_QUESTION, clean, clip, normalizeSettings, isShareableUrl,
    buildQuestion, buildContextQuestion, buildSummaryQuestion, frameRules, sanitizeModelOptions };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.AISC = api;
})(typeof self !== "undefined" ? self : this);
