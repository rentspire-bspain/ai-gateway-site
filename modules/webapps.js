/* Webapps explorer (Parity doc §34e) — per-webapp schema/ontology tools for ai.spaincos.com.
   Makes each webapp's stack explicit and inspectable: frontend domain, backend/DB project ref,
   repo (when known), status, and an expandable per-webapp detail card with a schema browser
   placeholder. Reads the ship-only SQL in sql/webapp_registry.sql (public.webapp_stack view +
   public.list_webapp_schemas RPC stub) over the fleet_registry REST endpoint.
   Entry points: sidebar "Webapps" button (#navWebapps) + Settings "Webapps" pane + window.WebappsUI.
   The Webapps page/tab is reachable through the sidebar and Settings; it is NOT a new top-level
   module in index.html's on-demand MODS map (the sidebar button is injected by this script,
   following the external-script pattern of modules/artifact-library.js). */
(function (root) {
  "use strict";

  // ---- pure helpers (unit-tested) ----

  var ESC_MAP = {};
  ESC_MAP["&"] = "&"; ESC_MAP["<"] = "<"; ESC_MAP[">"] = ">"; ESC_MAP['"'] = '"'; ESC_MAP["'"] = "&#39;";
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ESC_MAP[c];
    });
  }

  // Which fleet_registry kinds are webapps (kept in sync with sql/webapp_registry.sql)
  var WEBAPP_KINDS = { webapp: 1, web_app: 1 };

  function isWebappKind(kind) {
    return !!WEBAPP_KINDS[String(kind || "").toLowerCase()];
  }

  // Extract the webapp rows from a fleet_registry fetch result.
  function selectWebapps(rows) {
    return (rows || []).filter(function (r) { return isWebappKind(r && r.kind); });
  }

  // Attach the DB-side row (kind=database-ish, same project_ref) to each webapp row.
  function attachDbSide(webapps, allRows) {
    var byProject = {};
    (allRows || []).forEach(function (r) {
      if (!r || !r.project_ref) return;
      var k = String(r.kind || "").toLowerCase();
      if (k !== "supabase_db" && k !== "database" && k !== "db") return;
      if (!byProject[r.project_ref]) byProject[r.project_ref] = r;
    });
    return (webapps || []).map(function (w) {
      var d = w.project_ref ? byProject[w.project_ref] : null;
      return {
        id: w.id,
        kind: w.kind,
        name: w.name,
        parent: w.parent || null,
        project_ref: w.project_ref || null,
        domain: w.domain || null,
        description: w.description || "",
        status: w.status || "",
        schedule: w.schedule || "",
        owner: w.owner || "",
        updated_at: w.updated_at || "",
        db_fleet_id: d ? d.id : null,
        db_name: d ? d.name : null,
        db_status: d ? d.status : null,
        db_updated_at: d ? d.updated_at : null
      };
    });
  }

  // Derive a repo guess from the domain (github.com/<owner>/<repo> shape is unknown
  // without the additive repo_url column, so we keep this honest: null until known).
  function repoFor(w) {
    return w && w.repo_url ? String(w.repo_url) : null;
  }

  var SCHEMA_NOTES_REQUIRES_CREDENTIALS = "Schema introspection requires per-project credentials.";

  function summarizeStacks(list) {
    var out = { total: 0, withDb: 0, withDomain: 0, live: 0, paused: 0 };
    (list || []).forEach(function (w) {
      out.total += 1;
      if (w.db_project_ref || w.project_ref) out.withDb += 1;
      if (w.domain || w.frontend_domain) out.withDomain += 1;
      if (w.status === "live") out.live += 1;
      else if (w.status === "paused") out.paused += 1;
    });
    return out;
  }

  // Render a webapp's stack table rows (schema browser placeholder).
  // Rows with counts appear only when the per-project connection exists (it does not yet).
  function schemaBrowserHtml(w) {
    var counts = w && w.schema_counts;
    if (counts && (counts.schemas != null || counts.tables != null)) {
      return '<table class="wa-schema-table"><caption>' + esc(SCHEMA_NOTES_REQUIRES_CREDENTIALS) +
        " Counts below are from the governed per-project connection.</caption><tbody>" +
        "<tr><th>Schemas</th><td>" + esc(counts.schemas) + "</td></tr>" +
        "<tr><th>Tables</th><td>" + esc(counts.tables) + "</td></tr>" +
        "<tr><th>Views</th><td>" + esc(counts.views) + "</td></tr>" +
        "<tr><th>RPCs</th><td>" + esc(counts.rpcs) + "</td></tr></tbody></table>";
    }
    return '<p class="wa-schema-notice">' + esc(SCHEMA_NOTES_REQUIRES_CREDENTIALS) +
      " The <code>list_webapp_schemas</code> RPC stub returns an honest not-wired payload " +
      "until a governed per-project connection is provisioned (see <code>sql/webapp_registry.sql</code>).</p>";
  }

  function statusDotClass(status) {
    if (status === "live") return "wa-dot-live";
    if (status === "paused") return "wa-dot-paused";
    return "wa-dot-other";
  }

  function fmtWhen(ts) {
    if (!ts) return "";
    var d = new Date(ts);
    return isNaN(d.getTime()) ? String(ts) : d.toLocaleString();
  }

  var pureApi = {
    WEBAPP_KINDS: WEBAPP_KINDS,
    isWebappKind: isWebappKind,
    selectWebapps: selectWebapps,
    attachDbSide: attachDbSide,
    repoFor: repoFor,
    summarizeStacks: summarizeStacks,
    schemaBrowserHtml: schemaBrowserHtml,
    statusDotClass: statusDotClass,
    fmtWhen: fmtWhen
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = pureApi;
    return;
  }

  // ---- DOM/UI layer (not unit-tested; mirrors modules/artifact-library.js) ----

  var SB_REST = "https://bnxermyboeigvwonfrzx.supabase.co/rest/v1";
  var ANON = "sb_publishable_nrmUxUfyytgCscz8zfQ9Cw_LapbvKIb";
  var REGISTRY_URL = SB_REST + "/fleet_registry?select=id,kind,name,parent,project_ref,domain,description,status,schedule,owner,updated_at&order=name.asc&limit=1000";
  var STACK_URL = SB_REST + "/webapp_stack?select=*&order=webapp_name.asc&limit=500";

  var APP_ICON_PATHS = '<path d="M3 3h18v12H3z"/><path d="M3 9h18M9 3v6M15 3v6"/><path d="M8 21h8M12 15v6"/>';

  function getSessionToken() {
    var client = (typeof sb !== "undefined") ? sb : ((root.__appGlobals && root.__appGlobals.sb) || root.sb);
    if (!client || !client.auth || typeof client.auth.getSession !== "function") {
      return Promise.resolve(null);
    }
    return client.auth.getSession().then(function (r) {
      var sess = r && r.data && r.data.session;
      return sess && sess.access_token ? sess.access_token : null;
    }).catch(function () { return null; });
  }

  function injectStyles() {
    if (document.getElementById("wa-styles")) return;
    var st = document.createElement("style");
    st.id = "wa-styles";
    st.textContent = [
      ".wa-root{position:fixed;inset:0;z-index:900;background:var(--bg);color:var(--text);font-family:var(--font-sans);display:flex;flex-direction:column;overflow:hidden}",
      ".wa-head{display:flex;align-items:center;gap:16px;padding:14px 24px;border-bottom:1px solid var(--border)}",
      ".wa-head h2{font-size:18px;font-weight:600;margin:0}",
      ".wa-sub{color:var(--text-muted);font-size:13px;margin-top:2px}",
      ".wa-grow{flex:1;min-width:0}",
      ".wa-x{background:none;border:0;color:var(--text-muted);font-size:22px;cursor:pointer;padding:4px 10px;border-radius:var(--radius-sm)}",
      ".wa-x:hover{background:var(--bg-elevated);color:var(--text)}",
      ".wa-body{flex:1;overflow-y:auto;padding:24px}",
      ".wa-wrap{max-width:1000px;margin:0 auto}",
      ".wa-msg{text-align:center;color:var(--text-muted)}",
      ".wa-h{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--accent);margin:22px 0 10px}",
      ".wa-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}",
      ".wa-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px}",
      ".wa-ct{display:flex;align-items:center;gap:8px;font-size:13px}",
      ".wa-m{color:var(--text-muted);font-size:12px;margin-top:4px}",
      ".wa-dot{width:8px;height:8px;border-radius:50%;flex:none;background:var(--text-muted)}",
      ".wa-dot-live{background:#2e9e5b}.wa-dot-paused{background:#c98a1b}.wa-dot-other{background:#4a7fd0}",
      ".wa-detail{border-top:1px solid var(--border);margin-top:10px;padding-top:10px}",
      ".wa-detail summary{cursor:pointer;color:var(--accent);font-weight:600;font-size:13px;user-select:none}",
      ".wa-schema-table{margin-top:10px;border-collapse:collapse;width:100%;font-size:12.5px}",
      ".wa-schema-table th{text-align:left;color:var(--text-muted);font-weight:600;padding:4px 12px 4px 0;white-space:nowrap}",
      ".wa-schema-table td{color:var(--text);padding:4px 0}",
      ".wa-schema-table caption{text-align:left;color:var(--text-muted);font-size:11.5px;padding-bottom:6px}",
      ".wa-schema-notice{margin-top:10px;padding:10px 12px;border:1px dashed var(--border-light,var(--border));border-radius:var(--radius-sm);color:var(--text-muted);font-size:12.5px;line-height:1.5;background:var(--bg-surface)}",
      ".wa-schema-notice code{font-family:var(--font-mono,monospace);font-size:11.5px;color:var(--text)}",
      ".wa-kv{display:grid;grid-template-columns:110px 1fr;gap:4px 12px;font-size:12.5px;margin-top:8px}",
      ".wa-kv dt{color:var(--text-muted);font-weight:600}",
      ".wa-kv dd{margin:0;color:var(--text);overflow-wrap:anywhere}",
      ".wa-badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid var(--border)}",
      ".wa-badge-ok{background:rgba(46,158,91,.14);color:#3ec472;border-color:rgba(46,158,91,.3)}",
      "[data-theme=\"light\"] .wa-badge-ok{color:#1d7540}",
      ".wa-badge-miss{background:rgba(201,138,27,.14);color:#d9a441;border-color:rgba(201,138,27,.3)}",
      "[data-theme=\"light\"] .wa-badge-miss{color:#8a6416}"
    ].join("\n");
    document.head.appendChild(st);
  }

  var el = null, rows = [], st = { loading: true, error: "", expanded: {} };

  // Load: try the webapp_stack view first (when the ship-only SQL has been applied),
  // fall back to the fleet_registry REST endpoint and derive webapps client-side.
  function load() {
    st.loading = true; st.error = "";
    render();
    return getSessionToken().then(function (tok) {
      if (!tok) throw new Error("Please sign in to view webapps.");
      return fetch(STACK_URL, { headers: { Authorization: "Bearer " + tok, apikey: ANON } })
        .then(function (res) {
          if (res.status === 404) return null; // view not applied yet — fall back below
          return res.json().then(function (j) {
            if (!res.ok || !Array.isArray(j)) throw new Error((j && j.message) || "Request failed (" + res.status + ")");
            return j;
          });
        })
        .then(function (viewRows) {
          if (viewRows && viewRows.length) return viewRows;
          // fall back: derive from fleet_registry client-side
          return fetch(REGISTRY_URL, { headers: { Authorization: "Bearer " + tok, apikey: ANON } })
            .then(function (res) {
              if (res.status === 404) throw new Error("The fleet registry is not set up yet.");
              return res.json().then(function (j) {
                if (!res.ok || !Array.isArray(j)) throw new Error((j && j.message) || "Request failed (" + res.status + ")");
                return null; // signal: use allRows fetched via REGISTRY_URL
              });
            })
            .then(function () { return null; });
        })
        .then(function (viewRows) {
          if (viewRows) { rows = viewRows; return; }
          // derive webapps from the raw fleet_registry fetch
          return fetch(REGISTRY_URL, { headers: { Authorization: "Bearer " + tok, apikey: ANON } })
            .then(function (res) { return res.json(); })
            .then(function (j) {
              var all = Array.isArray(j) ? j : [];
              rows = attachDbSide(selectWebapps(all), all);
            });
        });
    }).catch(function (e) {
      st.error = e && e.message ? e.message : String(e);
    }).then(function () {
      st.loading = false; render();
    });
  }

  function card(w) {
    var db = w.db_project_ref || w.project_ref;
    var repo = repoFor(w);
    return '<div class="wa-card"><div class="wa-ct"><span class="wa-dot ' + statusDotClass(w.status) + '"></span><b>' + esc(w.name) + '</b>' +
      '<span class="wa-badge ' + (db ? "wa-badge-ok" : "wa-badge-miss") + '">' + (db ? "DB known" : "DB unknown") + "</span></div>" +
      '<div class="wa-m">' + esc(String(w.status).replace("_", " ")) +
      (w.domain ? " · <a href=\"https://" + esc(w.domain) + "\" target=\"_blank\" rel=\"noopener noreferrer\">" + esc(w.domain) + "</a>" : "") +
      (db ? " · " + esc(String(db).slice(0, 8)) : "") + "</div>" +
      '<details class="wa-detail" data-wid="' + esc(w.id) + '"><summary>Stack & schema</summary>' +
      '<dl class="wa-kv">' +
      "<dt>Frontend</dt><dd>" + (w.domain ? '<a href="https://' + esc(w.domain) + '" target="_blank" rel="noopener noreferrer">' + esc(w.domain) + "</a>" : "—") + "</dd>" +
      "<dt>Backend / DB</dt><dd>" + (db ? "<code>" + esc(db) + "</code>" + (w.db_name ? " (" + esc(w.db_name) + ")" : "") : "—") + "</dd>" +
      "<dt>Repo</dt><dd>" + (repo ? '<a href="' + esc(repo) + '" target="_blank" rel="noopener noreferrer">' + esc(repo) + "</a>" : "not in registry yet") + "</dd>" +
      "<dt>Status</dt><dd>" + esc(w.status || "—") + "</dd>" +
      "<dt>Updated</dt><dd>" + esc(fmtWhen(w.updated_at)) + "</dd>" +
      "</dl>" +
      '<h4 style="font-size:12px;font-weight:700;color:var(--text-muted);margin:12px 0 0;text-transform:uppercase;letter-spacing:.05em">Schema browser</h4>' +
      schemaBrowserHtml(w) +
      "</details></div>";
  }

  function render() {
    if (!el) return;
    var body = el.querySelector(".wa-body");
    if (st.loading) { body.innerHTML = '<p class="wa-msg">Loading webapps…</p>'; return; }
    if (st.error) { body.innerHTML = '<p class="wa-msg">' + esc(st.error) + ' <button type="button" class="wa-rf" style="margin-left:8px">Retry</button></p>'; return; }
    if (!rows.length) { body.innerHTML = '<p class="wa-msg">No webapps registered yet. Add fleet_registry rows with kind=webapp to see them here.</p>'; return; }
    var s = summarizeStacks(rows);
    body.innerHTML = '<div class="wa-wrap">' +
      '<h3 class="wa-h">Webapps (' + rows.length + ") · " + s.withDb + " with DB · " + s.withDomain + " with domain</h3>" +
      '<div class="wa-grid">' + rows.map(card).join("") + "</div>" +
      '<p class="wa-m" style="margin-top:18px">Counts from <code>list_webapp_schemas</code> require a governed per-project connection; until then, each card shows the webapp stack and an honest placeholder. SQL: <code>sql/webapp_registry.sql</code>.</p>' +
      "</div>";
  }

  function onKey(e) { if (e.key === "Escape") close(); }

  function open() {
    if (el) { render(); return; }
    injectStyles();
    el = document.createElement("div");
    el.className = "wa-root";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "Webapps");
    el.innerHTML = '<div class="wa-head"><div class="wa-grow"><h2>Webapps</h2><div class="wa-sub">Per-webapp stack, database and schema tools</div></div><button class="wa-x" aria-label="Close">×</button></div><div class="wa-body"></div>';
    (document.getElementById("moduleRoot") || document.body).appendChild(el);
    el.addEventListener("click", function (e) {
      if (e.target.classList.contains("wa-x")) close();
      if (e.target.classList.contains("wa-rf")) load();
    });
    document.addEventListener("keydown", onKey);
    load();
  }

  function close() {
    if (!el) return;
    document.removeEventListener("keydown", onKey);
    el.remove();
    el = null;
  }

  // ---- sidebar button + Settings pane (external-script pattern from artifact-library.js) ----

  var SEC_BTN_STYLE = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border-light,var(--border));border-radius:8px;padding:7px 12px;font:inherit;font-size:12.5px;font-weight:500;cursor:pointer";

  function renderSettingsPane() {
    var pane = document.createElement("div");
    pane.className = "stg-pane";
    pane.innerHTML =
      '<div class="stg-h" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">' +
        '<div><div style="font-size:17px;font-weight:600">Webapps</div>' +
        '<div style="font-size:12.5px;color:var(--text-muted);margin-top:2px">Each webapp\u2019s frontend, database project, and schema tools.</div></div>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
          '<button type="button" style="' + SEC_BTN_STYLE + '" data-stg-wa="refresh">Refresh</button>' +
          '<button type="button" class="stg-btn" data-stg-wa="full">Open full view</button>' +
        "</div>" +
      "</div>" +
      '<div class="stg-wa-list" style="margin-top:14px;display:flex;flex-direction:column;gap:8px"></div>';

    var listBox = pane.querySelector(".stg-wa-list");

    function loadIntoPane() {
      listBox.innerHTML = '<div style="font-size:13px;color:var(--text-muted);padding:12px 0">Loading webapps…</div>';
      getSessionToken().then(function (tok) {
        if (!tok) {
          listBox.innerHTML = '<div style="font-size:13px;color:var(--text-muted)">Sign in to view your webapps.</div>';
          return;
        }
        return fetch(STACK_URL, { headers: { Authorization: "Bearer " + tok, apikey: ANON } })
          .then(function (res) {
            if (res.status === 404) return null;
            return res.json().then(function (j) {
              if (!res.ok || !Array.isArray(j)) throw new Error((j && j.message) || "Request failed (" + res.status + ")");
              return j;
            });
          })
          .then(function (viewRows) {
            if (viewRows && viewRows.length) return viewRows;
            return fetch(REGISTRY_URL, { headers: { Authorization: "Bearer " + tok, apikey: ANON } })
              .then(function (res) { return res.json(); })
              .then(function (j) {
                var all = Array.isArray(j) ? j : [];
                return attachDbSide(selectWebapps(all), all);
              });
          });
      }).then(function (list) {
        if (!list) return;
        if (!list.length) {
          listBox.innerHTML =
            '<div style="padding:18px;border:1px solid var(--border);border-radius:10px;background:var(--bg-surface);color:var(--text-muted);font-size:13px">' +
            "No webapps registered yet.</div>";
          return;
        }
        listBox.innerHTML = "";
        list.forEach(function (w) {
          var row = document.createElement("div");
          row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--bg-surface);flex-wrap:wrap";
          var db = w.db_project_ref || w.project_ref;
          row.innerHTML =
            '<div style="min-width:0;flex:1">' +
              '<div style="font-size:13.5px;font-weight:600;color:var(--text)">' + esc(w.name) + "</div>" +
              '<div style="font-size:12px;color:var(--text-muted);margin-top:2px">' +
                esc(w.domain || "no domain") + " · DB " + (db ? "<code>" + esc(String(db).slice(0, 8)) + "</code>" : "unknown") +
              "</div>" +
            "</div>" +
            '<div style="display:flex;gap:6px;align-items:center;flex-shrink:0">' +
              '<span class="wa-badge ' + (db ? "wa-badge-ok" : "wa-badge-miss") + '">' + (db ? "DB known" : "DB unknown") + "</span>" +
            "</div>";
          listBox.appendChild(row);
        });
      }, function (err) {
        listBox.innerHTML =
          '<div style="padding:14px;border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:13px">' +
          esc(err && err.message ? err.message : "Sign in to view your webapps.") + "</div>";
      });
    }

    pane.querySelector('[data-stg-wa="refresh"]').onclick = loadIntoPane;
    pane.querySelector('[data-stg-wa="full"]').onclick = function () {
      if (window.SettingsUI && typeof window.SettingsUI.close === "function") window.SettingsUI.close();
      open();
    };
    loadIntoPane();
    return pane;
  }

  function wire() {
    // sidebar: insert a "Webapps" button after the Fleet button (matches #navFleet)
    var navFleet = document.getElementById("navFleet");
    if (navFleet && navFleet.parentNode && !document.getElementById("navWebapps")) {
      var btn = document.createElement("button");
      btn.className = "side-nav-btn";
      btn.id = "navWebapps";
      btn.type = "button";
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + APP_ICON_PATHS + '</svg><span>Webapps</span>';
      btn.addEventListener("click", open);
      navFleet.insertAdjacentElement("afterend", btn);
    }
    // Settings pane
    if (window.SettingsUI && typeof window.SettingsUI.registerPane === "function") {
      window.SettingsUI.registerPane({
        id: "webapps",
        label: "Webapps",
        icon: APP_ICON_PATHS,
        render: renderSettingsPane,
        after: "usage"
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();

  root.WebappsUI = {
    open: open,
    close: close,
    // pure API also exposed for tests / other modules
    isWebappKind: isWebappKind,
    selectWebapps: selectWebapps,
    attachDbSide: attachDbSide,
    repoFor: repoFor,
    summarizeStacks: summarizeStacks,
    schemaBrowserHtml: schemaBrowserHtml,
    statusDotClass: statusDotClass,
    fmtWhen: fmtWhen
  };
})(typeof window !== "undefined" ? window : globalThis);
