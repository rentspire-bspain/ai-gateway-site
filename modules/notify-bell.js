/* notify-bell.js — v170: in-app notification inbox (bell + unread badge + dropdown).
   Reads the `notifications` edge function (dispatch/automation/guardian results posting back).
   Polls on load + every 60s. Falls back silently when the table/function isn't deployed yet. */
(function () {
  "use strict";
  var URL = "https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/notifications";
  function client() { return (typeof sb !== "undefined") ? sb : null; }
  function esc(s) { var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }
  var bell = null, badge = null, pop = null, lastCount = -1;

  function ensureDom() {
    if (bell) return true;
    var host = document.querySelector(".main-header-right") || document.querySelector("header") || document.body;
    if (!host) return false;
    bell = document.createElement("button");
    bell.className = "width-toggle";
    bell.title = "Notifications";
    bell.setAttribute("aria-label", "Notifications");
    bell.style.position = "relative";
    bell.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' +
      '<span class="nt-badge" style="display:none;position:absolute;top:-4px;right:-4px;background:#e5484d;color:#fff;border-radius:9px;min-width:16px;height:16px;font-size:10px;font-weight:700;line-height:16px;text-align:center;padding:0 3px">0</span>';
    badge = bell.querySelector(".nt-badge");
    host.appendChild(bell);
    bell.addEventListener("click", togglePop);
    return true;
  }

  async function headers() {
    var c = client();
    if (!c || !c.auth) return null;
    var r = await c.auth.getSession();
    var t = r && r.data && r.data.session && r.data.session.access_token;
    return t ? { "Authorization": "Bearer " + t, "Content-Type": "application/json" } : null;
  }

  async function poll() {
    if (!ensureDom()) return;
    try {
      var h = await headers();
      if (!h) { badge.style.display = "none"; return; }
      var res = await fetch(URL, { method: "POST", headers: h, body: JSON.stringify({ action: "unread_count" }) });
      if (!res.ok) { badge.style.display = "none"; return; }
      var d = await res.json();
      var n = Number((d && d.count) || 0);
      if (n !== lastCount) {
        lastCount = n;
        badge.textContent = n > 99 ? "99+" : String(n);
        badge.style.display = n > 0 ? "block" : "none";
      }
    } catch (e) { /* not deployed or signed out: stay quiet */ }
  }

  async function togglePop() {
    if (pop) { pop.remove(); pop = null; return; }
    pop = document.createElement("div");
    pop.style.cssText = "position:absolute;top:44px;right:0;width:360px;max-height:420px;overflow:auto;background:var(--bg-elevated,#212121);border:1px solid var(--border);border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.5);z-index:300;padding:8px";
    pop.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px"><b style="font-size:13px">Notifications</b><button class="sk-btn" id="ntAll" style="min-height:26px;padding:2px 8px;font-size:12px">Mark all read</button></div><div id="ntList" style="padding:4px"><span class="muted" style="font-size:12px">Loading…</span></div>';
    bell.appendChild(pop);
    var h = await headers();
    if (!h) { pop.querySelector("#ntList").innerHTML = '<span class="muted" style="font-size:12px">Sign in to see notifications.</span>'; return; }
    var res = await fetch(URL, { method: "POST", headers: h, body: JSON.stringify({ action: "list", limit: 30 }) });
    var d = res.ok ? await res.json().catch(() => null) : null;
    var list = (d && d.notifications) || [];
    var el = pop.querySelector("#ntList");
    if (!list.length) { el.innerHTML = '<span class="muted" style="font-size:12px">No notifications yet — fleet dispatches and automation results land here.</span>'; }
    else {
      el.innerHTML = list.map(function (n) {
        return '<div style="padding:8px;border-top:1px solid var(--line,#2a2a2a);font-size:13px;' + (n.read_at ? "opacity:.55" : "") + '">' +
          '<b>' + esc(n.title) + '</b> <span class="muted" style="font-size:11px">' + esc(String(n.created_at || "").slice(0, 16).replace("T", " ")) + '</span>' +
          (n.body ? '<div class="muted" style="font-size:12px;margin-top:2px">' + esc(String(n.body).slice(0, 140)) + '</div>' : "") + '</div>';
      }).join("");
      el.querySelectorAll("div").forEach(function (row, i) { if (!list[i].read_at) row.style.cursor = "pointer"; });
    }
    pop.querySelector("#ntAll").addEventListener("click", async function () {
      var hh = await headers(); if (!hh) return;
      await fetch(URL, { method: "POST", headers: hh, body: JSON.stringify({ action: "mark_all_read" }) });
      lastCount = -1; poll();
      if (pop) { pop.remove(); pop = null; }
    });
    document.addEventListener("click", function close(e) { if (pop && !pop.contains(e.target) && e.target !== bell && !bell.contains(e.target)) { pop.remove(); pop = null; document.removeEventListener("click", close); } });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { poll(); setInterval(poll, 60_000); });
  else { poll(); setInterval(poll, 60_000); }
})();
