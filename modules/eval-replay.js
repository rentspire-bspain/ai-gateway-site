/* eval-replay.js — Replay a past session's first query through the current gateway (§26f item 4)
 *
 * Select a recent thread -> the pane loads its first user message and first
 * assistant answer ("Before"), re-runs the same query through the live
 * gateway-chat function in a fresh replay thread, and shows the new answer
 * ("After") side-by-side with simple stats. This is the manual half of the
 * eval-replay parity loop: same question, current platform, honest diff.
 *
 * Pure vanilla JS, zero dependencies, zero innerHTML (textContent + createElement).
 */
(function (root) {
  "use strict";
  var SVG_NS = "http://www.w3.org/2000/svg";
  var ANON = "sb_publishable_nrmUxUfyytgCscz8zfQ9Cw_LapbvKIb";
  var SB = "https://bnxermyboeigvwonfrzx.supabase.co";
  var GATEWAY = "https://bnxermyboeigvwonfrzx.supabase.co/functions/v1";

  function gateway() { return (typeof GATEWAY !== "undefined" && GATEWAY) || "https://bnxermyboeigvwonfrzx.supabase.co/functions/v1"; }
  function client() { return (typeof sb !== "undefined") ? sb : window.sb; }

  function getSessionInfo() {
    var c = client();
    if (!c || !c.auth || typeof c.auth.getSession !== "function") return Promise.resolve(null);
    return c.auth.getSession().then(function (r) {
      var s = r && r.data && r.data.session;
      if (!s || !s.access_token) return null;
      return { token: s.access_token, userId: s.user && s.user.id ? s.user.id : null };
    }).catch(function () { return null; });
  }
  function sbHeaders(tok, extra) {
    var h = { Authorization: "Bearer " + tok, apikey: ANON };
    if (extra) Object.keys(extra).forEach(function (k) { h[k] = extra[k]; });
    return h;
  }
  function fmt(t) {
    if (!t) return "";
    var d = new Date(t);
    return isNaN(d.getTime()) ? String(t) : d.toLocaleString();
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function stats(text) {
    var s = String(text || "");
    var words = s.trim() ? s.trim().split(/\s+/).length : 0;
    var links = (s.match(/\]\(https?:\/\//g) || []).length;
    var heads = (s.match(/^#{1,4} /gm) || []).length;
    return { words: words, links: links, heads: heads, chars: s.length };
  }
  function statRow(label, a, b) {
    var r = el("div", "er-statrow");
    r.appendChild(el("span", "er-statlabel", label));
    r.appendChild(el("span", "er-stata", String(a)));
    r.appendChild(el("span", "er-statb", String(b)));
    return r;
  }
  function answerPane(title, text, cls) {
    var wrap = el("div", "er-pane " + (cls || ""));
    var h = el("div", "er-panehead", title);
    wrap.appendChild(h);
    var body = el("div", "er-panebody");
    if (text == null) {
      body.appendChild(el("div", "er-empty", "—"));
    } else {
      var st = stats(text);
      var pre = el("pre", "er-answer");
      pre.textContent = String(text).slice(0, 8000);
      body.appendChild(pre);
      var sr = el("div", "er-stats");
      sr.appendChild(statRow("words", st.words, ""));
      sr.appendChild(statRow("sections", st.heads, ""));
      sr.appendChild(statRow("source links", st.links, ""));
      body.appendChild(sr);
    }
    wrap.appendChild(body);
    return wrap;
  }

  function injectStyles() {
    if (document.getElementById("er-styles")) return;
    var css = [
      ".er-list{max-height:220px;overflow:auto;border:1px solid var(--border,#2a2f3a);border-radius:8px;margin:8px 0}",
      ".er-row{display:flex;gap:10px;align-items:center;padding:8px 10px;cursor:pointer;border-bottom:1px solid var(--border,#2a2f3a)}",
      ".er-row:hover{background:var(--hover,rgba(255,255,255,.04))}",
      ".er-row .er-slug{flex:1;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".er-row .er-date{font-size:12px;opacity:.6}",
      ".er-cols{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}",
      "@media(max-width:760px){.er-cols{grid-template-columns:1fr}}",
      ".er-pane{border:1px solid var(--border,#2a2f3a);border-radius:8px;overflow:hidden;min-height:120px}",
      ".er-panehead{padding:6px 10px;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.04em;background:var(--accent-bg,rgba(20,184,166,.12));color:var(--accent,#14b8a6)}",
      ".er-panebody{padding:10px}",
      ".er-answer{white-space:pre-wrap;word-break:break-word;font-size:12.5px;line-height:1.5;max-height:340px;overflow:auto;margin:0;font-family:inherit}",
      ".er-stats{border-top:1px solid var(--border,#2a2f3a);margin-top:8px;padding-top:8px;font-size:12px}",
      ".er-statrow{display:flex;gap:14px;padding:2px 0}",
      ".er-statlabel{width:110px;opacity:.6}",
      ".er-statb{opacity:.6}",
      ".er-empty{opacity:.5;font-size:12px}",
      ".er-note{font-size:12px;opacity:.7;margin:6px 0}",
      ".er-btn{padding:7px 14px;border-radius:8px;border:1px solid var(--accent,#14b8a6);background:transparent;color:var(--accent,#14b8a6);font-weight:600;cursor:pointer;margin-top:8px}",
      ".er-btn:disabled{opacity:.4;cursor:default}"
    ].join("\n");
    var s = document.createElement("style");
    s.id = "er-styles";
    s.textContent = css;
    document.head.appendChild(s);
  }

  function mount(host) {
    if (!host) return null;
    injectStyles();
    var state = { sess: null, thread: null, before: null, after: null, running: false };
    var wrap = el("div", "er-root");

    wrap.appendChild(el("div", "er-note", "Pick a recent thread. Replay re-runs its first question through the current gateway in a fresh replay thread and shows the new answer next to the original — the before/after parity check."));

    var list = el("div", "er-list");
    wrap.appendChild(list);

    var pick = el("div");
    wrap.appendChild(pick);

    var runBtn = el("button", "er-btn", "Re-run first question");
    runBtn.style.display = "none";
    wrap.appendChild(runBtn);

    var cols = el("div", "er-cols");
    var beforePane = null, afterPane = null;
    wrap.appendChild(cols);
    cols.appendChild(answerPane("Before (stored answer)", null, ""));
    cols.appendChild(answerPane("After (re-run, current platform)", null, ""));

    function setPanes() {
      cols.textContent = "";
      cols.appendChild(answerPane("Before (stored answer)", state.before, ""));
      cols.appendChild(answerPane("After (re-run, current platform)", state.after, ""));
    }

    function loadThreads() {
      list.textContent = "";
      list.appendChild(el("div", "er-empty", "loading threads..."));
      if (!state.sess) { list.textContent = ""; list.appendChild(el("div", "er-empty", "sign in required")); return; }
      fetch(SB + "/rest/v1/threads?select=id,slug,created_at&order=created_at.desc&limit=15", { headers: sbHeaders(state.sess.token) })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (rows) {
          list.textContent = "";
          if (!rows.length) list.appendChild(el("div", "er-empty", "no threads yet"));
          rows.forEach(function (t) {
            var row = el("div", "er-row");
            row.appendChild(el("span", "er-slug", t.slug || String(t.id).slice(0, 8)));
            row.appendChild(el("span", "er-date", fmt(t.created_at)));
            row.addEventListener("click", function () { selectThread(t); });
            list.appendChild(row);
          });
        })
        .catch(function () {
          list.textContent = "";
          list.appendChild(el("div", "er-empty", "threads unavailable"));
        });
    }

    function selectThread(t) {
      state.thread = t;
      state.before = null; state.after = null;
      pick.textContent = "";
      setPanes();
      runBtn.style.display = "none";
      if (!state.sess) return;
      fetch(SB + "/rest/v1/thread_messages?select=role,content,created_at&thread_id=eq." + encodeURIComponent(t.id) + "&order=created_at.asc&limit=50", { headers: sbHeaders(state.sess.token) })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (msgs) {
          var firstUser = null, firstAssistant = null;
          (msgs || []).forEach(function (m) {
            var c = String(m.content || "");
            if (!firstUser && m.role === "user" && c && c.indexOf("[Attached") !== 0) firstUser = c;
            if (!firstAssistant && m.role === "assistant" && c) firstAssistant = c;
          });
          if (!firstUser) {
            pick.appendChild(el("div", "er-note", "No text question found in this thread."));
            return;
          }
          state.firstUser = firstUser;
          state.before = firstAssistant;
          pick.appendChild(el("div", "er-note", "Question: " + firstUser.slice(0, 200) + (firstUser.length > 200 ? "..." : "")));
          setPanes();
          runBtn.style.display = "";
        })
        .catch(function () {
          pick.appendChild(el("div", "er-note", "Could not load this thread's messages."));
        });
    }

    runBtn.addEventListener("click", function () {
      if (state.running || !state.sess || !state.firstUser) return;
      state.running = true;
      runBtn.disabled = true;
      runBtn.textContent = "re-running...";
      fetch(gateway() + "/gateway-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + state.sess.token },
        body: JSON.stringify({
          thread_id: "replay-" + Date.now(),
          user_id: state.sess.userId,
          lane: "glm",
          messages: [{ role: "user", content: state.firstUser }]
        })
      })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (ans) {
          state.after = String((ans.choices && ans.choices[0] && ans.choices[0].message && ans.choices[0].message.content) || ans.answer || "");
          if (!state.after) state.after = "(no answer returned)";
        })
        .catch(function (e) {
          state.after = "(re-run failed: HTTP " + String(e).slice(0, 60) + ")";
        })
        .then(function () {
          state.running = false;
          runBtn.disabled = false;
          runBtn.textContent = "Re-run first question";
          setPanes();
        });
    });

    getSessionInfo().then(function (s) { state.sess = s; loadThreads(); });
    host.appendChild(wrap);
    return wrap;
  }

  function renderSettingsPane(container) {
    if (!container) return;
    container.textContent = "";
    var head = el("h3", null, "Eval Replay");
    head.style.fontSize = "16px";
    head.style.margin = "0 0 4px";
    container.appendChild(head);
    mount(container);
  }

  function registerWithSettings() {
    if (root.SettingsUI && typeof root.SettingsUI.registerPane === "function") {
      root.SettingsUI.registerPane({
        id: "eval-replay",
        label: "Replay",
        icon: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
        render: renderSettingsPane,
        after: "automations"
      });
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", registerWithSettings);
  } else {
    registerWithSettings();
  }
  root.EvalReplayUI = { mount: mount, renderPane: renderSettingsPane };
})(typeof window !== "undefined" ? window : globalThis);
