/* ArtifactLibrary (34d) — entry points for the Artifact Library view in LibraryUI
   (sidebar button #navArtifacts + Settings "Artifacts" pane + window.ArtifactLibrary). */
(function () {
  "use strict";

  var DOC_ICON_PATHS = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>';

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function ensureLibraryLoaded() {
    if (window.LibraryUI && typeof window.LibraryUI.listArtifacts === "function") {
      return Promise.resolve(window.LibraryUI);
    }
    if (typeof window.loadModule === "function") {
      return window.loadModule("library").then(function () { return window.LibraryUI; });
    }
    return Promise.resolve(window.LibraryUI || null);
  }

  function openArtifactLibrary() {
    try { document.body.classList.remove("sidebar-open"); } catch (e) {}
    if (typeof window.openModule === "function") {
      window.openModule("library", "LibraryUI", "open", "artifacts");
      return;
    }
    ensureLibraryLoaded().then(function (lib) {
      if (lib && typeof lib.open === "function") lib.open("artifacts");
    });
  }

  function closeArtifactLibrary() {
    if (window.LibraryUI && typeof window.LibraryUI.close === "function") {
      window.LibraryUI.close();
    }
  }

  function fmtWhen(ts) {
    if (!ts) return "Unknown date";
    return new Date(ts).toLocaleString(undefined, {
      month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit"
    });
  }

  function fmtSize(n) {
    n = Number(n) || 0;
    if (!n) return "";
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + " KB";
    return (n / 1048576).toFixed(1) + " MB";
  }

  var SEC_BTN_STYLE = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border-light,var(--border));border-radius:8px;padding:7px 12px;font:inherit;font-size:12.5px;font-weight:500;cursor:pointer";

  function renderSettingsPane() {
    var pane = document.createElement("div");
    pane.className = "stg-pane";
    pane.innerHTML =
      '<div class="stg-h" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">' +
        '<div><div style="font-size:17px;font-weight:600">Artifact library</div>' +
        '<div style="font-size:12.5px;color:var(--text-muted);margin-top:2px">Generated documents saved to gateway-assets, grouped by filename.</div></div>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
          '<button type="button" style="' + SEC_BTN_STYLE + '" data-stg-art="refresh">Refresh</button>' +
          '<button type="button" class="stg-btn" data-stg-art="full">Open full view</button>' +
        '</div>' +
      '</div>' +
      '<div class="stg-art-list" style="margin-top:14px;display:flex;flex-direction:column;gap:8px">' +
        '<div style="font-size:13px;color:var(--text-muted);padding:12px 0">Loading artifacts\u2026</div>' +
      '</div>';

    var listBox = pane.querySelector(".stg-art-list");

    function loadIntoPane() {
      listBox.innerHTML = '<div style="font-size:13px;color:var(--text-muted);padding:12px 0">Loading artifacts\u2026</div>';
      ensureLibraryLoaded().then(function (lib) {
        if (!lib || typeof lib.listArtifacts !== "function") {
          listBox.innerHTML = '<div style="font-size:13px;color:var(--text-muted)">Artifact library unavailable.</div>';
          return;
        }
        return lib.listArtifacts().then(function (items) {
          if (!items || !items.length) {
            listBox.innerHTML =
              '<div style="padding:18px;border:1px solid var(--border);border-radius:10px;background:var(--bg-surface);color:var(--text-muted);font-size:13px">' +
              'No generated artifacts yet. Files created in chat appear here automatically.' +
              '</div>';
            return;
          }
          listBox.innerHTML = "";
          items.forEach(function (art) {
            var row = document.createElement("div");
            row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--bg-surface);flex-wrap:wrap;cursor:pointer";
            var sz = fmtSize(art.size);
            row.innerHTML =
              '<div style="min-width:0;flex:1">' +
                '<div style="font-size:13.5px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(art.filename) + '</div>' +
                '<div style="font-size:12px;color:var(--text-muted);margin-top:2px">' +
                  esc(art.kindLabel) + (sz ? ' \u00b7 ' + esc(sz) : '') + ' \u00b7 Last modified ' + esc(fmtWhen(art.updatedAt)) +
                '</div>' +
              '</div>' +
              '<div style="display:flex;gap:6px;align-items:center;flex-shrink:0">' +
                '<button type="button" class="stg-btn" data-act="open">Open</button>' +
                '<button type="button" style="' + SEC_BTN_STYLE + '" data-act="regen">Regenerate</button>' +
              '</div>';
            row.addEventListener("click", function (e) {
              var rb = e.target.closest("[data-act=regen]");
              if (rb) { e.stopPropagation(); lib.regenerateArtifact(art); return; }
              var ob = e.target.closest("[data-act=open]");
              if (ob) e.stopPropagation();
              lib.openArtifact(art).catch(function () {});
            });
            listBox.appendChild(row);
          });
        }, function (err) {
          listBox.innerHTML =
            '<div style="padding:14px;border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:13px">' +
            esc(err && err.message ? err.message : "Sign in to view your generated artifacts.") +
            '</div>';
        });
      });
    }

    pane.querySelector('[data-stg-art="refresh"]').onclick = loadIntoPane;
    pane.querySelector('[data-stg-art="full"]').onclick = function () {
      if (window.SettingsUI && typeof window.SettingsUI.close === "function") window.SettingsUI.close();
      openArtifactLibrary();
    };
    loadIntoPane();
    return pane;
  }

  function wire() {
    var navLib = document.getElementById("navLibrary");
    if (navLib && navLib.parentNode && !document.getElementById("navArtifacts")) {
      var btn = document.createElement("button");
      btn.className = "side-nav-btn";
      btn.id = "navArtifacts";
      btn.type = "button";
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + DOC_ICON_PATHS + '</svg><span>Artifacts</span>';
      btn.addEventListener("click", openArtifactLibrary);
      navLib.insertAdjacentElement("afterend", btn);
    }
    if (window.SettingsUI && typeof window.SettingsUI.registerPane === "function") {
      window.SettingsUI.registerPane({
        id: "artifacts",
        label: "Artifacts",
        icon: DOC_ICON_PATHS,
        render: renderSettingsPane,
        after: "usage"
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();

  window.ArtifactLibrary = {
    open: openArtifactLibrary,
    close: closeArtifactLibrary,
    list: function () { return ensureLibraryLoaded().then(function (l) { return l ? l.listArtifacts() : []; }); },
    openArtifact: function (art) { return ensureLibraryLoaded().then(function (l) { return l ? l.openArtifact(art) : null; }); },
    regenerate: function (art) { return ensureLibraryLoaded().then(function (l) { return l ? l.regenerateArtifact(art) : ""; }); }
  };
})();
