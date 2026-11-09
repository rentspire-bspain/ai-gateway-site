/* DocsUI — full-screen documentation library overlay for ai.spaincos.com.
   Offline, searchable copies of the official Claude (Anthropic), OpenAI, and Perplexity
   developer docs. Data is loaded lazily from modules/data/docs-<vendor>.json.
   Exposes window.DocsUI = { open, close }. Esc closes. */
(function () {
  "use strict";

  var VENDORS = [
    { key: "claude", label: "Claude", full: "Claude (Anthropic)" },
    { key: "openai", label: "OpenAI", full: "OpenAI" },
    { key: "perplexity", label: "Perplexity", full: "Perplexity" }
  ];
  var DATA_PATH = "modules/data/docs-";

  var state = {
    vendor: "claude",
    q: "",
    pages: {},      // vendor -> [{title,url,vendor,body}]
    loaded: {},     // vendor -> "ok" | "loading" | "error"
    selected: {},   // vendor -> index within filtered list
    root: null
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- tiny markdown renderer ---------- */

  function resolveUrl(href, base) {
    try {
      if (/^https?:\/\//i.test(href)) return href;
      var u = new URL(href, base);
      return u.href.replace(/\.md(\?|#|$)/, function (m) { return m === ".md" ? "" : m.slice(2); });
    } catch (e) { return href; }
  }

  function inline(s, base) {
    // code spans first so their content is protected
    var codes = [];
    s = s.replace(/`([^`\n]+)`/g, function (m, c) {
      codes.push("<code>" + esc(c) + "</code>");
      return "\u0000CODE" + (codes.length - 1) + "\u0000";
    });
    s = esc(s);
    // images
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, '<img src="$2" alt="$1">');
    // links
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, function (m, t, h) {
      var url = resolveUrl(h, base);
      return '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + t + "</a>";
    });
    // bold / italic / strikethrough
    s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,!?)]|$)/g, "$1<em>$2</em>");
    s = s.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
    // restore code spans
    s = s.replace(/\u0000CODE(\d+)\u0000/g, function (m, i) { return codes[+i]; });
    return s;
  }

  function renderMarkdown(md, base) {
    var lines = String(md || "").replace(/\r\n/g, "\n").split("\n");
    var out = [], i = 0;
    var fence = null, buf = [];

    function flushCode() {
      if (!fence) return;
      var code = esc(buf.join("\n").replace(/^\n+|\n+$/g, ""));
      out.push("<pre><code>" + code + "</code></pre>");
      fence = null; buf = [];
    }

    while (i < lines.length) {
      var line = lines[i];

      var m = /^\s*```/.exec(line);
      if (m) {
        if (fence) { flushCode(); } else { fence = true; buf = []; }
        i++; continue;
      }
      if (fence) { buf.push(line); i++; continue; }

      // blank
      if (!line.trim()) { i++; continue; }

      // table: current line has | and next line is a separator row
      if (line.indexOf("|") > -1 && i + 1 < lines.length &&
          /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].indexOf("-") > -1) {
        var head = splitRow(line);
        var rows = [];
        i += 2;
        while (i < lines.length && lines[i].indexOf("|") > -1 && lines[i].trim()) {
          rows.push(splitRow(lines[i])); i++;
        }
        var t = "<table><thead><tr>" + head.map(function (c) { return "<th>" + inline(c, base) + "</th>"; }).join("") + "</tr></thead><tbody>";
        rows.forEach(function (r) {
          t += "<tr>" + r.map(function (c) { return "<td>" + inline(c, base) + "</td>"; }).join("") + "</tr>";
        });
        out.push(t + "</tbody></table>");
        continue;
      }

      // heading
      var h = /^(#{1,6})\s+(.*)$/.exec(line);
      if (h) {
        var lv = Math.min(h[1].length + 1, 6);
        out.push("<h" + lv + ">" + inline(h[2].replace(/\s*#+\s*$/, ""), base) + "</h" + lv + ">");
        i++; continue;
      }

      // hr
      if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) { out.push("<hr>"); i++; continue; }

      // blockquote (consecutive > lines)
      if (/^\s*>/.test(line)) {
        var q = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) {
          q.push(lines[i].replace(/^\s*>\s?/, "")); i++;
        }
        out.push("<blockquote>" + renderMarkdown(q.join("\n"), base) + "</blockquote>");
        continue;
      }

      // list
      if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
        var items = [], ordered = /^\s*\d+[.)]\s+/.test(line);
        var stack = [{ ind: 0, ol: ordered, buf: [] }];
        while (i < lines.length && (/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) || (items.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*#{1,6}\s/.test(lines[i])))) {
          var li = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
          if (li) {
            var ind = Math.floor(li[1].replace(/\t/g, "  ").length / 2);
            var isOl = /\d/.test(li[2]);
            while (stack.length > 1 && ind < stack[stack.length - 1].ind) {
              var done = stack.pop();
              stack[stack.length - 1].buf.push(closeList(done));
            }
            if (ind > stack[stack.length - 1].ind) {
              stack.push({ ind: ind, ol: isOl, buf: [] });
            } else if (stack.length > 1 && isOl !== stack[stack.length - 1].ol) {
              var done2 = stack.pop();
              stack[stack.length - 1].buf.push(closeList(done2));
              stack.push({ ind: ind, ol: isOl, buf: [] });
            }
            stack[stack.length - 1].buf.push("<li>" + inline(li[3], base) + "</li>");
          } else if (stack[stack.length - 1].buf.length) {
            // continuation text for the previous item
            var prev = stack[stack.length - 1].buf.pop();
            stack[stack.length - 1].buf.push(prev.replace(/<\/li>$/, " " + inline(lines[i].trim(), base) + "</li>"));
          }
          i++;
        }
        while (stack.length > 1) { var d = stack.pop(); stack[stack.length - 1].buf.push(closeList(d)); }
        out.push(closeList(stack[0]));
        continue;
      }

      // paragraph: gather until blank / structural line
      var para = [line];
      i++;
      while (i < lines.length && lines[i].trim() && !/^\s*(#{1,6}\s|```|>|\|)/.test(lines[i]) && !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
        para.push(lines[i]); i++;
      }
      out.push("<p>" + inline(para.join("\n"), base).replace(/\n/g, "<br>") + "</p>");
    }
    flushCode();
    return out.join("\n");
  }

  function closeList(l) {
    return "<" + (l.ol ? "ol" : "ul") + ">" + l.buf.join("") + "</" + (l.ol ? "ol" : "ul") + ">";
  }

  function splitRow(line) {
    return line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map(function (c) { return c.trim(); });
  }

  /* ---------- data loading ---------- */

  function load(vendor, cb) {
    if (state.loaded[vendor] === "ok") { cb("ok"); return; }
    if (state.loaded[vendor] === "loading") return;
    state.loaded[vendor] = "loading";
    fetch(DATA_PATH + vendor + ".json")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (pages) {
        state.pages[vendor] = Array.isArray(pages) ? pages : [];
        state.loaded[vendor] = "ok";
        cb("ok");
      })
      .catch(function (e) {
        state.loaded[vendor] = "error";
        cb("error", e);
      });
  }

  /* ---------- rendering ---------- */

  function ensureRoot() {
    if (state.root && document.body.contains(state.root)) return;
    var old = document.getElementById("docsRoot");
    if (old) old.remove();
    var root = document.createElement("div");
    root.id = "docsRoot";
    root.innerHTML =
      '<div class="dx-header">' +
        '<div class="dx-top">' +
          '<h2 class="dx-title"><span class="dx-book">&#128218;</span> Docs Library</h2>' +
          '<div class="dx-search"><span>&#128269;</span><input type="search" placeholder="Search documentation&hellip;" aria-label="Search docs"></div>' +
          '<button class="dx-close" title="Close (Esc)" aria-label="Close docs library">&times;</button>' +
        "</div>" +
        '<div class="dx-tabs" role="tablist"></div>' +
      "</div>" +
      '<div class="dx-body">' +
        '<div class="dx-list" role="list"></div>' +
        '<div class="dx-reader"><div class="dx-reader-inner"></div></div>' +
      "</div>";
    document.body.appendChild(root);
    state.root = root;

    root.querySelector(".dx-close").addEventListener("click", close);
    var input = root.querySelector(".dx-search input");
    input.addEventListener("input", function () {
      state.q = this.value;
      renderList();
    });
    root.querySelector(".dx-tabs").addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest(".dx-tab") : null;
      if (!b) return;
      state.vendor = b.getAttribute("data-vendor");
      state.q = "";
      input.value = "";
      root.classList.remove("showing-page");
      renderTabs(); renderVendor();
    });
    root.querySelector(".dx-list").addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest(".dx-item") : null;
      if (!b) return;
      var idx = +b.getAttribute("data-idx");
      state.selected[state.vendor] = idx;
      renderList(); renderPage();
      root.classList.add("showing-page");
    });
    root.querySelector(".dx-reader").addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest(".dx-back") : null;
      if (b) root.classList.remove("showing-page");
    });
  }

  function renderTabs() {
    var tabs = state.root.querySelector(".dx-tabs");
    tabs.innerHTML = VENDORS.map(function (v) {
      var n = state.loaded[v.key] === "ok" && state.pages[v.key] ? state.pages[v.key].length : "";
      return '<button class="dx-tab' + (v.key === state.vendor ? " active" : "") + '" data-vendor="' + v.key + '" role="tab">' +
        esc(v.label) + (n !== "" ? '<span class="n">' + n + "</span>" : "") + "</button>";
    }).join("");
  }

  function filtered() {
    var pages = state.pages[state.vendor] || [];
    var q = state.q.trim().toLowerCase();
    if (!q) return pages.map(function (p, i) { return { p: p, i: i }; });
    var out = [];
    pages.forEach(function (p, i) {
      var t = (p.title || "").toLowerCase(), b = (p.body || "").toLowerCase();
      if (t.indexOf(q) > -1 || b.indexOf(q) > -1) out.push({ p: p, i: i });
    });
    return out;
  }

  function renderList() {
    var list = state.root.querySelector(".dx-list");
    if (state.loaded[state.vendor] !== "ok") return;
    var rows = filtered();
    var sel = state.selected[state.vendor];
    list.innerHTML =
      '<div class="dx-count">' + rows.length + " page" + (rows.length === 1 ? "" : "s") +
      (state.q.trim() ? ' matching &ldquo;' + esc(state.q.trim()) + "&rdquo;" : "") + "</div>" +
      (rows.length === 0
        ? '<div class="dx-empty">No pages match your search.</div>'
        : rows.map(function (r, k) {
            return '<button class="dx-item' + (r.i === sel ? " active" : "") + '" data-idx="' + r.i + '">' +
              esc(r.p.title) + '<span class="u">' + esc(r.p.url) + "</span></button>";
          }).join(""));
  }

  function renderReader(html) {
    state.root.querySelector(".dx-reader-inner").innerHTML = html;
    var r = state.root.querySelector(".dx-reader");
    if (r) r.scrollTop = 0;
  }

  function renderPage() {
    var pages = state.pages[state.vendor] || [];
    var idx = state.selected[state.vendor];
    var p = pages[idx];
    if (!p) {
      renderReader('<div class="dx-error"><h3>No page selected</h3><p>Pick a page from the list.</p></div>');
      return;
    }
    var vendor = VENDORS.filter(function (v) { return v.key === state.vendor; })[0];
    renderReader(
      '<div class="dx-page-head">' +
        '<button class="dx-btn dx-back dx-mobile-only">&larr; All pages</button>' +
        "<h1>" + esc(p.title) + "</h1>" +
        '<div class="dx-src">' + esc(vendor.full) + " &middot; " +
        '<a href="' + esc(p.url) + '" target="_blank" rel="noopener noreferrer">view official page &#8599;</a></div>' +
      "</div>" +
      '<div class="dx-md">' + renderMarkdown(p.body, p.url) + "</div>"
    );
  }

  function renderVendor() {
    var list = state.root.querySelector(".dx-list");
    var reader = state.root.querySelector(".dx-reader-inner");
    var st = state.loaded[state.vendor];
    if (st === "ok") {
      var pages = state.pages[state.vendor] || [];
      if (pages.length && state.selected[state.vendor] == null) state.selected[state.vendor] = 0;
      renderTabs(); renderList(); renderPage();
      return;
    }
    if (st === "error") {
      list.innerHTML = "";
      reader.innerHTML =
        '<div class="dx-error"><h3>Couldn\u2019t load the ' + esc(vendorLabel(state.vendor)) + " docs</h3>" +
        "<p>The documentation data file couldn\u2019t be loaded. Check your connection and try again.</p>" +
        '<button class="dx-retry">Try again</button></div>';
      reader.querySelector(".dx-retry").addEventListener("click", function () {
        state.loaded[state.vendor] = null;
        renderVendor();
      });
      return;
    }
    // loading
    list.innerHTML = "";
    reader.innerHTML = '<div class="dx-loading"><div class="dx-spinner"></div><span>Loading ' + esc(vendorLabel(state.vendor)) + " docs&hellip;</span></div>";
    load(state.vendor, function (status) {
      if (state.root && state.root.classList.contains("open")) renderVendor();
    });
  }

  function vendorLabel(key) {
    for (var i = 0; i < VENDORS.length; i++) if (VENDORS[i].key === key) return VENDORS[i].label;
    return key;
  }

  /* ---------- open / close ---------- */

  function onEsc(e) {
    if (e.key === "Escape" && state.root && state.root.classList.contains("open")) {
      e.stopPropagation();
      close();
    }
  }

  function open(vendor) {
    if (vendor && VENDORS.some(function (v) { return v.key === vendor; })) state.vendor = vendor;
    ensureRoot();
    state.root.classList.add("open");
    document.addEventListener("keydown", onEsc, true);
    renderTabs();
    renderVendor();
    setTimeout(function () {
      var inp = state.root.querySelector(".dx-search input");
      if (inp && window.innerWidth > 760) inp.focus();
    }, 0);
  }

  function close() {
    if (!state.root) return;
    state.root.classList.remove("open", "showing-page");
    document.removeEventListener("keydown", onEsc, true);
  }

  window.DocsUI = { open: open, close: close };
})();
