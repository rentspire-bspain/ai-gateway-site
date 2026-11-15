/* settings-models.js — v231: Models catalog pane (Models parity depth).
   The full live lane catalog with families, best-at descriptions, and free/paid
   tags — the composer dropdown's depth, browsable in Settings. */
(function () {
  "use strict";
  var LANES = [
    { g: "Default", lanes: [
      { n: "Auto (GLM-5.3)", d: "Best all-round quality for general questions; free Qwen fallback if the budget cap is hit.", t: "default" }
    ]},
    { g: "Free lanes", lanes: [
      { n: "Flint v1.0", d: "Coding and agentic work.", t: "free" },
      { n: "Qwen3.8-27B", d: "Fast summaries.", t: "free" }
    ]},
    { g: "Long-context + research", lanes: [
      { n: "Kimi K3.1 Pro", d: "Long-context reasoning and research.", t: "" },
      { n: "DeepSeek V4.1 Flash", d: "Fast generalist.", t: "" }
    ]},
    { g: "Reasoning", lanes: [
      { n: "DeepSeek R1", d: "Deliberate chain-of-thought; hard logic and math.", t: "" },
      { n: "MiniMax M2", d: "Strong reasoning at speed; analysis.", t: "" },
      { n: "Kimi K3.1 Flash", d: "Quick reasoning.", t: "" }
    ]},
    { g: "Open-weight generalists", lanes: [
      { n: "GPT-OSS 120B", d: "Balanced open-weight.", t: "" },
      { n: "GPT-OSS 20B (fast)", d: "Quick answers.", t: "" },
      { n: "Llama 4 Maverick", d: "General chat.", t: "" },
      { n: "Llama 4 Scout", d: "Fast chat.", t: "" },
      { n: "Gemma 4 31B", d: "All-round chat.", t: "" },
      { n: "GLM-5.3 Air (fast)", d: "Speed over depth.", t: "" }
    ]},
    { g: "Uncensored", lanes: [
      { n: "Venice Uncensored", d: "Unfiltered answers, no hedging.", t: "" },
      { n: "Dolphin Uncensored 24B", d: "Unfiltered, no hedging.", t: "" }
    ]},
    { g: "Programming", lanes: [
      { n: "Qwen3 Coder", d: "Code generation and review.", t: "" }
    ]}
  ];
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function build() {
    var pane = el("div", "stg-pane");
    pane.appendChild(el("h3", "stg-pane-title", "Models"));
    pane.appendChild(el("p", "stg-pane-sub", "Every lane in the composer, grouped by what it is best at. Free lanes cost nothing; the rest draw on your plan."));
    var sel = document.getElementById("modelSel");
    var current = sel ? sel.value : "";
    LANES.forEach(function (grp) {
      pane.appendChild(el("div", "stg-group-label", grp.g));
      grp.lanes.forEach(function (m) {
        var row = el("div", "stg-row");
        var left = el("div", "stg-row-left");
        var nm = el("div", "stg-row-label", m.n + (current && m.n.indexOf(sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text.split(" —")[0] : "") === 0 ? "  ·  current" : ""));
        left.appendChild(nm);
        left.appendChild(el("div", "stg-desc", m.d));
        row.appendChild(left);
        var tag = el("span", "stg-desc", m.t === "free" ? "Free" : (m.t === "default" ? "Default" : "Plan"));
        row.appendChild(tag);
        pane.appendChild(row);
      });
    });
    pane.appendChild(el("p", "stg-desc", "Uncensored lanes answer without hedging. Model status is linked in the footer of every page."));
    return pane;
  }
  function register() {
    if (!window.SettingsUI || typeof window.SettingsUI.registerPane !== "function") return;
    window.SettingsUI.registerPane({ id: "models", label: "Models", render: build, after: "notifications" });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", register);
  else register();
})();
