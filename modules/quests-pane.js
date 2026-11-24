/* quests-pane.js — Quests card for the Neurons Settings pane (pairs with the staged
   quest_progress RPC; A5 pane UI, master doc §31.4l). Renders one row per active quest
   with a progress bar and paid state; fires quest_progress once per pane open.
   STAGED — activates when the quests migration is applied (owner approval). */
(function () {
  "use strict";
  var K = window.NEURONS_PUBLISHABLE_KEY || "sb_publishable_nrmUxUfyytgCscz8zfQ9Cw_LapbvKIb";
  var SB = "https://bnxermyboeigvwonfrzx.supabase.co";
  var fired = {};

  window.QuestsPane = function (root) {
    root.innerHTML =
      '<h3 style="margin:14px 0 6px">Quests</h3>' +
      '<div id="questList" style="display:grid;gap:10px"><div style="color:var(--text-muted);font-size:13px">Loading quests…</div></div>';
    var list = root.querySelector("#questList");

    function authHeaders() {
      var c = (typeof sb !== "undefined") ? sb : null;
      return c && c.auth ? c.auth.getSession().then(function (r) {
        var t = r && r.data && r.data.session && r.data.session.access_token;
        return t ? { "Content-Type": "application/json", "apikey": K, "Authorization": "Bearer " + t } : null;
      }) : Promise.resolve(null);
    }

    authHeaders().then(function (h) {
      if (!h) { list.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Sign in to see your quests.</div>'; return; }
      // active quests via the pane's public read RPC (ships with the migration)
      fetch(SB + "/rest/v1/rpc/quests_list", { method: "POST", headers: h, body: "{}" })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (quests) {
          if (!quests || !quests.length) { list.innerHTML = '<div style="color:var(--text-muted);font-size:13px">No active quests right now.</div>'; return; }
          list.innerHTML = "";
          quests.forEach(function (q) {
            var row = document.createElement("div");
            row.style.cssText = "border:1px solid var(--border);border-radius:10px;padding:12px";
            row.innerHTML =
              '<div style="display:flex;justify-content:space-between;align-items:baseline">' +
                '<b style="font-size:13px">' + (q.title || q.quest_id) + '</b>' +
                '<span style="font-size:12px;color:var(--text-muted)">+' + (q.award || 50) + ' N</span></div>' +
              '<div style="height:6px;background:var(--bg);border-radius:3px;margin:8px 0 4px;overflow:hidden">' +
                '<div id="bar-' + q.quest_id + '" style="height:100%;width:0;background:var(--accent,#56ABAB);transition:width .4s"></div></div>' +
              '<div id="stat-' + q.quest_id + '" style="font-size:11px;color:var(--text-muted)">…</div>';
            list.appendChild(row);
            // fire quest_progress at most once per pane open per quest (UI3: no loop)
            if (!fired[q.quest_id]) {
              fired[q.quest_id] = true;
              fetch(SB + "/rest/v1/rpc/quest_progress", {
                method: "POST", headers: h, body: JSON.stringify({ p_quest_id: q.quest_id })
              }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
                if (!d) return;
                var bar = row.querySelector("#bar-" + q.quest_id), st = row.querySelector("#stat-" + q.quest_id);
                bar.style.width = (100 * (d.progress / d.threshold)) + "%";
                if (d.paid) { bar.style.background = "#34d399"; st.textContent = "Complete — reward claimed"; }
                else st.textContent = d.progress + " of " + d.threshold + " this " + (q.period || "day");
              }).catch(function () {});
            }
          });
        }).catch(function () {
          // UI4: no active quests / RPC absent (migration not applied) renders a quiet empty state
          list.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Quests are rolling out soon.</div>';
        });
    });
  };
})();
