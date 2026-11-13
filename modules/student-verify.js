/* student-verify.js — Settings pane entry point + marketing banner for student
   email verification (Campus Growth, master doc §32).
   Entry point: a "Student verification" section in the Settings pane.
   Banner: dismissible site banner shown to signed-in unverified users.
   Both call the student-verify-send edge function; the pane reads status
   via the student_verification_request error shapes (user_already_verified
   means verified). Design: site tokens, Fraunces display accents (v4 family). */
(function () {
  "use strict";
  if (!document.getElementById("stv-styles")) {
    var st = document.createElement("style");
    st.id = "stv-styles";
    st.textContent = [
      ".stv-banner{position:fixed;left:50%;transform:translateX(-50%);bottom:20px;z-index:900;display:flex;align-items:center;gap:14px;padding:14px 18px;border:1px solid var(--border-light);border-radius:var(--radius);background:var(--bg-elevated);box-shadow:0 8px 32px rgba(0,0,0,0.45);max-width:min(520px,calc(100vw - 32px));}",
      ".stv-banner b{font-family:Fraunces,Georgia,serif;font-size:15px;}",
      ".stv-banner p{margin:0;font-size:13px;color:var(--text-muted);}",
      ".stv-banner button{width:auto;padding:9px 16px;font-size:13px;flex:none;}",
      ".stv-banner .stv-x{background:none;border:0;color:var(--text-faint);font-size:18px;padding:4px 8px;cursor:pointer;flex:none}",
      ".stv-card{border:1px solid var(--border);border-radius:var(--radius-sm);padding:16px;background:var(--bg-surface);margin-top:12px;}",
      ".stv-ok{display:flex;gap:14px;align-items:center;}",
      ".stv-ok .dot{width:40px;height:40px;border-radius:50%;background:var(--ok);display:grid;place-content:center;flex:none}",
      ".stv-err{margin-top:10px;background:#2a1a1e;border:1px solid #7f2b3a;color:#ffb3c0;border-radius:var(--radius-sm);padding:8px 12px;font-size:13px;display:none}"
    ].join("\n");
    document.head.appendChild(st);
  }
  function client() { return (typeof sb !== "undefined") ? sb : null; }
  var URL_ = "https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/student-verify-send";
  var ERRS = {
    email_must_be_edu: "That doesn't look like a school email — it needs to end in .edu.",
    domain_not_eligible: "We don't recognize that school yet. Email us and we'll add it.",
    email_already_claimed: "That .edu address already claimed its bonus.",
    user_already_verified: "You've already claimed your student bonus.",
    too_many_attempts: "Too many attempts. Start over with a new verification email.",
    email_provider_not_configured: "Email sending isn't configured yet — try again soon.",
    email_send_failed: "Couldn't send the email right now. Try again in a minute."
  };
  function authHeaders() {
    var c = client();
    if (!c || !c.auth) return Promise.resolve(null);
    return c.auth.getSession().then(function (r) {
      var t = r && r.data && r.data.session && r.data.session.access_token;
      return t ? { "Authorization": "Bearer " + t, "Content-Type": "application/json" } : null;
    });
  }

  /* ---- Settings pane section (rendered into the pane container the settings
     module provides; matches how settings-neurons.js builds its pane) ---- */
  window.StudentVerifyPane = function (root) {
    root.innerHTML =
      '<h2 style="font-family:Fraunces,Georgia,serif">Student verification</h2>' +
      '<p style="color:var(--text-muted);font-size:13px;margin:6px 0 0">Verify a .edu school email for 1,000 bonus query credits, 500 Neurons, and a higher free daily limit. One bonus per person, ever.</p>' +
      '<div class="stv-card" id="stvCard">' +
        '<div id="stvForm">' +
          '<label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:6px">School email (.edu)</label>' +
          '<input id="stvEmail" type="email" placeholder="you@usc.edu" autocomplete="email" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:15px;padding:11px 12px;outline:none">' +
          '<div class="stv-err" id="stvErr"></div>' +
          '<button id="stvSend" style="margin-top:12px">Send verification email</button>' +
          '<p style="font-size:11px;color:var(--text-faint);margin:10px 0 0">We email you a link — open it on this device to finish. Disclosures v1.</p>' +
        '</div>' +
        '<div id="stvSent" style="display:none">' +
          '<b style="font-family:Fraunces,Georgia,serif">Check your email</b>' +
          '<p style="font-size:13px;color:var(--text-muted)">We sent a verification link to <b id="stvMailTo"></b>. It expires in 24 hours. Or paste the code:</p>' +
          '<input id="stvCode" placeholder="Paste verification code" style="width:100%;margin-top:10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:15px;padding:11px 12px">' +
          '<div class="stv-err" id="stvErr2"></div>' +
          '<button id="stvConfirm" style="margin-top:12px">Verify</button>' +
        '</div>' +
        '<div id="stvDone" style="display:none" class="stv-ok">' +
          '<div class="dot"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#06281d" stroke-width="3"><path d="M5 13l5 5 9-11"/></svg></div>' +
          '<div><b style="font-family:Fraunces,Georgia,serif">Verified student</b><p style="margin:2px 0 0;font-size:13px;color:var(--text-muted)" id="stvDoneDetail"></p></div>' +
        '</div>' +
      '</div>';
    var $ = function (id) { return root.querySelector("#" + id); };
    function err(el, msg) { el.textContent = msg; el.style.display = "block"; }
    function send() {
      var email = $("stvEmail").value.trim();
      if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.edu$/.test(email)) { err($("stvErr"), ERRS.email_must_be_edu); return; }
      $("stvSend").disabled = true; $("stvSend").textContent = "Sending…";
      authHeaders().then(function (h) {
        if (!h) { err($("stvErr"), "Sign in to verify your email."); return null; }
        return fetch(URL_, { method: "POST", headers: h, body: JSON.stringify({ email: email }) }).then(function (r) { return r.json(); });
      }).then(function (d) {
        if (!d) return;
        if (d.ok) { $("stvForm").style.display = "none"; $("stvSent").style.display = "block"; $("stvMailTo").textContent = email; }
        else err($("stvErr"), ERRS[d.error] || "Something went wrong. Try again.");
      }).catch(function () { err($("stvErr"), "Network hiccup — try again."); })
      .finally(function () { $("stvSend").disabled = false; $("stvSend").textContent = "Send verification email"; });
    }
    $("stvSend").onclick = send;
    $("stvConfirm").onclick = function () {
      var code = $("stvCode").value.trim();
      if (!code) { err($("stvErr2"), "Paste the code from your email."); return; }
      authHeaders().then(function (h) {
        return fetch("https://bnxermyboeigvwonfrzx.supabase.co/rest/v1/rpc/student_verification_confirm", {
          method: "POST", headers: { "Content-Type": "application/json", "apikey": "sb_publishable_nrmUxUfyytgCscz8zfQ9Cw_LapbvKIb", "Authorization": h.Authorization },
          body: JSON.stringify({ p_token: code })
        }).then(function (r) { return r.json(); });
      }).then(function (d) {
        if (d && d.ok) {
          $("stvSent").style.display = "none"; $("stvDone").style.display = "flex";
          $("stvDoneDetail").textContent = "1,000 bonus credits and 500 Neurons are in your account.";
        } else err($("stvErr2"), (d && ERRS[d.error]) || "That didn't work. Try again.");
      }).catch(function () { err($("stvErr2"), "Network hiccup — try again."); });
    };
  };

  /* ---- Marketing banner (shown to signed-in, unverified users;
     snoozed 7 days on dismiss) ---- */
  window.StudentVerifyBanner = function () {
    if (localStorage.getItem("stv_banner_snooze") > Date.now()) return;
    authHeaders().then(function (h) {
      if (!h) return; // signed out — no banner
      return fetch("https://bnxermyboeigvwonfrzx.supabase.co/rest/v1/rpc/student_verification_status", {
        method: "POST", headers: { "Content-Type": "application/json", "apikey": "sb_publishable_nrmUxUfyytgCscz8zfQ9Cw_LapbvKIb", "Authorization": h.Authorization },
        body: "{}"
      }).then(function (r) { return r.json(); });
    }).then(function (d) {
      if (!d || d.verified || d.pending) return; // already verified or link in flight
      var b = document.createElement("div");
      b.className = "stv-banner";
      b.innerHTML = '<div><b>Student? Get 1,000 bonus credits</b><p>Verify your .edu email — takes a minute, one bonus forever.</p></div>' +
        '<button id="stvGo">Verify</button><button class="stv-x" aria-label="Dismiss">×</button>';
      document.body.appendChild(b);
      b.querySelector(".stv-x").onclick = function () {
        b.remove();
        localStorage.setItem("stv_banner_snooze", String(Date.now() + 7 * 864e5));
      };
      b.querySelector("#stvGo").onclick = function () {
        b.remove();
        document.dispatchEvent(new CustomEvent("stv:open-settings")); // settings module listens and opens the Student verification pane
      };
    }).catch(function () {});
  };
})();
