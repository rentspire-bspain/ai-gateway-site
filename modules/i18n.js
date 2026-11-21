/* i18n — honest, partial UI localization foundation.
   Locales: en (complete, source language), es (PARTIAL: sidebar nav, composer, landing hero,
   Settings headers/nav + Language row). Everything not in the dictionary stays English;
   model answers are never translated by this module. Exposes window.I18N.
   Preference order: ?lang=xx  >  localStorage ai_lang  >  navigator.languages  >  en. */
(function () {
  "use strict";
  var SUPPORTED = { en: "English", es: "Español" };
  var COVERAGE = { en: "complete", es: "partial" };
  var KEY = "ai_lang";

  /* selector -> [attr|"text"|"html", key]. Static chrome only; user content is never touched. */
  var TARGETS = [
    ["#newThreadBtn", "textnode", "New Thread"],
    ["#navProjects span", "text", "Projects"], ["#navLibrary span", "text", "Library"],
    ["#navSkills span", "text", "Skills"], ["#navDocs span", "text", "Docs"],
    ["#navTasks span", "text", "Tasks"], ["#navHubs span", "text", "Hubs"],
    ["#navFleet span", "text", "Fleet"], ["#navPlugins span", "text", "Plugins"],
    ["#navDiscover span", "text", "Discover"],
    ["#threadSearch", "placeholder", "Search threads..."],
    ["#recentLabel", "text", "Recent"],
    ["#newThreadIcon", "title", "New thread"],
    ["#collapseSidebar", "aria-label", "Collapse sidebar"],
    ["#landingInput", "placeholder", "Ask anything..."],
    ["#landingInput", "aria-label", "Ask anything"],
    ["#landingSubmit", "aria-label", "Submit question"],
    [".landing-subtitle", "text", "Ask anything. Powered by open-weight models."],
    [".landing-title", "html", "Where knowledge <em>begins</em>"],
    [".stg-overlay h2", "text", "Settings"],
    [".stg-nav-btn span", "text", null], [".stg-pane-title", "text", null],
    [".stg-pane-sub", "text", null], [".stg-label", "text", null]
  ];

  var ES = {
    "New Thread": "Nuevo hilo", "New thread": "Nuevo hilo",
    "Projects": "Proyectos", "Library": "Biblioteca", "Skills": "Habilidades", "Docs": "Documentos",
    "Tasks": "Tareas", "Hubs": "Centros", "Fleet": "Flota", "Plugins": "Complementos", "Discover": "Descubrir",
    "Search threads...": "Buscar hilos...", "Recent": "Recientes", "Collapse sidebar": "Contraer barra lateral",
    "Ask anything...": "Pregunta lo que quieras...", "Ask anything": "Pregunta lo que quieras",
    "Submit question": "Enviar pregunta",
    "Ask anything. Powered by open-weight models.": "Pregunta lo que quieras. Con modelos de pesos abiertos.",
    "Where knowledge <em>begins</em>": "Donde el conocimiento <em>comienza</em>",
    "Settings": "Configuración", "Preferences": "Preferencias", "Personalize": "Personalizar",
    "Memory": "Memoria", "Site instructions": "Instrucciones del sitio", "Notifications": "Notificaciones",
    "Connectors": "Conectores", "Teammates": "Compañeros", "Enterprise": "Empresa", "Usage": "Uso",
    "Data controls": "Control de datos", "About": "Acerca de",
    "Appearance and behavior defaults.": "Apariencia y comportamiento predeterminados.",
    "Help the assistant tailor answers to you.": "Ayuda al asistente a adaptar las respuestas a ti.",
    "Facts the assistant remembers and applies to every answer.": "Datos que el asistente recuerda y aplica en cada respuesta.",
    "Custom instructions applied to every answer.": "Instrucciones personalizadas aplicadas a cada respuesta.",
    "Choose how you hear about activity.": "Elige cómo recibir avisos de actividad.",
    "Theme": "Tema", "Language": "Idioma", "Interface and answer language.": "Idioma de la interfaz.",
    "Default answer width": "Ancho de respuesta predeterminado",
    "Read answers aloud": "Leer respuestas en voz alta", "Read-aloud speed": "Velocidad de lectura"
  };
  var DICT = { es: ES };

  var lang = "en";
  var orig = new WeakMap();   // node/attr key -> original English
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
  function norm(l) { l = String(l || "").toLowerCase().split(/[-_]/)[0]; return SUPPORTED[l] ? l : null; }

  function detect() {
    var q = null;
    try { q = norm(new URLSearchParams(location.search).get("lang")); } catch (e) {}
    if (q) { ls(KEY, q); return q; }
    var s = norm(ls(KEY)); if (s) return s;
    var nl = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]);
    for (var i = 0; i < nl.length; i++) { var n = norm(nl[i]); if (n) return n; }
    return "en";
  }

  function t(en) { var d = DICT[lang]; return (d && Object.prototype.hasOwnProperty.call(d, en) && d[en]) || en; }

  function setVal(node, mode, key, en) {
    if (mode === "text") {
      if (lang === "en") { if (node.dataset.i18nEn) { node.textContent = node.dataset.i18nEn; delete node.dataset.i18nEn; } return; }
      var base = node.dataset.i18nEn || node.textContent.trim();
      if (en && base !== en) return;
      var tr = t(base);
      if (tr !== base || node.dataset.i18nEn) { node.dataset.i18nEn = base; node.textContent = tr; }
    } else if (mode === "html") {
      if (!node.dataset.i18nEn) node.dataset.i18nEn = node.innerHTML;
      node.innerHTML = lang === "en" ? node.dataset.i18nEn : t(en);
    } else if (mode === "textnode") {
      for (var c = node.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3 && (c.nodeValue.trim() === en || (c.__en && c.__en === en))) {
          c.__en = en; c.nodeValue = c.nodeValue.replace(/\S[\s\S]*\S|\S/, lang === "en" ? en : t(en)); break;
        }
      }
    } else if (mode !== "skip") {
      var a = "i18nEn" + mode.replace(/[^a-z]/g, "");
      if (node.dataset[a] === undefined) node.dataset[a] = node.getAttribute(mode) || "";
      var b = node.dataset[a];
      if (en && b !== en) return;
      node.setAttribute(mode, lang === "en" ? b : t(b));
    }
  }

  var busy = false;
  function apply(root) {
    busy = true;
    try {
      document.documentElement.lang = lang;
      TARGETS.forEach(function (T) {
        var nodes; try { nodes = (root || document).querySelectorAll(T[0]); } catch (e) { return; }
        for (var i = 0; i < nodes.length; i++) setVal(nodes[i], T[1], T[0], T[2]);
      });
    } finally { busy = false; }
  }
  var pending = false;
  function schedule() {
    if (pending) return; pending = true;
    (window.requestAnimationFrame || setTimeout)(function () { pending = false; apply(); });
  }

  function set(l) {
    l = norm(l); if (!l) return false;
    lang = l; ls(KEY, l); apply();
    try { document.dispatchEvent(new CustomEvent("i18n:change", { detail: { lang: l, coverage: COVERAGE[l] } })); } catch (e) {}
    return true;
  }

  lang = detect();
  window.I18N = {
    get lang() { return lang; }, supported: SUPPORTED, coverage: COVERAGE, t: t, set: set, apply: apply,
    note: function () {
      return COVERAGE[lang] === "complete" ? "" :
        lang === "es" ? "Traducción parcial: la barra lateral, el compositor y los encabezados de Configuración están en español; el resto sigue en inglés."
                      : "Partial translation.";
    }
  };

  function start() {
    apply();
    if (window.MutationObserver) {
      new MutationObserver(function () { if (!busy && lang !== "en") schedule(); })
        .observe(document.body, { childList: true, subtree: true });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
