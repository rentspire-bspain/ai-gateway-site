/* Single owner of install UX. Native prompt where offered (Chrome/Edge desktop + Android);
   manual steps for iOS Safari (Add to Home Screen) and macOS Safari 17+ (File > Add to Dock). */
(() => {
  "use strict";

  const standalone = window.matchMedia("(display-mode: standalone)");
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const safari = ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  const macSafari = !ios && /Macintosh/.test(ua) && /Safari/.test(ua) &&
    !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Firefox/.test(ua);
  const manual = safari || macSafari;
  let pendingPrompt;
  let installed = false;
  let button;
  let help;

  function update() {
    if (!button || !help) return;
    button.hidden = installed || standalone.matches || navigator.standalone === true ||
      (!pendingPrompt && !manual);
    if (button.hidden || pendingPrompt) {
      help.hidden = true;
      button.removeAttribute("aria-expanded");
      button.removeAttribute("aria-controls");
    } else {
      button.setAttribute("aria-expanded", String(!help.hidden));
      button.setAttribute("aria-controls", help.id);
    }
  }

  window.addEventListener("beforeinstallprompt", event => {
    if (typeof event.prompt !== "function") return;
    event.preventDefault();
    if (installed || standalone.matches || navigator.standalone === true) return;
    pendingPrompt = event;
    update();
  });

  window.addEventListener("appinstalled", () => {
    installed = true;
    pendingPrompt = undefined;
    update();
  });

  standalone.addEventListener?.("change", update);

  function init() {
    button = document.getElementById("pwaInstall");
    help = document.getElementById("pwaInstallHelp");
    if (!button || !help) return;
    if (macSafari) help.textContent = "In Safari, choose File, then Add to Dock, then Add.";
    update();
    button.addEventListener("click", async () => {
      if (button.hidden) return;
      if (!pendingPrompt) {
        help.hidden = !help.hidden;
        button.setAttribute("aria-expanded", String(!help.hidden));
        return;
      }

      const event = pendingPrompt;
      pendingPrompt = undefined; // a browser prompt can only be used once
      button.disabled = true;
      try {
        const shown = await event.prompt();
        const choice = shown?.outcome ? shown : await event.userChoice;
        if (choice?.outcome === "accepted") installed = true;
      } catch {
        // A stale or unavailable prompt cannot be retried; wait for a new event.
      } finally {
        button.disabled = false;
        update();
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
