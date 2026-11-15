/* voice-readaloud.js — v230: read-aloud for assistant messages (Voice parity).
   Uses the browser's speechSynthesis (no server round-trip, works offline).
   Adds a small speaker button to each assistant message; one active
   utterance at a time; click again to stop. */
(function (root) {
  "use strict";
  var active = null;
  function supported() { return typeof root.speechSynthesis === "object" && typeof root.speechSynthesis.speak === "function"; }
  function stop() {
    try { root.speechSynthesis.cancel(); } catch (e) {}
    if (active) {
      active.btn.setAttribute("aria-label", "Read aloud");
      active.btn.textContent = "🔊";
      active = null;
    }
  }
  function speak(btn, text) {
    if (!supported()) return;
    if (active && active.btn === btn) { stop(); return; }
    stop();
    var u = new root.SpeechSynthesisUtterance(String(text).slice(0, 6000));
    try { u.rate = parseFloat(localStorage.getItem("ai_tts_rate") || "1") || 1.0; } catch (e) { u.rate = 1.0; }
    u.onend = stop; u.onerror = stop;
    btn.textContent = "⏹";
    btn.setAttribute("aria-label", "Stop reading");
    active = { btn: btn, u: u };
    root.speechSynthesis.speak(u);
  }
  function styleBtn(b) {
    b.type = "button";
    b.className = "readaloud-btn";
    b.textContent = "🔊";
    b.setAttribute("aria-label", "Read aloud");
    b.title = "Read aloud";
    return b;
  }
  function wire() {
    if (!supported()) return;
    // find assistant message containers and attach the button
    var host = document.getElementById("moduleRoot") || document.body;
    var obs = new MutationObserver(function () {
      var msgs = document.querySelectorAll(".msg-assistant, [data-role=assistant], .assistant-msg");
      msgs.forEach(function (m) {
        if (m.querySelector(".readaloud-btn")) return;
        var bar = m.querySelector(".msg-actions, .answer-actions") || m;
        var btn = styleBtn(document.createElement("button"));
        btn.addEventListener("click", function () {
          var text = m.innerText || "";
          text = text.replace(/🔊|⏹/g, "").trim();
          speak(btn, text);
        });
        bar.appendChild(btn);
      });
    });
    obs.observe(host, { childList: true, subtree: true });
  }
  if (root.BUILD && root.BUILD.modules) root.BUILD.modules.push({ id: "voice-readaloud", init: wire });
  if (document.readyState !== "loading") wire();
  else document.addEventListener("DOMContentLoaded", wire);
})(window);
