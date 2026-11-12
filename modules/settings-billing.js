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
      '<h3 style="margin-top:22px">Invite friends — free credits for both of you</h3>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px">' +
      '<div class="muted">Your code:</div><code id="refCode" style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:6px 10px;font-size:15px">…</code>' +
      '<button class="sk-btn" id="refCopy">Copy invite link</button>' +
      '<span class="muted" id="refStats"></span></div>' +
      '<div class="muted" style="margin-top:6px;max-width:60ch">Share your link — when a friend signs up and claims your code, you both get 500 credits instantly (5,000 pts displayed). One claim per account; referrers cap at 40,000 credits.</div>' +
      '<div style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap">' +
      '<div class="muted">Have a code?</div>' +
      '<input id="refInput" placeholder="e.g. 3b4cc9a3" style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:7px 10px;color:inherit;font-size:13px;width:140px" />' +
      '<button class="sk-btn" id="refClaim">Claim 500 credits</button>' +
      '<span class="muted" id="refMsg"></span></div>' +
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

    // v173: referral program — free credits for both sides
    var refCodeEl = root.querySelector("#refCode"), refStats = root.querySelector("#refStats"), refMsg = root.querySelector("#refMsg");
    var SB_URL = "https://bnxermyboeigvwonfrzx.supabase.co";
    authHeaders().then(function (h) {
      if (!h) { refCodeEl.textContent = "sign in"; return; }
      h.apikey = (typeof SUPABASE_ANON !== "undefined") ? SUPABASE_ANON : ((typeof sb !== "undefined" && sb.supabaseKey) ? sb.supabaseKey : "");
      fetch(SB_URL + "/auth/v1/user", { headers: h }).then(function (r) { return r.json(); }).then(function (u) {
        return fetch(SB_URL + "/rest/v1/rpc/referral_ensure_code", { method: "POST", headers: h, body: JSON.stringify({ p_user: u.id }) });
      }).then(function (r) { return r.text(); }).then(function (code) {
        code = code.replace(/"/g, "");
        refCodeEl.textContent = code;
        root.querySelector("#refCopy").addEventListener("click", function () {
          var link = "https://ai.spaincos.com/?ref=" + code;
          if (navigator.clipboard) navigator.clipboard.writeText(link);
          refMsg.textContent = "Invite link copied: " + link;
        });
      }).catch(function () { refCodeEl.textContent = "—"; });
    });
    credits("ledger", { limit: 100 }).then(function (d) {
      var rows = (d && d.rows) || [];
      var inv = rows.filter(function (r) { return r.reason === "referral_invite"; }).length;
      if (refStats) refStats.textContent = inv ? (inv + " invite" + (inv > 1 ? "s" : "") + " claimed") : "";
    }).catch(function () {});
    try { // v173: prefill from an invite link (?ref=CODE captured at page load)
      var pend = localStorage.getItem("pendingRef");
      if (pend && root.querySelector("#refInput")) { root.querySelector("#refInput").value = pend; refMsg.textContent = "Invite code detected — claim it for 500 free credits."; }
    } catch (e) {}
    root.querySelector("#refClaim").addEventListener("click", async function () {
      var codeEl = root.querySelector("#refInput");
      var code = (codeEl.value || "").trim();
      if (!code) { refMsg.textContent = "Enter a code first."; return; }
      refMsg.textContent = "Claiming…";
      try {
        var h = await authHeaders(); if (!h) throw new Error("sign in");
        h.apikey = (typeof SUPABASE_ANON !== "undefined") ? SUPABASE_ANON : ((typeof sb !== "undefined" && sb.supabaseKey) ? sb.supabaseKey : "");
        var res = await fetch(SB_URL + "/rest/v1/rpc/referral_claim", { method: "POST", headers: h, body: JSON.stringify({ p_code: code }) });
        var d = null; try { d = await res.json(); } catch (e) {}
        if (res.ok && d && d.ok) { refMsg.textContent = "Claimed — 500 credits (5,000 pts) added."; try { localStorage.removeItem("pendingRef"); } catch (e) {} credits("balance").then(function (b) { balVal.textContent = fmt(Number(b.balance || 0) * 10) + " pts"; }); }
        else { refMsg.textContent = "Could not claim (" + String((d && (d.message || d.error)) || "invalid or already-used code") + ")."; }
      } catch (e) { refMsg.textContent = "Error: " + String(e.message || e).slice(0, 100); }
    });

    root.querySelector("#plans").addEventListener("click", async function (ev) {
      var b = ev.target.closest("button[data-plan]"); if (!b) return;
      if (b.dataset.plan === "team") { note.textContent = "Team seats launch with the Stripe wiring — email bspain@spaincos.com to be first in line."; return; }
      note.textContent = "Starting checkout…";
      try {
        var h = await authHeaders();
        var res = await fetch("https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/checkout", { method: "POST", headers: h, body: JSON.stringify({ plan: b.dataset.plan }) });
        var d = await res.json();
        if (d && d.url) { note.textContent = "Redirecting to secure checkout (30-day free trial)…"; location.href = d.url; return; }
        if (d && d.not_configured) { note.textContent = "Checkout is one secret away: add STRIPE_SECRET_KEY in the project settings and this button goes live. Everything else (ledger, balance, plans) is already running."; return; }
        note.textContent = "Checkout unavailable: " + String((d && d.error) || ("HTTP " + res.status));
      } catch (e) { note.textContent = "Checkout error: " + String(e.message || e).slice(0, 120); }
    });
    return root;
  }

  if (window.SettingsUI && typeof window.SettingsUI.registerPane === "function") {
    window.SettingsUI.registerPane({ id: "billing", label: "Billing", icon: "chart", render: render, after: "usage" });
  }
})();
