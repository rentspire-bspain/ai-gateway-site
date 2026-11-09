(function () {
  'use strict';
  if (window.Artifacts && window.Artifacts._loaded) return;
  var NS = 'http://www.w3.org/2000/svg';
  var PALETTE = ['#3D9595', '#6BB8B8', '#D19A66', '#C678DD', '#E5484D', '#7FB77E', '#61AFEF', '#E5C07B'];
  var CODE_LANGS = { js: 1, javascript: 1, ts: 1, typescript: 1, html: 1, css: 1, python: 1, py: 1, sql: 1, json: 1 };
  var seq = 0;

  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function svg(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }

  function deriveTitle(lang, code) {
    var m = code.match(/(?:function\s*\*?\s+|class\s+|def\s+|const\s+|let\s+|var\s+)([A-Za-z_$][\w$]*)/);
    if (m) return m[1];
    m = code.match(/^\s*(?:#|\/\/|--)\s*(.+)$/m);
    if (m && m[1].length < 60) return m[1].trim();
    m = code.match(/<title>([^<]+)<\/title>/i);
    if (m) return m[1].trim();
    m = code.match(/create\s+table\s+(\w+)/i);
    if (m) return m[1];
    return lang ? lang.toUpperCase() + ' snippet' : 'Code';
  }

  function extractFromAnswer(text) {
    var out = [];
    text = String(text || '');
    var re = /(^|\n)[ \t]*(`{3,}|~{3,})[ \t]*([\w+#-]*)[^\n]*\n([\s\S]*?)\n[ \t]*\2[ \t]*(?=\n|$)/g, m;
    while ((m = re.exec(text))) {
      var lang = (m[3] || '').toLowerCase(), body = m[4], lines = body.split('\n').length, a = null;
      if (lang === 'chart') {
        try {
          var spec = JSON.parse(body);
          if (spec && /^(bar|line|pie)$/.test(spec.type) && spec.data) a = { kind: 'chart', lang: 'chart', title: spec.title || 'Chart', content: body };
        } catch (e) {}
      } else if (lang === 'svg' || (/<svg[\s>]/i.test(body) && (lang === 'html' || lang === 'xml' || !lang) && lines < 400 && /^\s*(<\?xml|<svg|<!doctype|<html)/i.test(body))) {
        a = { kind: 'html', lang: 'svg', title: deriveTitle('svg', body) === 'SVG snippet' ? 'SVG graphic' : deriveTitle('svg', body), content: body };
      } else if ((lang === 'html' || lang === 'htm') && /<!doctype html|<html[\s>]/i.test(body)) {
        a = { kind: /<script/i.test(body) ? 'webapp' : 'html', lang: 'html', title: deriveTitle('html', body), content: body };
      } else if (CODE_LANGS[lang] && lines >= 20) {
        a = { kind: 'code', lang: lang, title: deriveTitle(lang, body), content: body };
      }
      if (a) { a.id = 'art-' + hash(a.kind + a.content); out.push(a); }
    }
    return out;
  }

  /* ---------- highlighter ---------- */
  var KW = {
    js: 'break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new of return super switch this throw try typeof var void while with yield async await static get set true false null undefined interface type enum implements public private protected readonly as from',
    py: 'and as assert async await break class continue def del elif else except finally for from global if import in is lambda None nonlocal not or pass raise return try while with yield True False self print',
    sql: 'select from where insert into values update set delete create table alter drop index join left right inner outer full on group by order having limit offset as and or not null is in exists union all distinct case when then else end primary key foreign references default int integer text varchar boolean timestamp with returning',
    css: '', json: 'true false null', html: ''
  };
  function kwSet(l) { var s = {}; (KW[l] || '').split(' ').forEach(function (w) { if (w) s[w] = 1; }); return s; }
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function normLang(l) { l = (l || '').toLowerCase(); if (l === 'javascript' || l === 'ts' || l === 'typescript' || l === 'jsx') return 'js'; if (l === 'python') return 'py'; if (l === 'htm' || l === 'svg' || l === 'xml') return 'html'; return l; }

  function highlight(code, lang) {
    lang = normLang(lang);
    var kws = kwSet(lang), ci = lang === 'sql';
    var tok;
    if (lang === 'html') tok = /(<!--[\s\S]*?-->)|("[^"]*"|'[^']*')|(<\/?[A-Za-z][\w:-]*|\/?>)|([\s\S])/g;
    else if (lang === 'py') tok = /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|([\s\S])/g;
    else if (lang === 'sql') tok = /(--[^\n]*|\/\*[\s\S]*?\*\/)|('(?:''|[^'])*'|"[^"]*")|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|([\s\S])/g;
    else if (lang === 'css') tok = /(\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(#[0-9a-fA-F]{3,8}\b|-?\d*\.?\d+(?:px|em|rem|%|vh|vw|s|ms|deg)?\b)|([@A-Za-z_-][\w-]*(?=\s*:)|[@.][\w-]+)|([\s\S])/g;
    else tok = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|([\s\S])/g;
    var out = '', m;
    while ((m = tok.exec(code))) {
      if (m[1]) out += '<span class="tk-c">' + esc(m[1]) + '</span>';
      else if (m[2]) out += '<span class="tk-s">' + esc(m[2]) + '</span>';
      else if (lang === 'html') out += m[3] ? '<span class="tk-k">' + esc(m[3]) + '</span>' : esc(m[4]);
      else if (m[3]) out += '<span class="tk-n">' + esc(m[3]) + '</span>';
      else if (m[4]) {
        var w = m[4];
        if (lang === 'css') out += '<span class="tk-' + (w[0] === '@' ? 'k' : (w[0] === '.' ? 'f' : 'k')) + '">' + esc(w) + '</span>';
        else if (kws[ci ? w.toLowerCase() : w]) out += '<span class="tk-k">' + esc(w) + '</span>';
        else if (code.charAt(tok.lastIndex) === '(') out += '<span class="tk-f">' + esc(w) + '</span>';
        else out += esc(w);
      } else out += esc(m[5] || '');
    }
    return out;
  }

  /* ---------- charts ---------- */
  function normSeries(spec) {
    var d = spec.data, labels = [], series = [];
    if (Array.isArray(d)) {
      if (d.length && typeof d[0] === 'object' && d[0] !== null) {
        var lk = spec.labelKey || (d[0].label !== undefined ? 'label' : d[0].name !== undefined ? 'name' : Object.keys(d[0])[0]);
        var vk = spec.valueKey || (d[0].value !== undefined ? 'value' : Object.keys(d[0]).filter(function (k) { return k !== lk && typeof d[0][k] === 'number'; })[0]);
        labels = d.map(function (r) { return String(r[lk]); });
        series = [{ name: spec.title || vk || '', values: d.map(function (r) { return Number(r[vk]) || 0; }) }];
      } else { labels = d.map(function (_, i) { return String(i + 1); }); series = [{ name: '', values: d.map(Number) }]; }
    } else if (d && d.labels) {
      labels = d.labels.map(String);
      var ds = d.datasets || d.series || [{ values: d.values }];
      series = ds.map(function (s, i) { return { name: s.label || s.name || '', values: (s.data || s.values || []).map(Number) }; });
    } else if (d && typeof d === 'object') {
      labels = Object.keys(d); series = [{ name: '', values: labels.map(function (k) { return Number(d[k]) || 0; }) }];
    }
    return { labels: labels, series: series };
  }
  function nice(max) { if (max <= 0) return 1; var p = Math.pow(10, Math.floor(Math.log10(max))), f = max / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }
  function fmt(n) { return Math.abs(n) >= 1000 ? (Math.round(n / 100) / 10) + 'k' : String(Math.round(n * 100) / 100); }

  function renderChart(spec) {
    var s = normSeries(spec), W = 720, H = 420, L = 56, R = 20, T = 48, B = 64;
    var root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': spec.title || 'Chart' });
    root.appendChild(svg('text', { x: W / 2, y: 26, 'text-anchor': 'middle', 'class': 'ch-title' }, spec.title || ''));
    var n = s.labels.length;
    if (spec.type === 'pie') {
      var vals = s.series[0] ? s.series[0].values : [], tot = vals.reduce(function (a, b) { return a + Math.max(0, b); }, 0) || 1;
      var cx = 230, cy = 235, r = 140, ang = -Math.PI / 2;
      vals.forEach(function (v, i) {
        v = Math.max(0, v); var a2 = ang + v / tot * Math.PI * 2, large = a2 - ang > Math.PI ? 1 : 0, col = PALETTE[i % PALETTE.length], p;
        if (v / tot > 0.9999) p = svg('circle', { cx: cx, cy: cy, r: r, fill: col, 'class': 'ch-slice' });
        else p = svg('path', { d: 'M' + cx + ' ' + cy + 'L' + (cx + r * Math.cos(ang)) + ' ' + (cy + r * Math.sin(ang)) + 'A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + (cx + r * Math.cos(a2)) + ' ' + (cy + r * Math.sin(a2)) + 'Z', fill: col, stroke: 'var(--bg)', 'stroke-width': 2, 'class': 'ch-slice' });
        p.appendChild(svg('title', null, s.labels[i] + ': ' + v));
        root.appendChild(p);
        root.appendChild(svg('rect', { x: 430, y: 80 + i * 24, width: 12, height: 12, rx: 2, fill: col }));
        root.appendChild(svg('text', { x: 450, y: 91 + i * 24 }, s.labels[i] + ' (' + Math.round(v / tot * 100) + '%)'));
        ang = a2;
      });
      return root;
    }
    var max = 0; s.series.forEach(function (se) { se.values.forEach(function (v) { if (v > max) max = v; }); });
    var top = nice(max), pw = W - L - R, ph = H - T - B, ticks = 5, i, j;
    for (i = 0; i <= ticks; i++) {
      var y = T + ph - ph * i / ticks;
      root.appendChild(svg('line', { x1: L, x2: W - R, y1: y, y2: y, 'class': i ? 'ch-grid' : 'ch-axis' }));
      root.appendChild(svg('text', { x: L - 8, y: y + 4, 'text-anchor': 'end' }, fmt(top * i / ticks)));
    }
    root.appendChild(svg('line', { x1: L, x2: L, y1: T, y2: T + ph, 'class': 'ch-axis' }));
    var band = pw / Math.max(n, 1);
    s.labels.forEach(function (lb, k) {
      var t = svg('text', { x: L + band * (k + .5), y: T + ph + 20, 'text-anchor': 'middle' }, lb.length > 12 ? lb.slice(0, 11) + '…' : lb);
      t.appendChild(svg('title', null, lb)); root.appendChild(t);
    });
    var ns = s.series.length;
    if (spec.type === 'bar') {
      var bw = Math.min(60, band * 0.7 / ns);
      s.series.forEach(function (se, si) {
        se.values.forEach(function (v, k) {
          var h = ph * Math.max(v, 0) / top, x = L + band * (k + .5) - bw * ns / 2 + bw * si;
          var rc = svg('rect', { x: x, y: T + ph - h, width: bw, height: h, rx: 3, fill: PALETTE[si % PALETTE.length], 'class': 'ch-bar' });
          rc.appendChild(svg('title', null, s.labels[k] + ': ' + v)); root.appendChild(rc);
          if (ns === 1) root.appendChild(svg('text', { x: x + bw / 2, y: T + ph - h - 6, 'text-anchor': 'middle' }, fmt(v)));
        });
      });
    } else {
      s.series.forEach(function (se, si) {
        var col = PALETTE[si % PALETTE.length], pts = se.values.map(function (v, k) { return [L + band * (k + .5), T + ph - ph * v / top]; });
        root.appendChild(svg('polyline', { points: pts.map(function (p) { return p.join(','); }).join(' '), fill: 'none', stroke: col, 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'class': 'ch-line' }));
        pts.forEach(function (p, k) { var c = svg('circle', { cx: p[0], cy: p[1], r: 4, fill: col, 'class': 'ch-bar' }); c.appendChild(svg('title', null, s.labels[k] + ': ' + se.values[k])); root.appendChild(c); });
      });
    }
    if (ns > 1 || (s.series[0] && s.series[0].name && false)) s.series.forEach(function (se, si) {
      root.appendChild(svg('rect', { x: L + si * 120, y: H - 22, width: 12, height: 12, rx: 2, fill: PALETTE[si % PALETTE.length] }));
      root.appendChild(svg('text', { x: L + si * 120 + 18, y: H - 12 }, se.name || ('Series ' + (si + 1))));
    });
    return root;
  }

  /* ---------- viewer ---------- */
  var current = null, currentArt = null;
  function copyText(t) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t); } catch (e) {}
    try { var ta = el('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); } catch (e) {}
    return Promise.resolve();
  }
  function docFor(a) {
    var c = a.content;
    if (a.lang === 'svg' && !/<html/i.test(c)) return '<!doctype html><meta charset="utf-8"><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff">' + c;
    return c;
  }
  function open(a) {
    close();
    var prevFocus = document.activeElement;
    var ov = el('div', { 'class': 'artifact-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': a.title, tabindex: '-1' });
    var bar = el('div', { 'class': 'artifact-bar' });
    bar.appendChild(el('span', { 'class': 'ab-title' }, a.title));
    bar.appendChild(el('span', { 'class': 'ab-kind' }, a.kind));
    var body = el('div', { 'class': 'artifact-body' });
    if (a.kind === 'code') {
      var cp = el('button', { 'class': 'artifact-btn', type: 'button', 'data-action': 'copy' }, 'Copy');
      cp.onclick = function () { copyText(a.content).then(function () { cp.textContent = 'Copied'; setTimeout(function () { cp.textContent = 'Copy'; }, 1500); }); };
      bar.appendChild(cp);
      var pre = el('pre', { 'class': 'artifact-code' }), code = el('code');
      code.innerHTML = highlight(a.content, a.lang); pre.appendChild(code); body.appendChild(pre);
    } else if (a.kind === 'chart') {
      var wrap = el('div', { 'class': 'artifact-chart' });
      try { wrap.appendChild(renderChart(JSON.parse(a.content))); } catch (e) { wrap.textContent = 'Unable to render chart.'; }
      body.appendChild(wrap);
    } else {
      var nt = el('button', { 'class': 'artifact-btn', type: 'button', 'data-action': 'newtab' }, 'Open in new tab');
      nt.onclick = function () {
        var url = URL.createObjectURL(new Blob([docFor(a)], { type: 'text/html' }));
        window.open(url, '_blank', 'noopener,noreferrer'); setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      };
      bar.appendChild(nt);
      var fr = el('iframe', { 'class': 'artifact-frame', title: a.title, sandbox: 'allow-scripts allow-forms allow-modals allow-popups', referrerpolicy: 'no-referrer' });
      fr.srcdoc = docFor(a); body.appendChild(fr);
    }
    var x = el('button', { 'class': 'artifact-btn', type: 'button', 'aria-label': 'Close', 'data-action': 'close' }, 'Close');
    x.onclick = close; bar.appendChild(x);
    ov.appendChild(bar); ov.appendChild(body);
    ov.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
      if (e.key === 'Tab') {
        var f = ov.querySelectorAll('button,iframe'); if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    document.body.appendChild(ov);
    currentArt = a;
    current = { ov: ov, prev: prevFocus, overflow: document.body.style.overflow };
    document.body.style.overflow = 'hidden';
    (ov.querySelector('[data-action="copy"],[data-action="close"]') || ov).focus();
    return ov;
  }
  function close() {
    if (!current) return;
    var c = current; current = null; currentArt = null;
    c.ov.remove(); document.body.style.overflow = c.overflow;
    try { if (c.prev && c.prev.focus) c.prev.focus(); } catch (e) {}
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && current) close(); });

  /* ---------- inline cards ---------- */
  var ICONS = {
    code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 16V10M12 16V6M17 16v-4"/>',
    html: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>',
    webapp: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>'
  };
  function renderInline(container, a) {
    var row = container.querySelector(':scope > .artifact-row');
    if (!row) { row = el('div', { 'class': 'artifact-row', role: 'group', 'aria-label': 'Artifacts' }); container.appendChild(row); }
    var b = el('button', { 'class': 'artifact-card', type: 'button', 'data-artifact-id': a.id, 'aria-label': 'Open ' + a.title });
    b.innerHTML = '<span class="af-ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[a.kind] || ICONS.code) + '</svg></span><span class="af-txt"><span class="af-title"></span><span class="af-kind"></span></span><span class="af-open">Open</span>';
    b.querySelector('.af-title').textContent = a.title;
    b.querySelector('.af-kind').textContent = a.kind + (a.lang && a.lang !== a.kind ? ' · ' + a.lang : '');
    b.onclick = function () { open(a); };
    row.appendChild(b);
    return row;
  }

  function saveStore(arts) {
    try {
      var st = JSON.parse(localStorage.getItem('ai_artifacts') || '[]'), dead = JSON.parse(localStorage.getItem('ai_artifacts_deleted') || '[]'), ch = false;
      if (!Array.isArray(st)) st = [];
      arts.forEach(function (a) {
        if (dead.indexOf(a.id) >= 0 || st.some(function (x) { return x.id === a.id; })) return;
        st.push({ id: a.id, kind: a.kind, lang: a.lang, title: a.title, content: a.content, created: Date.now(), query: lastQuery(a) }); ch = true;
      });
      if (ch) localStorage.setItem('ai_artifacts', JSON.stringify(st.slice(-200)));
    } catch (e) {}
  }
  function lastQuery() { var q = document.querySelector('.question-header, .question-title, #queryText'); return q ? (q.textContent || '').trim().slice(0, 120) : ''; }
  function runHooks(ac, text) { (window.ArtifactsHooks || []).forEach(function (h) { try { h(ac, text); } catch (e) {} }); }

  function placeCards(answerContent, text) {
    var arts = extractFromAnswer(text);
    runHooks(answerContent, text);
    saveStore(arts);
    var host = answerContent.closest('.answer-section') || answerContent.parentNode;
    var key = arts.map(function (a) { return a.id; }).join(',');
    var old = host.querySelector(':scope > .artifact-row');
    if (old && old.getAttribute('data-key') === key) return 0;
    if (old) old.remove();
    if (!arts.length) return 0;
    var row = el('div', { 'class': 'artifact-row', role: 'group', 'aria-label': 'Artifacts', 'data-key': key });
    host.appendChild(row);
    var actions = host.querySelector(':scope > .answer-actions');
    if (actions) actions.after(row);
    arts.forEach(function (a) { renderInline(row, a); });
    return arts.length;
  }

  // Rebuild approximate markdown from rendered DOM (fallback when raw text unknown)
  function textFromDom(ac) {
    var parts = [];
    ac.querySelectorAll('pre').forEach(function (p) {
      var code = p.querySelector('code') || p, cls = (code.className || '') + ' ' + (p.className || ''), m = cls.match(/(?:language|lang)-([\w+#-]+)/);
      var lang = m ? m[1] : (p.getAttribute('data-lang') || '');
      parts.push('```' + lang + '\n' + code.textContent.replace(/\n$/, '') + '\n```');
    });
    return parts.join('\n\n');
  }

  var rawByEl = new WeakMap();
  function scan(root) {
    var n = 0;
    (root || document).querySelectorAll('.answer-content').forEach(function (ac) {
      if (ac.closest('.artifact-overlay')) return;
      var t = rawByEl.get(ac); if (t == null) t = textFromDom(ac);
      if (t) n += placeCards(ac, t);
    });
    return n;
  }

  function tryPatch() {
    try {
      var orig = window.renderAnswer;
      if (typeof orig === 'function' && !orig._artifactsPatched) {
        var patched = function (container, text) {
          var r = orig.apply(this, arguments);
          try {
            var ac = container && container.querySelector && container.querySelector('.answer-content');
            if (ac) { rawByEl.set(ac, String(text || '')); placeCards(ac, String(text || '')); }
          } catch (e) {}
          return r;
        };
        patched._artifactsPatched = true;
        window.renderAnswer = patched;
        try { renderAnswer = patched; } catch (e) {}
      }
    } catch (e) {}
  }
  var attached = false, timer = null, mo = null;
  function attach() {
    if (attached) return true;
    attached = true;
    tryPatch();
    window.addEventListener('load', tryPatch);
    // 2) MutationObserver fallback, debounced
    var target = document.getElementById('resultsContent');
    if (target && window.MutationObserver) {
      mo = new MutationObserver(function () {
        clearTimeout(timer); tryPatch(); timer = setTimeout(function () { mo.disconnect(); try { scan(target); } finally { mo.observe(target, { childList: true, subtree: true }); } }, 150);
      });
      mo.observe(target, { childList: true, subtree: true });
    }
    return true;
  }

  window.Artifacts = {
    _loaded: true, extractFromAnswer: extractFromAnswer, renderInline: renderInline, attach: attach, scan: scan,
    highlight: highlight, renderChart: renderChart
  };
  window.ArtifactsUI = { open: open, close: close, current: function () { return currentArt; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach); else attach();
})();
