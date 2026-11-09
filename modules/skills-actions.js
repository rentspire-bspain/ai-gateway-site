/* SkillsActions — email / calendar actions. Every action: form -> server preview -> explicit Approve click -> execute.
   Nothing is ever executed without the user clicking the Approve button (trusted click only). */
(function () {
  "use strict";
  var KINDS = {
    draft_email: { label: "Draft email", approve: "Approve & save draft", fields: ["to", "cc", "subject", "body"] },
    send_email: { label: "Send email", approve: "Approve & send now", fields: ["to", "cc", "subject", "body"] },
    create_event: { label: "Create calendar event", approve: "Approve & create event", fields: ["summary", "start", "end", "attendees", "location", "description"] }
  };
  var LABELS = { to: "To", cc: "Cc", subject: "Subject", body: "Body", summary: "Title", start: "Start", end: "End", attendees: "Attendees (comma separated)", location: "Location", description: "Description" };
  var LONG = { body: 1, description: 1 };
  var overlay = null, state = null;

  function esc(s) { var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }
  function fnUrl() {
    var base = (typeof GATEWAY !== "undefined" && GATEWAY) || ((typeof SUPABASE_URL !== "undefined" ? SUPABASE_URL : "") + "/functions/v1");
    return base + "/workspace-actions";
  }
  function call(body) {
    if (typeof sb === "undefined") return Promise.reject(new Error("Not signed in"));
    return sb.auth.getSession().then(function (r) {
      var s = r && r.data && r.data.session;
      if (!s) throw new Error("Not signed in — sign in again.");
      return fetch(fnUrl(), { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + s.access_token }, body: JSON.stringify(body) });
    }).then(function (res) { return res.json().then(function (d) { d._http = res.status; return d; }); });
  }
  function close() { if (overlay) { overlay.remove(); overlay = null; } state = null; document.removeEventListener("keydown", onKey, true); }
  function onKey(e) { if (e.key === "Escape") { e.stopPropagation(); close(); } }
  function panel() { return overlay && overlay.firstChild; }

  function open(kind, prefill) {
    if (!KINDS[kind]) kind = "send_email";
    close();
    state = { kind: kind, values: prefill || {} };
    overlay = document.createElement("div");
    overlay.className = "sk-overlay";
    overlay.innerHTML = '<div class="sk-panel sa-panel" role="dialog" aria-modal="true"></div>';
    overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    document.addEventListener("keydown", onKey, true);
    renderForm();
  }

  function renderForm(err) {
    var p = panel(); if (!p) return;
    var k = KINDS[state.kind];
    var html = '<div class="sk-head"><h2>' + esc(k.label) + '</h2><button class="sk-btn" data-a="close" aria-label="Close">✕</button></div><div class="sk-body"><form class="sk-form">';
    if (err) html += '<div class="sa-error" role="alert">' + esc(err) + '</div>';
    k.fields.forEach(function (f) {
      var v = state.values[f] || "";
      var type = (f === "start" || f === "end") ? "datetime-local" : "text";
      html += '<label>' + esc(LABELS[f]) + (LONG[f] ? '<textarea name="' + f + '">' + esc(v) + '</textarea>' : '<input name="' + f + '" type="' + type + '" value="' + esc(v) + '">') + '</label>';
    });
    html += '<div class="sa-note">Nothing is sent or created until you review the preview and click Approve.</div><div class="sk-form-actions"><button type="button" class="sk-btn" data-a="close">Cancel</button><button type="submit" class="sk-btn primary">Preview</button></div></form></div>';
    p.innerHTML = html;
    p.onclick = function (e) { var b = e.target.closest('[data-a="close"]'); if (b) close(); };
    var f = p.querySelector("form");
    f.onsubmit = function (e) { e.preventDefault(); collect(f); doPreview(f); };
    var first = f.querySelector("input,textarea"); if (first) first.focus();
  }
  function collect(f) {
    KINDS[state.kind].fields.forEach(function (n) { state.values[n] = f.elements[n].value; });
  }
  function toIso(v) { if (!v) return v; var d = new Date(v); return isNaN(+d) ? v : d.toISOString(); }
  function payload() {
    var out = {}, v = state.values;
    KINDS[state.kind].fields.forEach(function (n) { out[n] = (n === "start" || n === "end") ? toIso(v[n]) : v[n]; });
    if (state.kind === "create_event") { try { out.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) {} }
    return out;
  }

  function doPreview(f) {
    var btn = f.querySelector('button[type="submit"]'); btn.disabled = true; btn.textContent = "Checking…";
    call({ action: "preview", kind: state.kind, payload: payload() }).then(function (d) {
      if (!panel()) return;
      if (d.error || !d.preview) return renderForm(d.error || "Preview failed");
      state.preview = d; renderPreview();
    }).catch(function (e) { renderForm(e.message); });
  }

  function renderPreview(msg, kind) {
    var p = panel(); if (!p) return;
    var d = state.preview, k = KINDS[state.kind], pv = d.preview;
    var html = '<div class="sk-head"><h2>Review: ' + esc(pv.title) + '</h2><button class="sk-btn" data-a="close" aria-label="Close">✕</button></div><div class="sk-body">';
    if (msg) html += '<div class="' + (kind === "ok" ? "sa-ok" : "sa-error") + '" role="alert">' + msg + '</div>';
    html += '<div class="sa-preview">';
    Object.keys(pv.fields).forEach(function (n) {
      html += '<div class="sa-row"><div class="sa-k">' + esc(n) + '</div><div class="sa-v' + (n === "Body" || n === "Description" ? " pre" : "") + '">' + esc(pv.fields[n]) + '</div></div>';
    });
    html += '</div>';
    if (pv.warning) html += '<div class="sa-warn">' + esc(pv.warning) + '</div>';
    if (!d.ready) {
      html += '<div class="sa-error"><strong>Cannot run yet — missing:</strong><ul>' + (d.missing || []).map(function (m) { return "<li>" + esc(m) + "</li>"; }).join("") + '</ul>' + esc(d.detail || "") + '</div>';
    }
    var done = state.done;
    html += '<div class="sk-form-actions">' +
      (done ? '<button class="sk-btn primary" data-a="close">Done</button>' :
        '<button class="sk-btn" data-a="edit">Back to edit</button><button class="sk-btn" data-a="close">Reject</button>' +
        '<button class="sk-btn primary" data-a="approve"' + (d.ready ? "" : " disabled") + '>' + esc(k.approve) + '</button>') + '</div></div>';
    p.innerHTML = html;
    p.onclick = function (e) {
      var b = e.target.closest("[data-a]"); if (!b) return;
      var a = b.dataset.a;
      if (a === "close") close();
      else if (a === "edit") renderForm();
      else if (a === "approve") {
        if (!e.isTrusted) return; // never honor programmatic clicks
        approve(b);
      }
    };
  }

  function approve(btn) {
    if (!state || !state.preview || !state.preview.ready || state.busy) return;
    state.busy = true; btn.disabled = true; btn.textContent = "Working…";
    call({ action: "execute", kind: state.kind, payload: state.preview.payload, approval_token: state.preview.approval_token, approved: true }).then(function (d) {
      state.busy = false;
      if (d.executed) {
        state.done = true;
        renderPreview('Done.' + (d.link ? ' <a href="' + esc(d.link) + '" target="_blank" rel="noopener">Open</a>' : ''), "ok");
      } else {
        state.preview.ready = false; state.preview.missing = d.missing || [d.error || "failed"]; state.preview.detail = d.error;
        renderPreview(esc(d.error || "Failed"));
      }
    }).catch(function (e) { state.busy = false; renderPreview(esc(e.message)); });
  }

  window.SkillsActions = { open: open, close: close, KINDS: Object.keys(KINDS) };
})();
