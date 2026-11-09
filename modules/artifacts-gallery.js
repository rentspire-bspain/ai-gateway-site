/* Artifacts gallery (F11): grid of all saved artifacts across threads. Depends on artifacts.js. */
(function () {
  'use strict';
  if (window.ArtifactsGallery && window.ArtifactsGallery._loaded) return;
  var KINDS = ['all', 'code', 'chart', 'html', 'webapp'];
  var overlay = null, prevFocus = null;

  function lsJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function el(tag, attrs, text) { var e = document.createElement(tag); if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; }

  // Collect every artifact: scan all thread messages + persisted store, de-dup by id, drop tombstoned.
  function collect() {
    var dead = lsJSON('ai_artifacts_deleted', []), map = {}, list = [];
    var threads = lsJSON('ai_threads', []);
    if (Array.isArray(threads)) threads.forEach(function (t) {
      (t.messages || []).forEach(function (m, mi) {
        if (m.role !== 'assistant' || !m.content) return;
        window.Artifacts.extractFromAnswer(String(m.content)).forEach(function (a) {
          if (map[a.id]) return;
          a.threadId = t.id; a.threadTitle = t.title || 'Untitled thread'; a.created = m.ts || m.created || 0; a.query = ((t.messages[mi - 1] || {}).content || t.title || '').slice(0, 120);
          map[a.id] = a; list.push(a);
        });
      });
    });
    var st = lsJSON('ai_artifacts', []);
    if (Array.isArray(st)) st.forEach(function (a) { if (!map[a.id]) { a.threadTitle = a.query || 'Saved'; map[a.id] = a; list.push(a); } else if (!map[a.id].created) map[a.id].created = a.created || 0; });
    return list.filter(function (a) { return dead.indexOf(a.id) < 0; }).sort(function (a, b) { return (b.created || 0) - (a.created || 0); });
  }
  function remove(id) {
    var dead = lsJSON('ai_artifacts_deleted', []); if (dead.indexOf(id) < 0) dead.push(id);
    localStorage.setItem('ai_artifacts_deleted', JSON.stringify(dead));
    var st = lsJSON('ai_artifacts', []); if (Array.isArray(st)) localStorage.setItem('ai_artifacts', JSON.stringify(st.filter(function (a) { return a.id !== id; })));
  }
  function matches(a, q, kind) {
    if (kind !== 'all' && a.kind !== kind) return false;
    if (!q) return true; q = q.toLowerCase();
    return (a.title + ' ' + a.lang + ' ' + a.kind + ' ' + (a.threadTitle || '') + ' ' + a.content).toLowerCase().indexOf(q) >= 0;
  }

  function open() {
    close(); prevFocus = document.activeElement;
    var state = { q: '', kind: 'all' };
    var ov = overlay = el('div', { 'class': 'artg-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Artifacts gallery', tabindex: '-1' });
    var head = el('div', { 'class': 'artg-head' });
    head.appendChild(el('h2', { 'class': 'artg-h' }, 'Artifacts'));
    var search = el('input', { 'class': 'artg-search', type: 'search', placeholder: 'Search artifacts', 'aria-label': 'Search artifacts' });
    var closeB = el('button', { 'class': 'artifact-btn', type: 'button', 'data-action': 'close' }, 'Close');
    closeB.onclick = close;
    head.appendChild(search); head.appendChild(closeB); ov.appendChild(head);
    var chips = el('div', { 'class': 'artg-chips', role: 'tablist' });
    KINDS.forEach(function (k) {
      var c = el('button', { 'class': 'artg-chip' + (k === 'all' ? ' active' : ''), type: 'button', 'data-kind': k, role: 'tab', 'aria-selected': String(k === 'all') }, k === 'all' ? 'All' : k.charAt(0).toUpperCase() + k.slice(1));
      c.onclick = function () { state.kind = k; chips.querySelectorAll('.artg-chip').forEach(function (x) { var on = x === c; x.classList.toggle('active', on); x.setAttribute('aria-selected', String(on)); }); render(); };
      chips.appendChild(c);
    });
    ov.appendChild(chips);
    var grid = el('div', { 'class': 'artg-grid' }), count = el('div', { 'class': 'artg-count', 'aria-live': 'polite' });
    ov.appendChild(count); ov.appendChild(grid);
    var all = collect();
    function render() {
      grid.textContent = '';
      var items = all.filter(function (a) { return matches(a, state.q, state.kind); });
      count.textContent = items.length + (items.length === 1 ? ' artifact' : ' artifacts');
      if (!items.length) { grid.appendChild(el('div', { 'class': 'artg-empty' }, all.length ? 'No artifacts match your search.' : 'No artifacts yet. Code, charts and HTML from answers will appear here.')); return; }
      items.forEach(function (a) {
        var card = el('div', { 'class': 'artg-card', 'data-artifact-id': a.id });
        var top = el('div', { 'class': 'artg-top' });
        top.appendChild(el('span', { 'class': 'artg-kind' }, a.kind + (a.lang && a.lang !== a.kind ? ' \u00B7 ' + a.lang : '')));
        var del = el('button', { 'class': 'artg-del', type: 'button', 'aria-label': 'Delete ' + a.title, 'data-action': 'delete', title: 'Delete' }, '\u00D7');
        del.onclick = function (e) { e.stopPropagation(); remove(a.id); all = all.filter(function (x) { return x.id !== a.id; }); render(); };
        top.appendChild(del); card.appendChild(top);
        card.appendChild(el('div', { 'class': 'artg-title' }, a.title));
        card.appendChild(el('pre', { 'class': 'artg-prev' }, a.content.split('\n').slice(0, 6).join('\n').slice(0, 300)));
        card.appendChild(el('div', { 'class': 'artg-meta' }, (a.threadTitle || '') + (a.created ? ' \u00B7 ' + new Date(a.created).toLocaleDateString() : '')));
        var ob = el('button', { 'class': 'artifact-btn artg-open', type: 'button', 'data-action': 'open' }, 'Open');
        ob.onclick = function () { window.ArtifactsUI.open(a); };
        card.appendChild(ob); grid.appendChild(card);
      });
    }
    var tm; search.addEventListener('input', function () { clearTimeout(tm); tm = setTimeout(function () { state.q = search.value.trim(); render(); }, 80); });
    ov.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !document.querySelector('.artifact-overlay')) { e.stopPropagation(); close(); } });
    document.body.appendChild(ov); render(); search.focus();
    return ov;
  }
  function close() { if (!overlay) return; overlay.remove(); overlay = null; try { if (prevFocus && prevFocus.focus) prevFocus.focus(); } catch (e) {} }
  function button(cls) { var b = el('button', { type: 'button', 'class': cls || 'artifact-btn' }, 'Artifacts'); b.onclick = open; return b; }

  window.ArtifactsGallery = { _loaded: true, open: open, close: close, collect: collect, remove: remove, button: button };
})();
