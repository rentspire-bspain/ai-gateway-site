/* Hands-free voice conversation mode for ai.spaincos.com.
 * Integration (one line, before </body>, after the main script):
 *   <script src="/modules/voice-convo.js"></script>
 * Self-wires: loads voice-convo.css, adds a "Talk" header button, wraps global
 * performSearch/speakAnswer (both are global function declarations).
 * Loop: listen -> silence (SILENCE_MS) -> auto-send -> thinking -> speak answer -> listen.
 * Speaking over the answer interrupts it. Exit: Exit button, Esc, or Talk button. */
(function () {
  "use strict";
  var SILENCE_MS = 1500, MIN_CHARS = 2;
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var state = "off"; // off | listening | thinking | speaking
  var rec = null, active = false, finalText = "", interimText = "", silenceTimer = null, restartTimer = null;
  var bar, stateEl, textEl, btn;
  var LABELS = { listening: "Listening", thinking: "Thinking", speaking: "Speaking" };

  function cssLoad() {
    var s = document.currentScript || document.querySelector('script[src$="voice-convo.js"]');
    var href = s && s.src ? s.src.replace(/voice-convo\.js.*$/, "voice-convo.css") : "/modules/voice-convo.css";
    var l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; document.head.appendChild(l);
  }
  function buildUI() {
    bar = document.createElement("div"); bar.className = "vc-bar"; bar.setAttribute("role", "status"); bar.setAttribute("aria-live", "polite");
    bar.innerHTML = '<span class="vc-dot"></span><span class="vc-state"></span><span class="vc-text"></span><button type="button" class="vc-exit">Exit</button>';
    document.body.appendChild(bar);
    stateEl = bar.querySelector(".vc-state"); textEl = bar.querySelector(".vc-text");
    bar.querySelector(".vc-exit").onclick = stop;
    btn = document.createElement("button"); btn.type = "button"; btn.className = "vc-btn width-toggle"; btn.id = "voiceConvoToggle";
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4"/></svg><span>Talk</span>';
    var anchor = document.getElementById("voiceToggle") || document.getElementById("deepResearchToggle");
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(btn, anchor); else { btn.style.cssText = "position:fixed;top:10px;right:10px;z-index:1000"; document.body.appendChild(btn); }
    if (!SR || !window.speechSynthesis) { btn.disabled = true; btn.title = "Voice conversation not supported in this browser"; }
    else { btn.title = "Hands-free voice conversation"; btn.onclick = function () { active ? stop() : start(); }; }
  }
  function setState(s, text) {
    state = s; bar.dataset.state = s; btn.classList.toggle("active", s !== "off");
    stateEl.textContent = LABELS[s] || ""; textEl.textContent = text || "";
    bar.classList.toggle("open", s !== "off");
  }
  function visibleInput() {
    var f = document.getElementById("followupInput"), l = document.getElementById("landingInput");
    return f && f.offsetParent !== null ? f : l;
  }
  function clearTimers() { clearTimeout(silenceTimer); clearTimeout(restartTimer); silenceTimer = restartTimer = null; }

  function startRec() {
    if (!active || rec) return;
    rec = new SR(); rec.continuous = true; rec.interimResults = true; rec.lang = navigator.language || "en-US";
    rec.onresult = onResult;
    rec.onerror = function (e) {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") { stop(); alert("Microphone permission denied"); }
    };
    rec.onend = function () { rec = null; if (active) restartTimer = setTimeout(startRec, 250); };
    try { rec.start(); } catch (e) { rec = null; }
  }
  function onResult(ev) {
    if (!active || state === "thinking") return;
    var fin = "", interim = "";
    for (var i = ev.resultIndex; i < ev.results.length; i++) {
      var r = ev.results[i]; if (r.isFinal) fin += r[0].transcript; else interim += r[0].transcript;
    }
    if (!(fin + interim).trim()) return;
    if (state === "speaking") { // barge-in
      if ((fin + interim).trim().length < MIN_CHARS) return;
      try { speechSynthesis.cancel(); } catch (e) {}
      setState("listening");
    }
    if (fin) finalText += (finalText ? " " : "") + fin.trim();
    interimText = interim;
    var shown = (finalText + " " + interimText).trim();
    textEl.textContent = shown;
    var inp = visibleInput(); if (inp) inp.value = shown;
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(commit, SILENCE_MS);
  }
  function commit() {
    var q = (finalText + " " + interimText).trim();
    finalText = interimText = "";
    if (q.length < MIN_CHARS || !active) return;
    setState("thinking", q);
    var inp = visibleInput(); if (inp) inp.value = "";
    if (typeof window.performSearch === "function") window.performSearch(q);
  }
  function speak(text) {
    if (!active) return;
    var clean = typeof window.stripMarkdownForSpeech === "function" ? window.stripMarkdownForSpeech(text) : String(text || "");
    if (!clean) { setState("listening"); return; }
    var u = new SpeechSynthesisUtterance(clean); u.rate = 1.0;
    var done = function () { if (active && state === "speaking") setState("listening"); };
    u.onend = done; u.onerror = done;
    setState("speaking", clean.slice(0, 120));
    speechSynthesis.speak(u);
  }
  function start() {
    if (active || !SR) return;
    active = true; finalText = interimText = "";
    try { speechSynthesis.cancel(); } catch (e) {}
    setState("listening"); startRec();
  }
  function stop() {
    active = false; clearTimers();
    try { if (rec) { rec.onend = null; rec.abort ? rec.abort() : rec.stop(); } } catch (e) {}
    rec = null; try { speechSynthesis.cancel(); } catch (e) {}
    finalText = interimText = ""; setState("off");
  }

  // Hooks: wrap existing globals so no index.html edits beyond the script tag.
  function hook() {
    var origSpeak = window.speakAnswer;
    window.speakAnswer = function (t) {
      if (active) return speak(t);
      if (origSpeak) return origSpeak.apply(this, arguments);
    };
    var origSearch = window.performSearch;
    if (origSearch) window.performSearch = function () {
      // If a search errors out (no speakAnswer call), the loop would stall; watchdog resumes listening.
      var p = origSearch.apply(this, arguments);
      if (active && p && p.then) p.then(function () {
        setTimeout(function () { if (active && state === "thinking") setState("listening"); }, 1500);
      }, function () { if (active) setState("listening"); });
      return p;
    };
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && active) stop(); });
  function init() { cssLoad(); buildUI(); hook(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  window.VoiceConvo = { start: start, stop: stop, get state() { return state; }, _silenceMs: SILENCE_MS };
})();
