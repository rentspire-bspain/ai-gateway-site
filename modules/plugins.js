/* PluginsUI — plugin registry client (F9). Registry in Supabase (plugins, user_plugins; RLS). Needs skills.css for shared sk-* styles. */
(function () {
  "use strict";
  var CACHE = "ai_plugin_skills_cache";
  var overlay = null, registry = [], installs = {}, error = null, loading = false;

  function esc(s) { var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }
  function client() { return (typeof sb !== "undefined") ? sb : null; }
  function uid() { var c = client(); return c.auth.getSession().then(function (r) { var s = r && r.data && r.data.session; if (!s) throw new Error("Sign in to manage plugins"); return s.user.id; }); }

  function enabledSkills() {
    var out = [];
    registry.forEach(function (pl) {
      var i = installs[pl.id];
      if (i && i.enabled) ((pl.manifest && pl.manifest.skills) || []).forEach(function (s) {
        out.push({ id: "pl:" + pl.id + ":" + s.name, name: s.name, icon: s.icon || pl.icon, prompt: s.prompt, plugin: pl.id });
      });
    });
    return out;
  }
  function mirror() { try { localStorage.setItem(CACHE, JSON.stringify(enabledSkills())); } catch (e) {} }
  // synchronous source for the slash menu (falls back to last known cache before registry loads)
  window.SkillsPluginSource = function () {
    if (registry.length) return enabledSkills();
    try { return JSON.parse(localStorage.getItem(CACHE) || "[]"); } catch (e) { return []; }
  };

  function refresh() {
    var c = client();
    if (!c) { error = "Not connected to backend"; return Promise.resolve(); }
    loading = true;
    return Promise.all([
      c.from("plugins").select("id,name,description,icon,version,author,first_party,manifest,required_connectors").eq("published", true).order("first_party", { ascending: false }).order("name"),
      c.from("user_plugins").select("plugin_id,enabled")
    ]).then(function (r) {
      loading = false;
      if (r[0].error) throw r[0].error;
      if (r[1].error) throw r[1].error;
      registry = r[0].data || [];
      installs = {};
      (r[1].data || []).forEach(function (x) { installs[x.plugin_id] = { enabled: !!x.enabled }; });
      error = null; mirror();
    }).catch(function (e) {
      loading = false;
      error = /relation|does not exist|schema cache/i.test(e.message || "") ? "Plugin registry is not provisioned yet (tables missing)." : (e.message || "Failed to load plugins");
    });
  }

  function install(id) {
    return uid().then(function (u) { return client().from("user_plugins").upsert({ user_id: u, plugin_id: id, enabled: true, updated_at: new Date().toISOString() }, { onConflict: "user_id,plugin_id" }); }).then(chk).then(function () { installs[id] = { enabled: true }; mirror(); });
  }
  function setEnabled(id, on) {
    return uid().then(function (u) { return client().from("user_plugins").update({ enabled: !!on, updated_at: new Date().toISOString() }).eq("user_id", u).eq("plugin_id", id); }).then(chk).then(function () { installs[id].enabled = !!on; mirror(); });
  }
  function uninstall(id) {
    return uid().then(function (u) { return client().from("user_plugins").delete().eq("user_id", u).eq("plugin_id", id); }).then(chk).then(function () { delete installs[id]; mirror(); });
  }
  function chk(r) { if (r && r.error) throw r.error; return r; }

  function close() { if (overlay) { overlay.remove(); overlay = null; } document.removeEventListener("keydown", onEsc, true); }
  function onEsc(e) { if (e.key === "Escape") { e.stopPropagation(); close(); } }
  function open() {
    close();
    overlay = document.createElement("div");
    overlay.className = "sk-overlay";
    overlay.innerHTML = '<div class="sk-panel" role="dialog" aria-modal="true" aria-label="Plugins"></div>';
    overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    document.addEventListener("keydown", onEsc, true);
    render();
    refresh().then(render);
  }

  function render(note) {
    var p = overlay && overlay.firstChild; if (!p) return;
    var h = '<div class="sk-head"><h2>Plugins</h2><button class="sk-btn" data-a="close" aria-label="Close">✕</button></div><div class="sk-body"><p class="sk-sub">Installable bundles of skills and connector tools. Plugin skills show up in the / menu. Actions that send or create things always ask for your approval first.</p>';
    if (note) h += '<div class="sa-error" role="alert">' + esc(note) + '</div>';
    if (loading && !registry.length) h += '<div class="sk-empty">Loading…</div>';
    else if (error) h += '<div class="sk-empty">' + esc(error) + '</div>';
    else if (!registry.length) h += '<div class="sk-empty">No plugins published yet.</div>';
    else {
      h += '<div class="sk-grid">';
      registry.forEach(function (pl) {
        var m = pl.manifest || {}, ins = installs[pl.id];
        var ns = (m.skills || []).length, nt = (m.tools || []).length;
        h += '<div class="sk-card pl-card" data-id="' + esc(pl.id) + '"><div class="sk-card-top"><div class="sk-icon">' + esc(pl.icon) + '</div><div style="min-width:0"><div class="sk-name">' + esc(pl.name) + '</div><div class="pl-meta">v' + esc(pl.version) + ' · ' + esc(pl.author) + (pl.first_party ? ' · <span class="pl-badge">First-party</span>' : '') + '</div></div></div>' +
          '<div class="sk-desc">' + esc(pl.description) + '</div>' +
          '<div class="pl-meta">' + ns + ' skill' + (ns === 1 ? '' : 's') + ' · ' + nt + ' tool' + (nt === 1 ? '' : 's') + ((pl.required_connectors || []).length ? ' · needs ' + esc(pl.required_connectors.join(", ")) : '') + '</div>' +
          '<div class="sk-actions">' +
          (!ins ? '<button class="sk-btn primary" data-a="install">Install</button>' :
            '<button class="sk-btn' + (ins.enabled ? ' primary' : '') + '" data-a="toggle" aria-pressed="' + ins.enabled + '">' + (ins.enabled ? 'Enabled' : 'Disabled') + '</button><button class="sk-btn danger" data-a="remove">Uninstall</button>') +
          ((ins && ins.enabled) ? toolButtons(m.tools || []) : '') + '</div></div>';
      });
      h += '</div>';
    }
    p.innerHTML = h + '</div>';
    p.onclick = function (e) {
      var b = e.target.closest("[data-a]"); if (!b) return;
      var a = b.dataset.a, card = b.closest(".pl-card"), id = card && card.dataset.id;
      if (a === "close") return close();
      if (a === "try") { close(); if (window.SkillsActions) window.SkillsActions.open(b.dataset.kind); return; }
      b.disabled = true;
      var pr = a === "install" ? install(id) : a === "toggle" ? setEnabled(id, !installs[id].enabled) : a === "remove" ? uninstall(id) : Promise.resolve();
      pr.then(function () { render(); }).catch(function (err) { render(err.message || "Action failed"); });
    };
  }
  var ACTION_KIND = { draft_email: "draft_email", send_email: "send_email", create_event: "create_event" };
  function toolButtons(tools) {
    return tools.filter(function (t) { return ACTION_KIND[t.action]; }).map(function (t) {
      return '<button class="sk-btn" data-a="try" data-kind="' + ACTION_KIND[t.action] + '" title="' + esc(t.description || "") + '">' + esc(t.name.replace(/_/g, " ")) + '</button>';
    }).join("");
  }

  window.PluginsUI = { open: open, close: close, refresh: refresh, install: install, setEnabled: setEnabled, uninstall: uninstall, enabledSkills: enabledSkills };
  // warm the cache once signed in
  function warm() { var c = client(); if (c && c.auth) c.auth.getSession().then(function (r) { if (r && r.data && r.data.session) refresh(); }).catch(function () {}); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", warm); else setTimeout(warm, 0);
})();
