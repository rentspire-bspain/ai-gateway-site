/* local-files.js — v232: Desktop phase 2 (2 of 2): open local text files into the chat.
   File System Access API where available (Chrome/Edge desktop), fallback to the
   classic file input everywhere else. Adds an "Open file" button to the composer row. */
(function (root) {
  "use strict";
  function supported() { return typeof root.showOpenFilePicker === "function"; }
  function addBtn() {
    var row = document.querySelector(".composer-bar, .composer, [class*=composer]");
    var host = document.getElementById("attach-row") || row;
    if (!host || document.getElementById("local-file-btn")) return;
    var btn = document.createElement("button");
    btn.id = "local-file-btn";
    btn.type = "button";
    btn.className = "width-toggle";
    btn.title = "Open a local text file (txt, md, csv, json) into the chat";
    btn.setAttribute("aria-label", "Open local file");
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7"/></svg>';
    btn.addEventListener("click", openPicker);
    host.appendChild(btn);
  }
  function fileToChat(file) {
    if (!file) return;
    if (file.size > 500_000) { alert("File too large for the chat (500KB max)."); return; }
    var composer = document.getElementById("composer") || document.querySelector("textarea,input[placeholder*=Ask]");
    if (!composer) return;
    var reader = new FileReader();
    reader.onload = function () {
      var text = String(reader.result || "").slice(0, 200_000);
      var label = "File: " + file.name + " (" + Math.round(file.size / 1024) + "KB)" + String.fromCharCode(10) + "```" + String.fromCharCode(10) + text + String.fromCharCode(10) + "```";
      composer.value = label;
      composer.dispatchEvent(new Event("input", { bubbles: true }));
      composer.focus();
    };
    reader.readAsText(file);
  }
  function openPicker() {
    if (supported()) {
      root.showOpenFilePicker({ multiple: false, types: [{ description: "Text", accept: { "text/plain": [".txt", ".md", ".csv", ".json"], "application/json": [".json"] } }] })
        .then(function (handles) { return handles[0].getFile(); })
        .then(fileToChat)
        .catch(function () { /* user canceled */ });
    } else {
      var inp = document.createElement("input");
      inp.type = "file";
      inp.accept = ".txt,.md,.csv,.json";
      inp.style.display = "none";
      inp.addEventListener("change", function () { fileToChat(inp.files && inp.files[0]); inp.remove(); });
      document.body.appendChild(inp);
      inp.click();
    }
  }
  function wire() {
    // F-32 part 3: composer pill insert post-paint shifted the landing — defer to first interaction
    (root.__onFirstInteraction || addBtn)(addBtn);
    // the composer row can be re-created; keep the button present
    // F-32 part 3: observer-triggered mounts also defer to first interaction
    new MutationObserver(function () { (root.__onFirstInteraction || addBtn)(addBtn); }).observe(document.body, { childList: true, subtree: false });
  }
  if (root.BUILD && root.BUILD.modules) root.BUILD.modules.push({ id: "local-files", init: wire });
  if (document.readyState !== "loading") wire();
  else document.addEventListener("DOMContentLoaded", wire);
})(window);
