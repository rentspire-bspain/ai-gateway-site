/* settings-mcp.js — v170 Settings panes: "Training data" + "MCP servers".
   Registers into SettingsUI (settings.js). Vanilla JS, no framework.
   - Training data: default-ON consent toggle -> public.set_training_consent RPC (training ON by default, owner directive 2026-11-11).
     Gracefully degrades when the RPC is not yet deployed (shows "coming soon" state, never errors the user).
   - MCP servers: user-registered Model Context Protocol servers -> the `mcp` edge function
     (list_servers / add_server / remove_server / list_tools as a test). */
(function () {
  "use strict";

  function client() { return (typeof sb !== "undefined") ? sb : null; }
  function esc(s) { var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }
  function mcpUrl() { return "https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/mcp"; }

  function authHeaders() {
    var c = client();
    if (!c || !c.auth) return Promise.resolve(null);
    return c.auth.getSession().then(function (r) {
      var t = r && r.data && r.data.session && r.data.session.access_token;
      if (!t) return null;
      return { "Authorization": "Bearer " + t, "apikey": (typeof SUPABASE_ANON !== "undefined" ? SUPABASE_ANON : ""), "Content-Type": "application/json" };
    });
  }
  async function mcp(action, extra) {
    var h = await authHeaders();
    if (!h) throw new Error("Sign in to manage MCP servers");
    var res = await fetch(mcpUrl(), { method: "POST", headers: h, body: JSON.stringify(Object.assign({ action: action }, extra || {})) });
    var d = null; try { d = await res.json(); } catch (e) {}
    if (!res.ok || (d && d.error)) throw new Error(String((d && d.error) || ("HTTP " + res.status)));
    return d;
  }

  // ---------------- Training data pane ----------------
  function renderTraining() {
    var c = client();
    var root = document.createElement("div");
    root.className = "stg-pane";
    root.innerHTML =
      '<h2>Training data</h2>' +
      '<p class="muted" style="max-width:56ch">Your threads help make answers better for you and everyone else. Training is <b>on by default</b>. Turn it off anytime — your content is removed from the training corpus within 24 hours, and we actually delete (disconnect also deletes stored credentials immediately).</p>' +
      '<div id="trainRow" style="display:flex;align-items:center;gap:12px;margin-top:16px">' +
      '<button id="trainToggle" class="sk-btn" style="min-width:120px" aria-label="Toggle training consent">Loading…</button>' +
      '<span id="trainState" class="muted"></span></div>' +
      '<div id="trainNote" style="margin-top:10px;max-width:56ch" class="muted"></div>';
    var btn = root.querySelector("#trainToggle"), state = root.querySelector("#trainState"), note = root.querySelector("#trainNote");
    var on = true;

    function paint() {
      btn.textContent = on ? "On — training enabled" : "Off — opted out";
      btn.style.background = on ? "" : "var(--acc, #2080f5)";
      state.textContent = on ? "Your answers improve the model for everyone." : "You are opted out. New content is excluded from training.";
    }
    if (!c || !c.auth || !c.rpc) {
      btn.textContent = "Unavailable";
      note.textContent = "Sign in to manage training consent.";
      return root;
    }
    c.rpc("get_training_consent").then(function (r) {
      if (r.error) throw r.error;
      on = r.data !== false; paint();
    }).catch(function () {
      btn.textContent = "Coming soon";
      btn.disabled = true;
      note.textContent = "Training consent controls are being rolled out on the server.";
    });
    btn.addEventListener("click", function () {
      btn.disabled = true;
      c.rpc("set_training_consent", { p_consent: !on }).then(function (r) {
        btn.disabled = false;
        if (r.error) throw r.error;
        on = r.data !== false; paint();
        note.textContent = on ? "" : "Opt-out recorded at " + new Date().toLocaleTimeString() + ". Prior content leaves the training corpus within 24 hours.";
      }).catch(function (e) {
        btn.disabled = false;
        note.textContent = "Could not save right now (" + esc(String(e.message || e)).slice(0, 120) + "). Try again.";
      });
    });
    return root;
  }

  // ---------------- MCP servers pane ----------------
  function renderMcp() {
    var root = document.createElement("div");
    root.className = "stg-pane";
    root.innerHTML =
      '<h2>MCP servers</h2>' +
      '<p class="muted" style="max-width:60ch">Connect <b>Model Context Protocol</b> servers — any HTTPS MCP endpoint. Their tools become callable right in your chats (ask about "my MCP servers" or "call my MCP tool"). Registry: <code>public.mcp_servers</code> (yours only, RLS).</p>' +
      '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">' +
      '<input id="mcpName" placeholder="Name (e.g. my-weather)" style="flex:1;min-width:140px" class="stg-input" maxlength="60">' +
      '<input id="mcpUrl" placeholder="https://example.com/mcp" style="flex:2;min-width:200px" class="stg-input" maxlength="300">' +
      '<button id="mcpAdd" class="sk-btn">Add server</button></div>' +
      '<div id="mcpList" style="margin-top:14px"></div>' +
      '<div id="mcpNote" class="muted" style="margin-top:10px;max-width:60ch"></div>';
    var list = root.querySelector("#mcpList"), note = root.querySelector("#mcpNote");
    var servers = [];

    function paint() {
      if (!servers.length) { list.innerHTML = '<p class="muted">No MCP servers yet. Add one above — any streamable-HTTPS MCP endpoint works.</p>'; return; }
      list.innerHTML = servers.map(function (s) {
        return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--line, #2a2a2a)">' +
          '<div style="flex:1;min-width:0"><div><b>' + esc(s.name) + '</b> <span class="muted">(' + esc(String(s.url).slice(0, 70)) + ')</span></div>' +
          '<div class="muted" style="font-size:12px">id ' + esc(String(s.id).slice(0, 8)) + ' · added ' + esc(String(s.created_at || "").slice(0, 10)) + '</div></div>' +
          '<button class="sk-btn" data-a="test" data-id="' + esc(s.id) + '">Test</button>' +
          '<button class="sk-btn" data-a="remove" data-id="' + esc(s.id) + '">Remove</button></div>';
      }).join("");
    }

    function refresh() {
      mcp("list_servers").then(function (d) { servers = (d && d.servers) || []; paint(); })
        .catch(function (e) { note.textContent = "Could not load MCP servers (" + esc(String(e.message || e)).slice(0, 140) + ")."; });
    }
    root.querySelector("#mcpAdd").addEventListener("click", function () {
      var name = root.querySelector("#mcpName").value.trim();
      var url = root.querySelector("#mcpUrl").value.trim();
      if (!name || !url) { note.textContent = "Give the server a name and an https:// URL."; return; }
      note.textContent = "Adding…";
      mcp("add_server", { name: name, url: url }).then(function () {
        root.querySelector("#mcpName").value = ""; root.querySelector("#mcpUrl").value = "";
        note.textContent = "Added " + name + ".";
        refresh();
      }).catch(function (e) { note.textContent = String(e.message || e); });
    });
    list.addEventListener("click", function (ev) {
      var b = ev.target.closest("button"); if (!b) return;
      var id = b.dataset.id;
      if (b.dataset.a === "remove") {
        note.textContent = "Removing…";
        mcp("remove_server", { id: id }).then(function () { refresh(); note.textContent = "Removed."; }).catch(function (e) { note.textContent = String(e.message || e); });
      } else if (b.dataset.a === "test") {
        b.disabled = true; b.textContent = "Testing…"; note.textContent = "";
        mcp("list_tools", { id: id }).then(function (d) {
          var tools = (d && d.tools) || [];
          b.textContent = "Test"; b.disabled = false;
          note.innerHTML = "<b>" + esc(d.server || "server") + "</b>: " + tools.length + " tool" + (tools.length === 1 ? "" : "s") +
            (tools.length ? " — " + tools.slice(0, 8).map(function (t) { return esc(t.name); }).join(", ") + (tools.length > 8 ? "…" : "") : "");
        }).catch(function (e) {
          b.textContent = "Test"; b.disabled = false;
          note.textContent = "Test failed: " + esc(String(e.message || e)).slice(0, 200);
        });
      }
    });
    refresh();
    return root;
  }

  if (window.SettingsUI && typeof window.SettingsUI.registerPane === "function") {
    window.SettingsUI.registerPane({ id: "training", label: "Training data", icon: "db", render: renderTraining, after: "data" });
    window.SettingsUI.registerPane({ id: "mcp", label: "MCP servers", icon: "plug", render: renderMcp, after: "connectors" });
  }
})();
