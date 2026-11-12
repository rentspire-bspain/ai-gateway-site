/* settings-neurons.js — Settings pane: Neurons (earned loyalty credits).
   Balance + streak via the `neurons-claim` edge function; redemption catalog with
   the credit-grant bridge (bonus query credits through the existing credits ledger).
   Neurons are earned only — never purchased, never transferable, no cash-out.
   Design: Neurons v4 (Fraunces display accents, warm coral, activity rings). */
(function () {
  "use strict";
  function client() { return (typeof sb !== "undefined") ? sb : null; }
  function esc(s) { var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }
  var URL_ = "https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/neurons-claim";

  function authHeaders() {
    var c = client();
    if (!c || !c.auth) return Promise.resolve(null);
    return c.auth.getSession().then(function (r) {
      var t = r && r.data && r.data.session && r.data.session.access_token;
      return t ? { "Authorization": "Bearer " + t, "Content-Type": "application/json" } : null;
    });
  }
  function neurons(action, extra) {
    return authHeaders().then(function (h) {
      if (!h) throw new Error("Sign in to view your Neurons");
      return fetch(URL_, { method: "POST", headers: h, body: JSON.stringify(Object.assign({ action: action }, extra || {})) });
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (d) {
        if (!res.ok || (d && d.error)) throw new Error(String((d && d.error) || ("HTTP " + res.status)));
        return d;
      });
    });
  }

  var REWARDS = [
    { id: "bonus_credits_1000", name: "1,000 bonus query credits", desc: "Grants straight into your credit balance", cost: 500 },
    { id: "priority_week", name: "Priority processing — 7 days", desc: "Fast lane for all your queries", cost: 300 },
    { id: "early_access", name: "Early access — new features", desc: "First look at new product surfaces", cost: 1500 },
    { id: "frontier_week", name: "Frontier model — 1 week", desc: "Full access to premium hosted models", cost: 2000 }
  ];

  function ringsSvg(pct1, pct2, pct3) {
    // mini activity rings (v4 hero pattern) — pct values 0..1
    var c1 = 2 * Math.PI * 34, c2 = 2 * Math.PI * 26, c3 = 2 * Math.PI * 18;
    return '<svg width="92" height="92" viewBox="0 0 92 92" style="transform:rotate(-90deg)" role="img" aria-label="Daily activity rings">' +
      '<circle cx="46" cy="46" r="34" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="7"/>' +
      '<circle cx="46" cy="46" r="34" fill="none" stroke="#e8482b" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + (c1 * pct1).toFixed(1) + " " + c1.toFixed(1) + '"/>' +
      '<circle cx="46" cy="46" r="26" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="7"/>' +
      '<circle cx="46" cy="46" r="26" fill="none" stroke="#c98a0e" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + (c2 * pct2).toFixed(1) + " " + c2.toFixed(1) + '"/>' +
      '<circle cx="46" cy="46" r="18" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="7"/>' +
      '<circle cx="46" cy="46" r="18" fill="none" stroke="#1e7a4f" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + (c3 * pct3).toFixed(1) + " " + c3.toFixed(1) + '"/>' +
      '</svg>';
  }

  function render() {
    var root = document.createElement("div");
    root.className = "stg-pane";
    root.innerHTML =
      '<h2 style="font-family:Fraunces,Georgia,serif">Neurons</h2>' +
      '<div style="display:flex;gap:18px;align-items:center;margin-top:8px;flex-wrap:wrap">' +
      '<div id="nrnRings" style="position:relative;flex:none">' + ringsSvg(0.7, 0.5, 0.77) +
      '<div id="nrnRingsCenter" style="position:absolute;inset:0;display:grid;place-content:center;text-align:center;font-variant-numeric:tabular-nums"></div></div>' +
      '<div style="flex:1;min-width:220px">' +
      '<div style="font-size:26px;font-weight:700;font-variant-numeric:tabular-nums"><span id="nrnBal">—</span> <span class="muted" style="font-size:14px">Neurons</span></div>' +
      '<div class="muted" style="margin-top:2px">Earned through activity — every query keeps your streak alive. Never purchased, never cash-out.</div>' +
      '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">' +
      '<button class="sk-btn primary" id="nrnClaim">Claim daily drop</button>' +
      '<span class="muted" id="nrnStreak" style="align-self:center"></span></div>' +
      '</div></div>' +
      '<h3 style="margin-top:22px">Spend your Neurons</h3>' +
      '<div id="nrnShop" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;margin-top:8px"></div>' +
      '<div id="nrnMsg" class="muted" style="margin-top:10px;max-width:60ch"></div>';

    var bal = root.querySelector("#nrnBal"), msg = root.querySelector("#nrnMsg"),
        streak = root.querySelector("#nrnStreak"), shop = root.querySelector("#nrnShop"),
        claimBtn = root.querySelector("#nrnClaim");

    function fmt(n) { return Number(n || 0).toLocaleString(); }

    function refresh() {
      neurons("balance").then(function (d) {
        bal.textContent = fmt(d.balance);
        var s = d.streak || {};
        streak.innerHTML = s.streak_days != null
          ? esc(s.streak_days) + '-day streak' + (s.multiplier ? ' · ' + esc(s.multiplier) + 'x' : '')
          : "";
      }).catch(function (e) {
        bal.textContent = "—";
        msg.textContent = "Neurons are rolling out: " + String(e.message || e).slice(0, 120);
      });
    }

    function drawShop(balance) {
      shop.innerHTML = REWARDS.map(function (r) {
        var afford = Number(balance || 0) >= r.cost;
        return '<div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:6px">' +
          '<div style="font-weight:700">' + esc(r.name) + '</div>' +
          '<div class="muted" style="font-size:13px;flex:1">' + esc(r.desc) + '</div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<span style="font-weight:700;color:' + (afford ? "#e8482b" : "var(--text-muted,#888)") + ';font-variant-numeric:tabular-nums">' + fmt(r.cost) + ' N</span>' +
          '<button class="sk-btn' + (afford ? " primary" : "") + '" data-reward="' + esc(r.id) + '"' + (afford ? "" : " disabled") + '>' + (afford ? "Redeem" : "Locked") + '</button>' +
          '</div></div>';
      }).join("");
    }
    drawShop(null);

    claimBtn.addEventListener("click", function () {
      claimBtn.disabled = true; claimBtn.textContent = "Claiming…";
      neurons("streak").then(function (d) {
        claimBtn.textContent = "✓ Claimed — streak safe";
        msg.textContent = d && d.streak_days != null
          ? "Daily drop claimed. Streak: " + d.streak_days + " days" + (d.multiplier ? " (" + d.multiplier + "x)" : "") + "."
          : "Already claimed today.";
        refresh();
      }).catch(function (e) {
        claimBtn.textContent = "Claim daily drop";
        msg.textContent = "Claim unavailable: " + String(e.message || e).slice(0, 120);
      }).then(function () {
        setTimeout(function () { claimBtn.disabled = false; claimBtn.textContent = "Claim daily drop"; }, 2500);
      });
    });

    shop.addEventListener("click", function (ev) {
      var b = ev.target.closest("button[data-reward]"); if (!b || b.disabled) return;
      b.disabled = true; b.textContent = "Redeeming…";
      neurons("redeem", { reward_id: b.dataset.reward }).then(function (d) {
        b.textContent = "✓ Redeemed";
        if (d && d.credit_grant) {
          msg.textContent = "Redeemed — " + fmt(d.credit_grant) + " bonus credits added to your balance.";
        } else {
          msg.textContent = "Redeemed. Remaining balance: " + fmt(d && d.remaining_balance) + " N.";
        }
        refresh();
      }).catch(function (e) {
        b.disabled = false; b.textContent = "Redeem";
        msg.textContent = String(e.message || e).slice(0, 140);
      });
    });

    refresh();
    return root;
  }

  if (window.SettingsUI && typeof window.SettingsUI.registerPane === "function") {
    window.SettingsUI.registerPane({ id: "neurons", label: "Neurons", icon: "spark", render: render, after: "billing" });
  }
})();
