/* settings-billing.js — v170 Settings pane: Billing (credits).
   Balance via the `credits` edge function (reserve-then-settle ledger);
   1 credit = $0.01; displayed ×10 (the 10:1 split: 2,500 credits reads 25,000 points).
   Plans: Core $8, Max $50, Team $20/seat (§18). Checkout stub until Stripe wiring. */
(function () {
  "use strict";
  function client() { return (typeof sb !== "undefined") ? sb : null; }
  function esc(s) { var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }
  var CREDITS_URL = "https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/credits";

  function authHeaders() {
    var c = client();
    if (!c || !c.auth) return Promise.resolve(null);
    return c.auth.getSession().then(function (r) {
      var t = r && r.data && r.data.session && r.data.session.access_token;
      return t ? { "Authorization": "Bearer " + t, "Content-Type": "application/json" } : null;
    });
  }
  async function credits(action, extra) {
    var h = await authHeaders();
    if (!h) throw new Error("Sign in to view billing");
    var res = await fetch(CREDITS_URL, { method: "POST", headers: h, body: JSON.stringify(Object.assign({ action: action }, extra || {})) });
    var d = null; try { d = await res.json(); } catch (e) {}
    if (!res.ok || (d && d.error)) throw new Error(String((d && d.error) || ("HTTP " + res.status)));
    return d;
  }

  function render() {
    var root = document.createElement("div");
    root.className = "stg-pane";
    root.innerHTML =
      '<h2>Billing</h2>' +
      '<div id="balRow" style="display:flex;align-items:baseline;gap:10px;margin-top:6px">' +
      '<div id="balVal" style="font-size:28px;font-weight:700">—</div>' +
      '<span class="muted">credits (1 credit = $0.01) · displayed ×10</span></div>' +
      '<div id="balMsg" class="muted" style="max-width:60ch;margin-top:4px">Answers cost fractions of a cent at our scale — credits mostly guard against abuse. Every tool-failure is auto-refunded.</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-top:18px" id="plans">' +
      '<div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;padding:14px"><div style="font-weight:700">Core</div><div class="muted">$8 / month</div><div style="margin-top:8px">25,000 pts/day refresh</div><button class="sk-btn primary" data-plan="core" style="margin-top:10px;width:100%">Subscribe</button></div>' +
      '<div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;padding:14px;position:relative"><div style="font-weight:700">Max</div><div class="muted">$50 / month</div><div style="margin-top:8px">250,000 pts/day</div><div style="margin-top:8px">Deep Research included</div><button class="sk-btn primary" data-plan="max" style="margin-top:10px;width:100%">Subscribe</button></div>' +
      '<div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;padding:14px"><div style="font-weight:700">Team</div><div class="muted">$20 / seat / month</div><div style="margin-top:8px">Shared spaces + roles</div><button class="sk-btn" data-plan="team" style="margin-top:10px;width:100%">Contact</button></div>' +
      '</div>' +
      '<h3 style="margin-top:22px">Recent activity</h3>' +
      '<div id="ledger" style="margin-top:8px"></div>' +
      '<div id="billNote" class="muted" style="margin-top:10px;max-width:60ch"></div>';
    var balVal = root.querySelector("#balVal"), ledger = root.querySelector("#ledger"), note = root.querySelector("#billNote");

    function fmt(n) { return (n >= 0 ? "" : "−") + Math.abs(n).toLocaleString(); }
    credits("balance").then(function (d) {
      balVal.textContent = fmt(Number(d.balance || 0) * 10) + " pts";
      if (Number(d.balance || 0) === 0) note.textContent = "No credits yet — the launch bonus grants 10,000 pts when billing goes fully live.";
    }).catch(function (e) {
      balVal.textContent = "—";
      note.textContent = "Billing is rolling out: " + esc(String(e.message || e)).slice(0, 120);
    });
    credits("ledger", { limit: 20 }).then(function (d) {
      var rows = (d && d.rows) || [];
      if (!rows.length) { ledger.innerHTML = '<p class="muted">No transactions yet.</p>'; return; }
      ledger.innerHTML = rows.map(function (r) {
        return '<div style="display:flex;justify-content:space-between;padding:7px 0;border-top:1px solid var(--line,#2a2a2a);font-size:13px">' +
          '<span>' + esc(r.reason) + (r.ref ? ' <span class="muted">· ' + esc(String(r.ref).slice(0, 14)) + '</span>' : "") + '</span>' +
          '<span style="font-variant-numeric:tabular-nums">' + fmt(Number(r.delta) * 10) + ' pts</span></div>';
      }).join("");
    }).catch(function () { ledger.innerHTML = '<p class="muted">Ledger unavailable.</p>'; });

    root.querySelector("#plans").addEventListener("click", function (ev) {
      var b = ev.target.closest("button[data-plan]"); if (!b) return;
      note.textContent = "Checkout for " + b.dataset.plan + " launches with the Stripe wiring — the ledger and balance engine are live.";
    });
    return root;
  }

  if (window.SettingsUI && typeof window.SettingsUI.registerPane === "function") {
    window.SettingsUI.registerPane({ id: "billing", label: "Billing", icon: "chart", render: render, after: "usage" });
  }
})();
