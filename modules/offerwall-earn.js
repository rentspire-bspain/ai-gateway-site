/* offerwall-earn.js — EARN tab of the Tasks overlay: partner offer wall + Neurons balance.
   Host wiring for the offerwall-tasks-tab component (contract per its README v262):
   injects the signed-in user id (subid1) and session token, shows the FTC disclosure,
   polls the postback-driven ledger, and renders daily/monthly cap meters.
   CSP-safe: no inline handlers, DOM built programmatically, external stylesheet only.
   Config: ADSCEND_PUB_ID / ADSCEND_ADWALL_ID stay empty until the publisher account
   is approved — the placeholder state is the designed pre-launch state, not a failure. */
(function () {
  "use strict";
  var URL_ = "https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/neurons-claim";
  var FUNNEL_URL = "https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/offer-funnel";
  var S_ = window.__offerwallFunnel || (window.__offerwallFunnel = {});
  function funnel(stage) {
    if (S_[stage]) return; S_[stage] = 1; // once per page load
    if (!S.token) return;
    try {
      fetch(FUNNEL_URL, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + S.token }, body: JSON.stringify({ stage: stage, source: "bv_earn_tab" }) }).catch(function () {});
    } catch (_e) { /* analytics must never break the tab */ }
  }
  var ADSCEND_PUB_ID = "", ADSCEND_ADWALL_ID = ""; // set when Adscend approves the profile

  /* ---- ad-network consent gate (F-01, v161) ----
     The offer wall embeds a third-party ad network that can set its own cookies.
     It never loads until the user explicitly accepts, with an equal-prominence
     Reject. Choice persists in localStorage and can be changed anytime. */
  var CONSENT_KEY = "ad_consent_v1";
  function consentState() {
    try { var v = localStorage.getItem(CONSENT_KEY); if (v) return v; } catch (e) {}
    /* U-TRU-03/04: honor the browser's Global Privacy Control signal — a GPC opt-out
       defaults the ad network to denied (no stored choice yet). An explicit stored
       choice always wins over GPC, so the user can still change their mind. */
    try { if (navigator.globalPrivacyControl === true) return "denied"; } catch (e) {}
    return null;
  }
  function setConsent(v) {
    try { localStorage.setItem(CONSENT_KEY, v); } catch (e) {}
  }
  function privacyLink() {
    var isBV = /boundview/i.test(location.hostname);
    return isBV ? "/privacy.boundview.html" : "/privacy.html";
  }
  function renderConsentRow(card, onDecide) {
    var row = el("div", "oe-consent");
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", "Partner-offer consent");
    var p = el("p", null, "Partner offers embed a third-party ad network that may set its own cookies. The offer wall stays off unless you accept.");
    var a = el("a", null, "How we use cookies");
    a.href = privacyLink(); a.target = "_blank"; a.rel = "noopener";
    p.appendChild(a);
    row.appendChild(p);
    var btns = el("div", "oe-consent-btns");
    // Equal prominence: identical styling for Accept and Reject (F-01).
    var acc = el("button", "oe-cbtn", "Accept partner offers");
    var rej = el("button", "oe-cbtn", "Reject");
    acc.type = "button"; rej.type = "button";
    acc.addEventListener("click", function () { setConsent("granted"); row.remove(); onDecide(true); });
    rej.addEventListener("click", function () { setConsent("denied"); row.remove(); renderDeniedRow(card, onDecide); });
    btns.appendChild(acc); btns.appendChild(rej);
    row.appendChild(btns);
    card.insertBefore(row, card.firstChild);
  }
  /* ---- TT-FTC-04 (batch 42): A6 per-offer disclosure — interstitial before the
     FIRST wall open (per browser) + a sticky label that stays above the frame. ---- */
  function renderStickyOfferLabel(body) {
    var frameBox = body.querySelector(".oe-frame");
    if (!frameBox || body.querySelector(".oe-a6sticky")) return;
    var bar = el("div", "oe-a6sticky");
    bar.style.cssText = "display:flex;gap:8px;align-items:center;margin:0 0 8px 0;padding:8px 12px;border:1px solid #b98a2e;border-radius:8px;background:rgba(185,138,46,0.08);font-size:12.5px;color:var(--muted,#9aa4b8)";
    bar.textContent = "Paid partner offers — we earn a referral fee when you complete them; each offer's terms come from its network.";
    frameBox.parentNode.insertBefore(bar, frameBox);
  }
  function renderA6Row(card, onAccept) {
    if (card.querySelector(".oe-a6")) return;
    var row = el("div", "oe-consent oe-a6");
    row.setAttribute("role", "dialog");
    row.setAttribute("aria-label", "How partner offers work");
    var p = el("p", null, "Before you open the offer wall: every offer below comes from a third-party partner network. We earn a referral fee when you complete one — that is how free accounts are funded. Each offer has its own terms, timing, and eligibility from its network; Neurons credit only after the network verifies completion. You are never obligated to complete anything.");
    var ok = el("button", "oe-cbtn", "Got it — show offers");
    ok.type = "button";
    ok.addEventListener("click", function () {
      try { localStorage.setItem("a6_disclosure_seen", "yes"); } catch (e) {}
      row.remove();
      renderStickyOfferLabel(card);
      onAccept();
    });
    row.appendChild(p); row.appendChild(ok);
    card.insertBefore(row, card.firstChild);
  }
  /* ---- age / eligibility attestation (U-TRU-07, batch 26) ----
     Partner networks require 18+ participants (COPPA floor is 13+, but ad-network
     offer walls are 18+). The wall and consent flow stay behind a one-time 18+
     attestation; the checkbox is unchecked by default and the confirm button
     stays disabled until it is checked. */
  var AGE_KEY = "age_attest_18_v1";
  function ageAttested() {
    try { return localStorage.getItem(AGE_KEY) === "yes"; } catch (e) { return false; }
  }
  function renderAgeRow(card, onDone) {
    var row = el("div", "oe-consent");
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", "Age eligibility check");
    var p = el("p", null, "Partner offers require an age check: you must be 18 or older to use the offer wall.");
    row.appendChild(p);
    var lbl = el("label", "oe-age-label");
    lbl.style.cssText = "display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px";
    var cb = document.createElement("input");
    cb.type = "checkbox"; cb.id = "oeAge18";
    var ok = el("button", "oe-cbtn", "I am 18 or older — continue");
    ok.type = "button"; ok.disabled = true;
    cb.addEventListener("change", function () { ok.disabled = !cb.checked; });
    ok.addEventListener("click", function () {
      try { localStorage.setItem(AGE_KEY, "yes"); } catch (e) {}
      row.remove(); onDone();
    });
    lbl.appendChild(cb);
    lbl.appendChild(document.createTextNode(" I confirm I am 18 years of age or older."));
    row.appendChild(lbl);
    row.appendChild(ok);
    card.insertBefore(row, card.firstChild);
  }
  function renderDeniedRow(card, onDecide) {
    var row = el("div", "oe-consent");
    var p = el("p", null, "Partner offers are off — the ad network never loads. You can change this anytime.");
    var ch = el("button", "oe-cbtn", "Change choice");
    ch.type = "button";
    ch.addEventListener("click", function () { row.remove(); renderConsentRow(card, onDecide); });
    p.appendChild(ch);
    row.appendChild(p);
    card.insertBefore(row, card.firstChild);
  }
  var SB = (typeof supabase !== "undefined" && window.__SB_URL) || "https://bnxermyboeigvwonfrzx.supabase.co";

  var S = { user: null, token: null, lastBalance: null, alive: true, pollT: null, wallT: null };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function session() {
    try {
      // repo pattern (monitors.js): `const sb` in script scope is NOT window.sb —
      // typeof reaches the global lexical binding instead.
      var c = (typeof sb !== "undefined") ? sb : window.sb;
      return (c && c.auth ? c.auth.getSession() : Promise.resolve(null)).then(function (r) {
        var s = r && r.data && r.data.session;
        S.token = s && s.access_token || "";
        S.user = (s && s.user && s.user.id) || (r && r.user && r.user.id) || "";
      }).catch(function () { S.token = ""; S.user = ""; });
    } catch (e) { S.token = ""; S.user = ""; return Promise.resolve(); }
  }

  function signedOut(body) {
    S.alive = false;
    if (S.pollT) { clearInterval(S.pollT); S.pollT = null; }
    var bal = body.querySelector(".oe-bal-n"); if (bal) bal.textContent = "—";
    var pill = body.querySelector(".oe-pill"); if (pill) { pill.textContent = "Sign in to view your balance"; pill.title = "The Earn tab needs a signed-in session"; }
  }

  function poll(body) {
    if (!S.alive) return;
    session().then(function () {
      if (!S.token || !S.user) { signedOut(body); return; }
      fetch(URL_, { method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + S.token },
        body: JSON.stringify({ action: "balance" }) })
        .then(function (r) {
          if (r.status === 401 || r.status === 403) { signedOut(body); return null; }
          return r.ok ? r.json() : null;
        })
        .then(function (d) {
          if (!d || !S.alive) return;
          funnel("view");
          var bal = d.balance != null ? d.balance : d.neurons;
          var n = body.querySelector(".oe-bal-n");
          if (n && bal != null) {
            n.textContent = Number(bal).toLocaleString();
            if (S.lastBalance != null && bal > S.lastBalance) toast(body, bal - S.lastBalance);
            S.lastBalance = bal;
          }
          var used = Math.min(d.today_offerwall || 0, 10);
          var usedMo = Math.min(d.month_offerwall || d.monthly_offerwall || 0, 60);
          var pill = body.querySelector(".oe-pill");
          if (pill) {
            if (used >= 10) { pill.textContent = "Daily cap reached — resets 4:00 PM PT"; pill.classList.add("cap-hit"); }
            else if (usedMo >= 60) { pill.textContent = "Monthly cap reached — resets on the 1st"; pill.classList.add("cap-hit"); }
            else { pill.textContent = "Today " + used + "/10 · " + usedMo + "/60 this month"; pill.classList.remove("cap-hit"); }
          }
        })
        .catch(function () { /* offline-tolerant: keep last known values */ });
    });
  }

  function toast(body, delta) {
    var t = body.querySelector(".oe-toast"); if (!t) return;
    t.querySelector(".n").textContent = "+" + Number(delta).toLocaleString() + " N";
    t.classList.add("show");
    setTimeout(function () { t.classList.remove("show"); }, 3500);
  }

  function mountWall(body) {
    var frame = body.querySelector(".oe-frame iframe");
    var ph = body.querySelector(".oe-ph");
    // U-TRU-07 age gate: the consent flow and the wall both stay behind an 18+ attestation.
    if (!ageAttested()) {
      var ageCard = body.querySelector(".oe-card");
      if (ageCard && !ageCard.querySelector(".oe-age-label")) {
        renderAgeRow(ageCard, function () { mountWall(body); });
      }
      if (frame) frame.removeAttribute("src");
      return false;
    }
    // F-01 consent gate: the ad-network iframe never loads without explicit acceptance.
    if (consentState() !== "granted") {
      var card = body.querySelector(".oe-card");
      if (card && !card.querySelector(".oe-consent")) {
        if (consentState() === "denied") renderDeniedRow(card, function () { mountWall(body); });
        else renderConsentRow(card, function () { mountWall(body); });
      }
      if (frame) frame.removeAttribute("src");
      return false;
    }
    var stale = body.querySelector(".oe-card .oe-consent:not(.oe-a6)");
    if (stale) stale.remove();
    // TT-FTC-04: one-time A6 per-offer disclosure before the first wall open.
    var a6seen = false;
    try { a6seen = localStorage.getItem("a6_disclosure_seen") === "yes"; } catch (e) {}
    if (!a6seen) {
      var a6card = body.querySelector(".oe-card");
      if (a6card && !a6card.querySelector(".oe-a6")) renderA6Row(a6card, function () { mountWall(body); });
      if (frame) frame.removeAttribute("src");
      return false;
    }
    renderStickyOfferLabel(body);
    if (!ADSCEND_PUB_ID || !ADSCEND_ADWALL_ID || !S.user) {
      ph.style.display = "flex";
      return false;
    }
    funnel("click");
    frame.src = "https://adscendmedia.com/adwall/publisher/" + ADSCEND_PUB_ID +
      "/profile/" + ADSCEND_ADWALL_ID + "?subid1=" + encodeURIComponent(S.user);
    ph.style.display = "none";
    clearTimeout(S.wallT);
    S.wallT = setTimeout(function () {
      if (!frame.__loaded) {
        ph.style.display = "flex";
        ph.querySelector("h3").textContent = "Offer wall could not load";
        ph.querySelector("p").textContent = "The partner offer wall did not respond in time. This is usually temporary — use Refresh offers to retry.";
      }
    }, 15000);
    frame.addEventListener("load", function onl() { frame.__loaded = true; clearTimeout(S.wallT); frame.removeEventListener("load", onl); });
    return true;
  }

  function mount(container, host) {
    var css = document.createElement("link");
    css.rel = "stylesheet"; css.href = "/modules/offerwall-earn.css";
    document.head.appendChild(css);

    var wrap = el("div", "oe-wrap");
    // balance header
    var head = el("div", "oe-head");
    var bal = el("div", "oe-bal");
    var balN = el("div", "oe-bal-n"); balN.textContent = "—";
    var balSmall = el("small"); balSmall.textContent = " N"; balN.appendChild(balSmall);
    var balL = el("div", "oe-bal-l", "Neurons — earn-only credits for AI usage");
    bal.appendChild(balN); bal.appendChild(balL);
    var pill = el("div", "oe-pill", "Today 0/10 · 0/60 this month");
    head.appendChild(bal); head.appendChild(pill);
    wrap.appendChild(head);

    // FTC disclosure (clear and conspicuous)
    var ftc = el("div", "oe-ftc");
    ftc.setAttribute("role", "note"); ftc.setAttribute("aria-label", "Paid-endorsement disclosure");
    ftc.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b98a2e" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16.5v.5"/></svg>';
    var span = el("span");
    var b = el("strong", null, "Paid partner offers. ");
    span.appendChild(b);
    span.appendChild(document.createTextNode(
      "We earn a referral fee when you complete offers below — that is how free accounts are funded. " +
      "Offers come from third-party networks and their terms govern each offer. Neurons credit automatically on verified " +
      "completion only; rewards are capped at 10 offers per day and 60 per month. Neurons are earn-only credits for AI " +
      "usage and can never be cashed out. Caps reset at 4:00 PM Pacific (UTC midnight). Offers and rewards are governed by our "));
    var termsLink = el("a", null, "Terms"); termsLink.href = "/terms.html"; termsLink.target = "_blank"; termsLink.rel = "noopener";
    var privacyLink = el("a", null, "Privacy Policy"); privacyLink.href = "/privacy.html"; privacyLink.target = "_blank"; privacyLink.rel = "noopener";
    span.appendChild(termsLink);
    span.appendChild(document.createTextNode(" and "));
    span.appendChild(privacyLink);
    span.appendChild(document.createTextNode(", including how the partner ad network uses cookies."));
    ftc.appendChild(span);
    wrap.appendChild(ftc);

    // offer wall
    wrap.appendChild(el("div", "oe-sec", "Earn neurons"));
    var card = el("div", "oe-card");
    var bar = el("div", "oe-bar");
    bar.appendChild(el("span", "t", "Offer wall"));
    var btn = el("button", null, "Refresh offers");
    btn.type = "button";
    btn.addEventListener("click", function () { if (!mountWall(container)) { /* awaiting setup */ } else { var f = container.querySelector(".oe-frame iframe"); if (f && f.src) f.src = f.src; } });
    bar.appendChild(btn);
    card.appendChild(bar);
    var frameBox = el("div", "oe-frame");
    var frame = document.createElement("iframe");
    frame.title = "Partner offer wall";
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox");
    frameBox.appendChild(frame);
    var ph = el("div", "oe-ph"); ph.style.display = "none";
    var ic = el("div"); ic.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e8613c" stroke-width="2"><path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg>';
    ph.appendChild(ic);
    ph.appendChild(el("h3", null, "Offer wall connects after setup"));
    var p = el("p", null, "This frame embeds the partner offer wall with your account id already attached — offers you complete credit automatically. Wiring goes live when the Adscend profile is approved.");
    ph.appendChild(p);
    frameBox.appendChild(ph);
    card.appendChild(frameBox);
    wrap.appendChild(card);

    // toast
    var toastEl = el("div", "oe-toast");
    var tn = el("span", "n", "+0 N");
    toastEl.appendChild(tn); toastEl.appendChild(document.createTextNode(" earned"));
    wrap.appendChild(toastEl);

    container.textContent = "";
    container.appendChild(wrap);

    session().then(function () {
      var sub = container.querySelector(".oe-ph .kbd");
      if (sub) sub.textContent = S.user ? S.user.slice(0, 8) + "…" : "sign-in required";
      mountWall(container);
      poll(container);
      S.pollT = setInterval(function () { poll(container); }, 30000);
      window.addEventListener("focus", function () { if (S.alive) poll(container); });
    });
  }

  function unmount() {
    S.alive = false;
    if (S.pollT) { clearInterval(S.pollT); S.pollT = null; }
    clearTimeout(S.wallT);
  }

  window.OfferwallEarn = { mount: mount, unmount: unmount };
})();
