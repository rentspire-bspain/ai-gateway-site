/* Right-side document panel (Perplexity-style artifact viewer) for md / csv / xlsx / docx / pdf.
   API: ArtifactPanel.open(item), .close(), .card(item), .addAssets(assets), .isDocShaped(text), .parseXlsx(bytes)
   item: { title, name, kind:'md'|'csv'|'xlsx'|'docx'|'pdf'|'txt', text?, bytes?(Uint8Array), size? }
   Rendering is DOM-only (textContent); no innerHTML with content, no external hosts. */
(function () {
  'use strict';
  if (window.ArtifactPanel && window.ArtifactPanel._loaded) return;
  var KEY = 'docPanelWidth', panel, bodyEl, titleEl, kindEl, tabsEl, dlBtn, dlMenu, cur = null, urls = [];
  function el(t, c, txt) { var e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; }
  function slug(s) { return String(s || 'document').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'document'; }
  function fmtSize(n) { return !n ? '' : n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB'; }
  var MIME = { md: 'text/markdown', csv: 'text/csv', txt: 'text/plain', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', pdf: 'application/pdf' };
  var KIND_LABEL = { md: 'Markdown', csv: 'CSV', txt: 'Text', xlsx: 'Spreadsheet', docx: 'Word document', pdf: 'PDF' };
  var ICO = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></svg>';

  /* ---------- safe markdown ---------- */
  function inline(parent, s) {
    var re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(!?\[[^\]]*\]\([^)\s]+\))|(\[\d+\])/g, last = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > last) parent.appendChild(document.createTextNode(s.slice(last, m.index)));
      var t = m[0];
      if (m[1]) parent.appendChild(el('code', '', t.slice(1, -1)));
      else if (m[2] || m[3]) { var b = el('strong'); inline(b, t.slice(2, -2)); parent.appendChild(b); }
      else if (m[4]) { var i = el('em'); inline(i, t.slice(1, -1)); parent.appendChild(i); }
      else if (m[5]) {
        var mm = t.match(/^(!?)\[([^\]]*)\]\(([^)\s]+)\)$/), url = mm[3];
        if (mm[1] || !/^(https?:|mailto:|\/|#)/i.test(url)) parent.appendChild(document.createTextNode(mm[2] || ''));
        else { var a = el('a', '', mm[2] || url); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; parent.appendChild(a); }
      } else parent.appendChild(document.createTextNode(t));
      last = m.index + t.length;
    }
    if (last < s.length) parent.appendChild(document.createTextNode(s.slice(last)));
  }
  var SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
  function cells(l) { return l.trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); }); }
  function renderMd(text) {
    var root = el('div', 'dp-md'), lines = String(text || '').replace(/\r/g, '').split('\n'), i = 0, m;
    while (i < lines.length) {
      var ln = lines[i];
      if ((m = ln.match(/^\s*(`{3,}|~{3,})/))) {
        var code = []; i++;
        while (i < lines.length && !new RegExp('^\\s*' + m[1][0] + '{' + m[1].length + ',}\\s*$').test(lines[i])) code.push(lines[i++]);
        i++; var pre = el('pre'); pre.appendChild(el('code', '', code.join('\n'))); root.appendChild(pre); continue;
      }
      if (/^\s*\|.*\|\s*$/.test(ln) && i + 1 < lines.length && SEP.test(lines[i + 1])) {
        var wrap = el('div', 'dp-tw'), tb = el('table'), th = el('thead'), tr = el('tr');
        cells(ln).forEach(function (c) { var h = el('th'); inline(h, c); tr.appendChild(h); }); th.appendChild(tr); tb.appendChild(th);
        var tbody = el('tbody'); i += 2;
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { var r = el('tr'); cells(lines[i]).forEach(function (c) { var d = el('td'); inline(d, c); r.appendChild(d); }); tbody.appendChild(r); i++; }
        tb.appendChild(tbody); wrap.appendChild(tb); root.appendChild(wrap); continue;
      }
      if ((m = ln.match(/^(#{1,6})\s+(.*)$/))) { var h = el('h' + m[1].length); inline(h, m[2].replace(/\s+#+\s*$/, '')); root.appendChild(h); i++; continue; }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(ln)) { root.appendChild(el('hr')); i++; continue; }
      if (/^\s*>/.test(ln)) { var q = []; while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, '')); var bq = el('blockquote'); inline(bq, q.join(' ')); root.appendChild(bq); continue; }
      if ((m = ln.match(/^(\s*)([-*+]|\d+[.)])\s+/))) {
        var ord = /\d/.test(m[2]), list = el(ord ? 'ol' : 'ul');
        while (i < lines.length && (m = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/))) { var li = el('li'); if (m[1].length >= 2) li.style.marginLeft = Math.min(m[1].length, 8) * 8 + 'px'; inline(li, m[3]); list.appendChild(li); i++; }
        root.appendChild(list); continue;
      }
      if (!ln.trim()) { i++; continue; }
      var para = [ln.trim()]; i++;
      while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*(`{3,}|~{3,})|\s*([-*+]|\d+[.)])\s|\s*\||\s*>)/.test(lines[i])) para.push(lines[i++].trim());
      var p = el('p'); inline(p, para.join(' ')); root.appendChild(p);
    }
    return root;
  }

  /* ---------- csv / xlsx ---------- */
  function parseCsv(t) {
    var rows = [], row = [], f = '', q = false, i, c; t = String(t || '').replace(/^\uFEFF/, '');
    for (i = 0; i < t.length; i++) {
      c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
      else f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows;
  }
  function grid(rows) {
    var MAXR = 500, wrap = el('div'), tb = el('table', 'dp-grid'), mc = 0;
    rows.forEach(function (r) { if (r.length > mc) mc = r.length; });
    var hd = el('tr'); hd.appendChild(el('th', 'rn', ''));
    for (var c = 0; c < mc; c++) hd.appendChild(el('th', 'rn', colLetter(c)));
    var thead = el('thead'); thead.appendChild(hd); tb.appendChild(thead);
    var tbody = el('tbody');
    rows.slice(0, MAXR).forEach(function (r, ri) {
      var tr = el('tr'); tr.appendChild(el('td', 'rn', String(ri + 1)));
      for (var c = 0; c < mc; c++) { var v = r[c] == null ? '' : String(r[c]), td = el('td', /^-?[\d,]*\.?\d+%?$/.test(v.trim()) && v.trim() ? 'num' : '', v); if (ri === 0) td.style.fontWeight = '600'; tr.appendChild(td); }
      tbody.appendChild(tr);
    });
    tb.appendChild(tbody); wrap.appendChild(tb);
    if (rows.length > MAXR) wrap.appendChild(el('div', 'dp-note', 'Showing first ' + MAXR + ' of ' + rows.length + ' rows. Download for the full file.'));
    return wrap;
  }
  function colLetter(i) { var s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; }
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
  function unzip(b) { // -> Promise<{name: Uint8Array}> for the entries we need
    var e = b.length - 22; while (e >= 0 && u32(b, e) !== 0x06054b50) e--;
    if (e < 0) return Promise.reject(new Error('Not a zip'));
    var n = u16(b, e + 10), off = u32(b, e + 16), dec = new TextDecoder(), jobs = [], out = {};
    for (var k = 0; k < n; k++) {
      var meth = u16(b, off + 10), csz = u32(b, off + 20), nl = u16(b, off + 28), xl = u16(b, off + 30), cl = u16(b, off + 32), lo = u32(b, off + 42);
      var name = dec.decode(b.subarray(off + 46, off + 46 + nl)); off += 46 + nl + xl + cl;
      if (!/^xl\/(workbook\.xml|sharedStrings\.xml|_rels\/workbook\.xml\.rels|worksheets\/[^/]+\.xml)$/.test(name)) continue;
      var ds = lo + 30 + u16(b, lo + 26) + u16(b, lo + 28), raw = b.subarray(ds, ds + csz);
      (function (name, meth, raw) {
        if (meth === 0) out[name] = raw;
        else if (meth === 8 && window.DecompressionStream) jobs.push(new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer().then(function (ab) { out[name] = new Uint8Array(ab); }));
      })(name, meth, raw);
    }
    return Promise.all(jobs).then(function () { return out; });
  }
  function parseXlsx(bytes) { // -> Promise<[{name, rows}]>
    return unzip(bytes).then(function (f) {
      var dec = new TextDecoder(), dp = new DOMParser();
      function xml(n) { return f[n] ? dp.parseFromString(dec.decode(f[n]), 'application/xml') : null; }
      function txt(node) { var s = ''; node.querySelectorAll('t').forEach(function (t) { s += t.textContent; }); return s; }
      var ss = [], sdoc = xml('xl/sharedStrings.xml');
      if (sdoc) sdoc.querySelectorAll('si').forEach(function (si) { ss.push(txt(si)); });
      var wb = xml('xl/workbook.xml'), rel = xml('xl/_rels/workbook.xml.rels'), map = {}, sheets = [];
      if (rel) rel.querySelectorAll('Relationship').forEach(function (r) { map[r.getAttribute('Id')] = r.getAttribute('Target').replace(/^\/?(xl\/)?/, ''); });
      if (wb) wb.querySelectorAll('sheet').forEach(function (s) {
        var rid = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
        var doc = xml('xl/' + map[rid]); if (!doc) return;
        var rows = [];
        doc.querySelectorAll('row').forEach(function (r) {
          var rn = parseInt(r.getAttribute('r'), 10) - 1 || rows.length, arr = [];
          r.querySelectorAll('c').forEach(function (c) {
            var ref = (c.getAttribute('r') || '').replace(/\d+/g, ''), ci = 0; for (var i = 0; i < ref.length; i++) ci = ci * 26 + ref.charCodeAt(i) - 64; ci = ci ? ci - 1 : arr.length;
            var t = c.getAttribute('t'), v = c.querySelector('v'), val = '';
            if (t === 'inlineStr') val = txt(c); else if (v) val = t === 's' ? (ss[+v.textContent] || '') : v.textContent;
            arr[ci] = val;
          });
          rows[rn] = arr;
        });
        for (var i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
        sheets.push({ name: s.getAttribute('name') || 'Sheet', rows: rows });
      });
      return sheets;
    });
  }

  /* ---------- downloads ---------- */
  function saveBlob(blob, name) {
    var u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 30000);
  }
  function baseName(it) { return (it.name || '').replace(/\.[a-z0-9]+$/i, '') || slug(it.title); }
  function originalBlob(it) { return it.bytes ? new Blob([it.bytes], { type: MIME[it.kind] || 'application/octet-stream' }) : new Blob([it.text || ''], { type: (MIME[it.kind] || 'text/plain') + ';charset=utf-8' }); }
  function downloadOptions(it) {
    var opts = [{ label: 'Original (.' + it.kind + ')', run: function () { saveBlob(originalBlob(it), baseName(it) + '.' + it.kind); } }];
    if ((it.kind === 'md' || it.kind === 'txt') && window.ArtifactsFiles) {
      ['docx', 'pdf', 'xlsx'].forEach(function (f) { opts.push({ label: { docx: 'Word (.docx)', pdf: 'PDF (.pdf)', xlsx: 'Excel (.xlsx)' }[f], run: function () { saveBlob(window.ArtifactsFiles.generate(f, { text: it.text, title: it.title }), baseName(it) + '.' + f); } }); });
    }
    return opts;
  }

  /* ---------- panel ---------- */
  function width() { var w = parseInt(localStorage.getItem(KEY), 10); return Math.max(360, Math.min(w || Math.round(window.innerWidth * 0.45), Math.round(window.innerWidth * 0.75))); }
  function setW(w) { document.documentElement.style.setProperty('--dp-w', w + 'px'); }
  function build() {
    if (panel) return;
    panel = el('aside', 'dp-panel'); panel.hidden = true; panel.setAttribute('role', 'complementary'); panel.setAttribute('aria-label', 'Document panel');
    var rz = el('div', 'dp-resize'); rz.setAttribute('role', 'separator'); rz.setAttribute('aria-orientation', 'vertical');
    rz.onpointerdown = function (e) {
      e.preventDefault(); rz.classList.add('dragging'); rz.setPointerCapture(e.pointerId);
      rz.onpointermove = function (ev) { var w = Math.max(360, Math.min(window.innerWidth - ev.clientX, Math.round(window.innerWidth * 0.75))); setW(w); localStorage.setItem(KEY, String(w)); };
      rz.onpointerup = function () { rz.classList.remove('dragging'); rz.onpointermove = null; };
    };
    var bar = el('div', 'dp-bar'); titleEl = el('span', 'dp-title'); kindEl = el('span', 'dp-kind');
    var dl = el('div', 'dp-dl'); dlBtn = el('button', 'dp-btn', 'Download \u25BE'); dlBtn.type = 'button'; dlBtn.setAttribute('aria-haspopup', 'menu');
    dlMenu = el('div', 'dp-menu'); dlMenu.hidden = true; dlMenu.setAttribute('role', 'menu');
    dlBtn.onclick = function (e) { e.stopPropagation(); dlMenu.hidden = !dlMenu.hidden; };
    document.addEventListener('click', function () { dlMenu.hidden = true; });
    dl.appendChild(dlBtn); dl.appendChild(dlMenu);
    var cl = el('button', 'dp-btn', 'Close'); cl.type = 'button'; cl.setAttribute('aria-label', 'Close document panel'); cl.onclick = close;
    bar.appendChild(titleEl); bar.appendChild(kindEl); bar.appendChild(dl); bar.appendChild(cl);
    tabsEl = el('div', 'dp-tabs'); tabsEl.hidden = true; tabsEl.setAttribute('role', 'tablist');
    bodyEl = el('div', 'dp-body');
    panel.appendChild(rz); panel.appendChild(bar); panel.appendChild(tabsEl); panel.appendChild(bodyEl);
    document.body.appendChild(panel);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && cur && panel.contains(document.activeElement)) close(); });
  }
  function fileCard(it) {
    var d = el('div', 'dp-file'); d.insertAdjacentHTML('beforeend', ICO.replace('width="18" height="18"', 'width="56" height="56"'));
    d.appendChild(el('div', 'dp-fname', it.name || (slug(it.title) + '.' + it.kind)));
    d.appendChild(el('div', 'dp-fmeta', KIND_LABEL[it.kind] + (it.size ? ' \u00B7 ' + fmtSize(it.size) : '')));
    var b = el('button', 'dp-btn', 'Download'); b.type = 'button'; b.onclick = function () { saveBlob(originalBlob(it), it.name || baseName(it) + '.' + it.kind); }; d.appendChild(b);
    if (it.kind === 'docx') d.appendChild(el('div', 'dp-fmeta', 'Word documents open in your editor after download.'));
    return d;
  }
  function open(it) {
    build(); it = Object.assign({ kind: 'md' }, it);
    if (!it.title) it.title = (it.name || 'Document').replace(/\.[a-z0-9]+$/i, '');
    if (it.bytes && !it.size) it.size = it.bytes.length;
    cur = it; titleEl.textContent = it.title; titleEl.title = it.title; kindEl.textContent = KIND_LABEL[it.kind] || it.kind;
    tabsEl.hidden = true; tabsEl.textContent = ''; bodyEl.textContent = ''; bodyEl.scrollTop = 0;
    dlMenu.textContent = ''; downloadOptions(it).forEach(function (o) { var b = el('button', '', o.label); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.onclick = function () { dlMenu.hidden = true; try { o.run(); } catch (e) { console.error(e); } }; dlMenu.appendChild(b); });
    if (it.kind === 'md' || it.kind === 'txt') bodyEl.appendChild(it.kind === 'md' ? renderMd(it.text) : (function () { var p = el('pre', 'dp-md'); p.textContent = it.text; return p; })());
    else if (it.kind === 'csv') bodyEl.appendChild(grid(parseCsv(it.text)));
    else if (it.kind === 'xlsx') {
      bodyEl.appendChild(el('div', 'dp-note', 'Reading spreadsheet\u2026'));
      parseXlsx(it.bytes).then(function (sheets) {
        if (cur !== it) return; bodyEl.textContent = '';
        if (!sheets.length) { bodyEl.appendChild(fileCard(it)); return; }
        var show = function (k) { bodyEl.textContent = ''; bodyEl.appendChild(grid(sheets[k].rows)); [].forEach.call(tabsEl.children, function (t, j) { t.setAttribute('aria-selected', String(j === k)); }); };
        if (sheets.length > 1) { tabsEl.hidden = false; sheets.forEach(function (s, k) { var t = el('button', '', s.name); t.type = 'button'; t.setAttribute('role', 'tab'); t.onclick = function () { show(k); }; tabsEl.appendChild(t); }); }
        show(0);
      }).catch(function () { if (cur === it) { bodyEl.textContent = ''; bodyEl.appendChild(fileCard(it)); } });
    } else if (it.kind === 'pdf' && it.bytes) {
      var u = URL.createObjectURL(new Blob([it.bytes], { type: 'application/pdf' })); urls.push(u);
      var fr = el('iframe', 'dp-pdf'); fr.title = it.title; fr.src = u; bodyEl.appendChild(fr);
    } else bodyEl.appendChild(fileCard(it));
    panel.hidden = false; setW(width()); document.body.classList.add('dp-open'); markCards();
    return panel;
  }
  function close() {
    if (!panel || panel.hidden) return; panel.hidden = true; cur = null; document.body.classList.remove('dp-open'); setW(0);
    urls.splice(0).forEach(function (u) { URL.revokeObjectURL(u); }); markCards();
  }
  function markCards() { [].forEach.call(document.querySelectorAll('.dp-card'), function (c) { c.setAttribute('aria-pressed', String(!!cur && c._dpItem === cur)); }); }

  /* ---------- cards + detection ---------- */
  function card(it) {
    var b = el('button', 'dp-card'); b.type = 'button'; b._dpItem = it; b.setAttribute('aria-label', 'Open ' + (it.title || it.name));
    var ic = el('span', 'dc-ico'); ic.insertAdjacentHTML('beforeend', ICO); var tx = el('span'); tx.appendChild(el('span', 'dc-t', it.title || it.name)); tx.appendChild(el('span', 'dc-k', (KIND_LABEL[it.kind] || it.kind) + (it.size ? ' \u00B7 ' + fmtSize(it.size) : '')));
    b.appendChild(ic); b.appendChild(tx); b.onclick = function () { open(b._dpItem); }; return b;
  }
  // Conservative: long, structured, report-shaped markdown only.
  function isDocShaped(t) {
    t = String(t || ''); if (t.length < 2200) return false;
    var heads = (t.match(/^#{1,3}\s+\S/gm) || []).length;
    return heads >= 4 || (heads >= 3 && /^#\s+\S/m.test(t) && t.length > 3500);
  }
  function titleOf(t) { var m = String(t).match(/^#{1,2}\s+(.+)$/m); return m ? m[1].replace(/[*_`#]/g, '').trim().slice(0, 90) : 'Report'; }
  var FILE_ASK = /\b(report|document|docx?|word|memo|brief|white ?paper|write[- ]?up|spreadsheet|xlsx|excel|csv|pdf|file)\b/i;
  var seen = new WeakMap(), autoTimer = null;
  function host(ac) { return ac.closest('.answer-section') || ac.parentNode; }
  function place(ac, text, query) {
    if (!isDocShaped(text)) return;
    var h = host(ac), old = h.querySelector(':scope > .dp-row'), id = titleOf(text) + ':' + text.length;
    var it = { kind: 'md', title: titleOf(text), text: text, name: slug(titleOf(text)) + '.md', size: new Blob([text]).size };
    if (old && old.getAttribute('data-id') === id) return;
    if (old) old.remove();
    var row = el('div', 'dp-row'); row.setAttribute('data-id', id); row.appendChild(card(it));
    var actions = h.querySelector(':scope > .answer-actions'); if (actions) actions.after(row); else h.appendChild(row);
    if (query && FILE_ASK.test(query) && !seen.get(ac)) { clearTimeout(autoTimer); autoTimer = setTimeout(function () { if (document.contains(row) && !seen.get(ac)) { seen.set(ac, 1); open(it); } }, 1500); }
  }
  var KIND_BY_EXT = { md: 'md', markdown: 'md', txt: 'txt', csv: 'csv', xlsx: 'xlsx', docx: 'docx', pdf: 'pdf' };
  function b64ToBytes(b) { var s = atob(b), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  function assetToItem(a) {
    var name = a.name || '', ext = (name.split('.').pop() || '').toLowerCase(), kind = KIND_BY_EXT[ext];
    if (!kind || !a.base64) return null;
    var bytes = b64ToBytes(a.base64), it = { kind: kind, name: name, title: name.replace(/\.[^.]+$/, ''), size: a.bytes || bytes.length };
    if (kind === 'md' || kind === 'txt' || kind === 'csv') it.text = new TextDecoder().decode(bytes); else it.bytes = bytes;
    return it;
  }
  function addAssets(assets, hostEl) {
    var items = (assets || []).map(function (a) { try { return assetToItem(a); } catch (e) { return null; } }).filter(Boolean);
    if (!items.length) return [];
    hostEl = hostEl || (function () { var s = document.querySelectorAll('#resultsContent .answer-section'); return s[s.length - 1]; })();
    if (hostEl) { var row = el('div', 'dp-row'); items.forEach(function (it) { row.appendChild(card(it)); }); hostEl.appendChild(row); }
    open(items[0]); return items;
  }

  /* patch renderAnswer (chained after artifacts.js) + sniff JSON chat responses for file assets */
  var lastQuery = '';
  function patch() {
    var orig = window.renderAnswer;
    if (typeof orig !== 'function' || orig._dpPatched) return;
    var p = function (container, text) {
      var r = orig.apply(this, arguments);
      try { var ac = container && container.querySelector && container.querySelector('.answer-content'); if (ac) place(ac, String(text || ''), lastQuery || (document.querySelector('.question-header, .question-title, #queryText') || {}).textContent || ''); } catch (e) {}
      return r;
    };
    p._dpPatched = true; window.renderAnswer = p; try { renderAnswer = p; } catch (e) {}
  }
  if (window.fetch && !window.fetch._dp) {
    var of = window.fetch;
    window.fetch = function (input, init) {
      try { if (init && typeof init.body === 'string' && /gateway-chat/.test(String(input && input.url || input))) { var b = JSON.parse(init.body), ms = b.messages || []; for (var i = ms.length - 1; i >= 0; i--) if (ms[i].role === 'user') { lastQuery = typeof ms[i].content === 'string' ? ms[i].content : ''; break; } } } catch (e) {}
      var pr = of.apply(this, arguments);
      pr.then(function (res) {
        try { if (/json/.test(res.headers.get('content-type') || '') && /gateway-chat/.test(res.url || '')) res.clone().json().then(function (j) { var as = j && (j.x_assets || j.x_files); if (as && as.length) setTimeout(function () { addAssets(as); }, 600); }).catch(function () {}); } catch (e) {}
      }).catch(function () {});
      return pr;
    };
    window.fetch._dp = true;
  }
  patch(); window.addEventListener('load', patch);
  window.ArtifactPanel = { _loaded: true, open: open, close: close, card: card, addAssets: addAssets, isDocShaped: isDocShaped, parseXlsx: parseXlsx, renderMd: renderMd, isOpen: function () { return !!cur; } };
})();
