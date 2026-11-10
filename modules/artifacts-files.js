/* Artifacts file creation (F14): real .docx/.xlsx/.pptx/.pdf generated client-side.
   Zero dependencies, no network: includes a minimal ZIP (STORE) writer + OOXML/PDF emitters. */
(function () {
  'use strict';
  if (window.ArtifactsFiles && window.ArtifactsFiles._loaded) return;
  var enc = new TextEncoder();

  /* ---------- zip (store) ---------- */
  var CRC = (function () { var t = [], c, n, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) { // files: [[name, string]]
    var chunks = [], central = [], off = 0;
    function u16(v) { return [v & 255, (v >>> 8) & 255]; }
    function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
    files.forEach(function (f) {
      var name = enc.encode(f[0]), data = enc.encode(f[1]), crc = crc32(data);
      var h = [0x50, 0x4b, 3, 4].concat(u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
      chunks.push(new Uint8Array(h), name, data);
      central.push(new Uint8Array([0x50, 0x4b, 1, 2].concat(u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off))), name);
      off += h.length + name.length + data.length;
    });
    var csize = 0; central.forEach(function (c) { csize += c.length; });
    var end = new Uint8Array([0x50, 0x4b, 5, 6, 0, 0, 0, 0].concat(u16(files.length), u16(files.length), u32(csize), u32(off), u16(0)));
    return new Blob(chunks.concat(central, [end]));
  }

  /* ---------- markdown model ---------- */
  function stripInline(s) {
    return String(s).replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2').replace(/`([^`]+)`/g, '$1').replace(/\[(\d+)\]/g, '[$1]');
  }
  function parseMd(text) {
    var lines = String(text || '').replace(/\r/g, '').split('\n'), out = [], i = 0, m;
    while (i < lines.length) {
      var ln = lines[i];
      if ((m = ln.match(/^\s*(`{3,}|~{3,})\s*([\w+#-]*)/))) {
        var body = []; i++;
        while (i < lines.length && !new RegExp('^\\s*' + m[1][0] + '{' + m[1].length + ',}\\s*$').test(lines[i])) body.push(lines[i++]);
        i++; out.push({ t: 'code', lang: m[2], lines: body }); continue;
      }
      if (/^\s*\|.*\|\s*$/.test(ln) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
        var rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
          if (!/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i])) rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return stripInline(c.trim()); }));
          i++;
        }
        out.push({ t: 'table', rows: rows }); continue;
      }
      if ((m = ln.match(/^(#{1,6})\s+(.*)$/))) { out.push({ t: 'h', level: Math.min(m[1].length, 3), text: stripInline(m[2]) }); i++; continue; }
      if ((m = ln.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/))) { out.push({ t: 'li', text: stripInline(m[1]) }); i++; continue; }
      if (!ln.trim()) { i++; continue; }
      var para = [ln.trim()]; i++;
      while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*(`{3,}|~{3,})|\s*(?:[-*+]|\d+[.)])\s|\s*\|)/.test(lines[i])) para.push(lines[i++].trim());
      out.push({ t: 'p', text: stripInline(para.join(' ')) });
    }
    return out;
  }
  // Build model from {text, artifact, title}
  function toBlocks(src) {
    var a = src.artifact;
    if (a) {
      if (a.kind === 'chart') {
        var spec; try { spec = JSON.parse(a.content); } catch (e) { spec = null; }
        var blocks = [{ t: 'h', level: 1, text: a.title }];
        if (spec) { var n = chartTable(spec); blocks.push({ t: 'table', rows: n }); }
        blocks.push({ t: 'code', lang: 'json', lines: a.content.split('\n') });
        return blocks;
      }
      return [{ t: 'h', level: 1, text: a.title }, { t: 'code', lang: a.lang, lines: a.content.split('\n') }];
    }
    return parseMd(src.text);
  }
  function chartTable(spec) {
    var d = spec.data, rows = [];
    if (Array.isArray(d) && d.length && typeof d[0] === 'object') {
      var keys = Object.keys(d[0]); rows.push(keys); d.forEach(function (r) { rows.push(keys.map(function (k) { return r[k]; })); });
    } else if (Array.isArray(d)) { rows.push(['#', 'value']); d.forEach(function (v, i) { rows.push([i + 1, v]); }); }
    else if (d && d.labels) {
      var ds = d.datasets || d.series || [{ data: d.values }];
      rows.push(['label'].concat(ds.map(function (s, i) { return s.label || s.name || 'Series ' + (i + 1); }))); 
      d.labels.forEach(function (l, i) { rows.push([l].concat(ds.map(function (s) { return (s.data || s.values || [])[i]; }))); });
    } else if (d) { rows.push(['label', 'value']); Object.keys(d).forEach(function (k) { rows.push([k, d[k]]); }); }
    return rows;
  }
  function titleOf(src) {
    if (src.title) return src.title;
    if (src.artifact) return src.artifact.title;
    var m = String(src.text || '').match(/^#{1,3}\s+(.+)$/m);
    return m ? stripInline(m[1]).slice(0, 80) : 'Answer';
  }

  /* ---------- xml helpers ---------- */
  function x(s) { return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  var REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  var PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';
  var CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
  function rels(list) { return XML + '<Relationships xmlns="' + PKG + '">' + list.map(function (r) { return '<Relationship Id="' + r[0] + '" Type="' + (r[1].indexOf('http') === 0 ? r[1] : REL + '/' + r[1]) + '" Target="' + r[2] + '"/>'; }).join('') + '</Relationships>'; }
  function ctypes(defs, overrides) { return XML + '<Types xmlns="' + CT + '"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' + overrides.map(function (o) { return '<Override PartName="' + o[0] + '" ContentType="' + o[1] + '"/>'; }).join('') + '</Types>'; }

  /* ---------- DOCX ---------- */
  function docx(src) {
    var blocks = toBlocks(src), W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"', body = '';
    function p(text, style, extra) { return '<w:p><w:pPr>' + (style ? '<w:pStyle w:val="' + style + '"/>' : '') + (extra || '') + '</w:pPr><w:r><w:t xml:space="preserve">' + x(text) + '</w:t></w:r></w:p>'; }
    body += p(titleOf(src), 'Title');
    var first = blocks[0] && blocks[0].t === 'h' && blocks[0].text === titleOf(src);
    blocks.forEach(function (b, bi) {
      if (bi === 0 && first) return;
      if (b.t === 'h') body += p(b.text, 'Heading' + b.level);
      else if (b.t === 'p') body += p(b.text);
      else if (b.t === 'li') body += p('\u2022 ' + b.text, null, '<w:ind w:left="360" w:hanging="260"/>');
      else if (b.t === 'code') body += (b.lines.length ? b.lines : ['']).map(function (l) { return '<w:p><w:pPr><w:pStyle w:val="Code"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/></w:rPr><w:t xml:space="preserve">' + x(l) + '</w:t></w:r></w:p>'; }).join('');
      else if (b.t === 'table') {
        var ncol = Math.max.apply(null, b.rows.map(function (r) { return r.length; })) || 1, cw = Math.floor(9000 / ncol);
        body += '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(function (s) { return '<w:' + s + ' w:val="single" w:sz="4" w:space="0" w:color="999999"/>'; }).join('') + '</w:tblBorders></w:tblPr><w:tblGrid>' + new Array(ncol + 1).join('<w:gridCol w:w="' + cw + '"/>') + '</w:tblGrid>' +
          b.rows.map(function (r, ri) { var cells = ''; for (var c = 0; c < ncol; c++) cells += '<w:tc><w:tcPr><w:tcW w:w="' + cw + '" w:type="dxa"/></w:tcPr><w:p><w:r>' + (ri === 0 ? '<w:rPr><w:b/></w:rPr>' : '') + '<w:t xml:space="preserve">' + x(r[c]) + '</w:t></w:r></w:p></w:tc>'; return '<w:tr>' + cells + '</w:tr>'; }).join('') + '</w:tbl><w:p/>';
      }
    });
    var styles = XML + '<w:styles ' + W + '><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
      [['Title', 'Title', 44, 0], ['Heading1', 'heading 1', 32, 1], ['Heading2', 'heading 2', 28, 1], ['Heading3', 'heading 3', 24, 1]].map(function (s) { return '<w:style w:type="paragraph" w:styleId="' + s[0] + '"><w:name w:val="' + s[1] + '"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/>' + (s[3] ? '<w:outlineLvl w:val="' + (parseInt(s[0].slice(-1), 10) - 1) + '"/>' : '') + '</w:pPr><w:rPr><w:b/><w:sz w:val="' + s[2] + '"/></w:rPr></w:style>'; }).join('') +
      '<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="18"/></w:rPr></w:style></w:styles>';
    return zip([
      ['[Content_Types].xml', ctypes(0, [['/word/document.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'], ['/word/styles.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml']])],
      ['_rels/.rels', rels([['rId1', 'officeDocument', 'word/document.xml']])],
      ['word/_rels/document.xml.rels', rels([['rId1', 'styles', 'styles.xml']])],
      ['word/styles.xml', styles],
      ['word/document.xml', XML + '<w:document ' + W + '><w:body>' + body + '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>']
    ]);
  }

  /* ---------- XLSX ---------- */
  function colName(i) { var s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; }
  function xlsx(src) {
    var blocks = toBlocks(src), sheets = [], used = {};
    function addSheet(name, rows) {
      name = (name || 'Sheet').replace(/[\\\/?*\[\]:]/g, ' ').trim().slice(0, 28) || 'Sheet'; var base = name, n = 1;
      while (used[name.toLowerCase()]) name = base.slice(0, 26) + ' ' + (++n);
      used[name.toLowerCase()] = 1; sheets.push({ name: name, rows: rows });
    }
    var tn = 0;
    blocks.forEach(function (b) {
      if (b.t === 'table') addSheet('Table ' + (++tn), b.rows);
      else if (b.t === 'code' && b.lang === 'json') {
        try { var j = JSON.parse(b.lines.join('\n')); var arr = Array.isArray(j) ? j : (j && Array.isArray(j.data) ? j.data : null);
          if (arr && arr.length && typeof arr[0] === 'object') { var k = Object.keys(arr[0]); addSheet('JSON', [k].concat(arr.map(function (r) { return k.map(function (c) { return typeof r[c] === 'object' ? JSON.stringify(r[c]) : r[c]; }); }))); } } catch (e) {}
      }
    });
    var rest = [];
    blocks.forEach(function (b) {
      if (b.t === 'h' || b.t === 'p' || b.t === 'li') rest.push([b.t === 'li' ? '\u2022 ' + b.text : b.text]);
      else if (b.t === 'code') b.lines.forEach(function (l) { rest.push([l]); });
    });
    if (!sheets.length || rest.length) addSheet(sheets.length ? 'Text' : 'Content', rest.length ? rest : [['(empty)']]);
    var files = [], ov = [['/xl/workbook.xml', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml']], wbRels = [];
    sheets.forEach(function (s, i) {
      var maxc = 1; s.rows.forEach(function (r) { if (r.length > maxc) maxc = r.length; });
      var data = s.rows.map(function (r, ri) {
        var cells = '';
        for (var c = 0; c < r.length; c++) {
          var v = r[c]; if (v === undefined || v === null || v === '') continue; var ref = colName(c) + (ri + 1);
          var isNum = typeof v === 'number' || (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim()) && v.trim().length < 16);
          cells += isNum ? '<c r="' + ref + '"><v>' + Number(v) + '</v></c>' : '<c r="' + ref + '" t="inlineStr"' + (ri === 0 && s.rows.length > 1 ? ' s="1"' : '') + '><is><t xml:space="preserve">' + x(v) + '</t></is></c>';
        }
        return '<row r="' + (ri + 1) + '">' + cells + '</row>';
      }).join('');
      files.push(['xl/worksheets/sheet' + (i + 1) + '.xml', XML + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="' + maxc + '" width="' + (maxc === 1 ? 100 : 22) + '" customWidth="1"/></cols><sheetData>' + data + '</sheetData></worksheet>']);
      ov.push(['/xl/worksheets/sheet' + (i + 1) + '.xml', 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml']);
      wbRels.push(['rId' + (i + 1), 'worksheet', 'worksheets/sheet' + (i + 1) + '.xml']);
    });
    wbRels.push(['rId' + (sheets.length + 1), 'styles', 'styles.xml']);
    ov.push(['/xl/styles.xml', 'application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml']);
    var styles = XML + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
    return zip([
      ['[Content_Types].xml', ctypes(0, ov)],
      ['_rels/.rels', rels([['rId1', 'officeDocument', 'xl/workbook.xml']])],
      ['xl/workbook.xml', XML + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="' + REL + '"><sheets>' + sheets.map(function (s, i) { return '<sheet name="' + x(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets></workbook>'],
      ['xl/_rels/workbook.xml.rels', rels(wbRels)],
      ['xl/styles.xml', styles]
    ].concat(files));
  }

  /* ---------- PPTX ---------- */
  function wrapText(s, n) { var words = String(s).split(/\s+/), lines = [], cur = ''; words.forEach(function (w) { if ((cur + ' ' + w).trim().length > n && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }); if (cur) lines.push(cur); return lines; }
  function pptx(src) {
    var blocks = toBlocks(src), slides = [], cur = null, title = titleOf(src);
    function nw(t) { cur = { title: t, items: [], code: null, table: null }; slides.push(cur); }
    function base() { return cur.cover ? 'Overview' : cur.title.replace(/( \((cont\.|code|table)\))+$/, ''); }
    nw(title); cur.items.push(src.artifact ? (src.artifact.kind + ' artifact') : 'Generated from Perplexity answer'); cur.cover = true;
    blocks.forEach(function (b) {
      if (b.t === 'h' && !(b.level === 1 && b.text === title && slides.length === 1)) nw(b.text);
      else if (b.t === 'p' || b.t === 'li') { if (cur.cover || cur.items.length >= 6 || cur.code || cur.table) nw(cur.cover ? 'Overview' : base() + ' (cont.)'); cur.items.push(b.text.length > 220 ? b.text.slice(0, 217) + '…' : b.text); }
      else if (b.t === 'code') { if (cur.cover || cur.items.length > 1 || cur.code || cur.table) nw(base() + ' (code)'); cur.code = b.lines.slice(0, 22); if (b.lines.length > 22) cur.code.push('… (' + (b.lines.length - 22) + ' more lines)'); }
      else if (b.t === 'table') { if (cur.cover || cur.items.length > 1 || cur.code || cur.table) nw(base() + ' (table)'); cur.table = b.rows.slice(0, 12); }
    });
    var NSP = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="' + REL + '" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
    var CX = 12192000, CY = 6858000, id = 2;
    function sp(name, xx, y, w, h, paras, opt) {
      opt = opt || {};
      return '<p:sp><p:nvSpPr><p:cNvPr id="' + (++id) + '" name="' + name + '"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="' + xx + '" y="' + y + '"/><a:ext cx="' + w + '" cy="' + h + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' + (opt.fill ? '<a:solidFill><a:srgbClr val="' + opt.fill + '"/></a:solidFill>' : '<a:noFill/>') + '</p:spPr><p:txBody><a:bodyPr wrap="square" rtlCol="0"><a:normAutofit/></a:bodyPr><a:lstStyle/>' +
        paras.map(function (t) { return '<a:p><a:pPr' + (opt.bullet ? ' marL="285750" indent="-285750"' : '') + '>' + (opt.bullet ? '<a:buChar char="&#8226;"/>' : '<a:buNone/>') + '</a:pPr><a:r><a:rPr lang="en-US" sz="' + (opt.sz || 1800) + '"' + (opt.b ? ' b="1"' : '') + ' dirty="0"><a:solidFill><a:srgbClr val="' + (opt.color || '222222') + '"/></a:solidFill>' + (opt.mono ? '<a:latin typeface="Courier New"/>' : '') + '</a:rPr><a:t>' + x(t) + '</a:t></a:r></a:p>'; }).join('') + '</p:txBody></p:sp>';
    }
    var files = [], ov = [['/ppt/presentation.xml', 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml'], ['/ppt/slideMasters/slideMaster1.xml', 'application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml'], ['/ppt/slideLayouts/slideLayout1.xml', 'application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml'], ['/ppt/theme/theme1.xml', 'application/vnd.openxmlformats-officedocument.theme+xml']];
    var presRels = [['rId1', 'slideMaster', 'slideMasters/slideMaster1.xml']];
    slides.forEach(function (s, i) {
      id = 1; var shapes;
      if (s.cover) shapes = sp('Title', 685800, 2200000, 10820000, 1200000, [s.title.slice(0, 90)], { sz: 4000, b: 1, color: '14646B' }) + sp('Subtitle', 685800, 3500000, 10820000, 600000, s.items, { sz: 2000, color: '666666' });
      else {
        shapes = sp('Title', 685800, 380000, 10820000, 900000, [s.title.slice(0, 90)], { sz: 3000, b: 1, color: '14646B' });
        if (s.items.length) shapes += sp('Body', 685800, 1400000, 10820000, s.code || s.table ? 1200000 : 4800000, s.items, { bullet: 1, sz: 2000 });
        if (s.code) shapes += sp('Code', 685800, s.items.length ? 2700000 : 1400000, 10820000, 3700000, s.code.map(function (l) { return l.slice(0, 95); }), { mono: 1, sz: 1100, fill: 'F2F2F2' });
        if (s.table) {
          var nc = Math.max.apply(null, s.table.map(function (r) { return r.length; })) || 1, cw = Math.floor(10820000 / nc);
          shapes += '<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="' + (++id) + '" name="Table"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="685800" y="' + (s.items.length ? 2700000 : 1400000) + '"/><a:ext cx="10820000" cy="' + (s.table.length * 370000) + '"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1"/><a:tblGrid>' + new Array(nc + 1).join('<a:gridCol w="' + cw + '"/>') + '</a:tblGrid>' +
            s.table.map(function (r, ri) { var c = ''; for (var k = 0; k < nc; k++) c += '<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="1400"' + (ri === 0 ? ' b="1"' : '') + '/><a:t>' + x(String(r[k] == null ? '' : r[k]).slice(0, 60)) + '</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>'; return '<a:tr h="370000">' + c + '</a:tr>'; }).join('') + '</a:tbl></a:graphicData></a:graphic></p:graphicFrame>';
        }
      }
      files.push(['ppt/slides/slide' + (i + 1) + '.xml', XML + '<p:sld ' + NSP + '><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' + shapes + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>']);
      files.push(['ppt/slides/_rels/slide' + (i + 1) + '.xml.rels', rels([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml']])]);
      ov.push(['/ppt/slides/slide' + (i + 1) + '.xml', 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml']);
      presRels.push(['rId' + (i + 2), 'slide', 'slides/slide' + (i + 1) + '.xml']);
    });
    presRels.push(['rId' + (slides.length + 2), 'theme', 'theme/theme1.xml']);
    var grp = '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree>';
    var theme = XML + '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office"><a:themeElements><a:clrScheme name="Office"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F2937"/></a:dk2><a:lt2><a:srgbClr val="F4F4F1"/></a:lt2><a:accent1><a:srgbClr val="14646B"/></a:accent1><a:accent2><a:srgbClr val="3D9595"/></a:accent2><a:accent3><a:srgbClr val="D19A66"/></a:accent3><a:accent4><a:srgbClr val="C678DD"/></a:accent4><a:accent5><a:srgbClr val="E5484D"/></a:accent5><a:accent6><a:srgbClr val="7FB77E"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Office"><a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="28575"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>';
    return zip([
      ['[Content_Types].xml', ctypes(0, ov)],
      ['_rels/.rels', rels([['rId1', 'officeDocument', 'ppt/presentation.xml']])],
      ['ppt/presentation.xml', XML + '<p:presentation ' + NSP + '><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>' + slides.map(function (s, i) { return '<p:sldId id="' + (256 + i) + '" r:id="rId' + (i + 2) + '"/>'; }).join('') + '</p:sldIdLst><p:sldSz cx="' + CX + '" cy="' + CY + '"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>'],
      ['ppt/_rels/presentation.xml.rels', rels(presRels)],
      ['ppt/slideMasters/slideMaster1.xml', XML + '<p:sldMaster ' + NSP + '><p:cSld>' + grp + '</p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>'],
      ['ppt/slideMasters/_rels/slideMaster1.xml.rels', rels([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId2', 'theme', '../theme/theme1.xml']])],
      ['ppt/slideLayouts/slideLayout1.xml', XML + '<p:sldLayout ' + NSP + ' type="blank"><p:cSld name="Blank">' + grp + '</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>'],
      ['ppt/slideLayouts/_rels/slideLayout1.xml.rels', rels([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']])],
      ['ppt/theme/theme1.xml', theme]
    ].concat(files));
  }

  /* ---------- PDF ---------- */
  function pdfStr(s) { // WinAnsi-safe, escaped
    return String(s).replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, '-').replace(/\u2026/g, '...').replace(/\u2022/g, '\u0095').replace(/\t/g, '    ')
      .replace(/[^\x20-\x7E\u0095\u00A0-\u00FF]/g, '?').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }
  function latin1(s) { var b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); b[i] = c === 0x95 ? 0x95 : c & 255; } return b; }
  function pdf(src) {
    var blocks = toBlocks(src), PW = 612, PH = 792, M = 54, pages = [], ops = '', y = PH - M;
    function np() { if (ops) pages.push(ops); ops = ''; y = PH - M; }
    function line(text, font, size, lead, indent, color) {
      if (y - lead < M) np();
      y -= lead; ops += 'BT ' + (color || '0 g') + ' /' + font + ' ' + size + ' Tf ' + (M + (indent || 0)) + ' ' + y.toFixed(1) + ' Td (' + pdfStr(text) + ') Tj ET\n';
    }
    function gap(h) { y -= h; if (y < M) np(); }
    var title = titleOf(src); line(title, 'F2', 20, 24, 0, '0.08 0.39 0.42 rg'); gap(8);
    var skipFirst = blocks[0] && blocks[0].t === 'h' && blocks[0].text === title;
    blocks.forEach(function (b, bi) {
      if (bi === 0 && skipFirst) return;
      if (b.t === 'h') { gap(8); var sz = [0, 17, 14, 12][b.level]; wrapText(b.text, Math.floor(95 / (sz / 11))).forEach(function (l) { line(l, 'F2', sz, sz + 5, 0); }); gap(2); }
      else if (b.t === 'p') { wrapText(b.text, 92).forEach(function (l) { line(l, 'F1', 11, 15, 0); }); gap(5); }
      else if (b.t === 'li') { wrapText(b.text, 86).forEach(function (l, i) { line((i ? '' : '\u0095 ') + l, 'F1', 11, 15, i ? 24 : 12); }); gap(2); }
      else if (b.t === 'code') {
        gap(4);
        b.lines.forEach(function (l) {
          var segs = []; l = l.replace(/\t/g, '    '); do { segs.push(l.slice(0, 88)); l = l.slice(88); } while (l.length);
          segs.forEach(function (sg) { line(sg, 'F3', 9, 11.5, 6, '0.15 g'); });
        });
        gap(8);
      } else if (b.t === 'table') {
        var nc = Math.max.apply(null, b.rows.map(function (r) { return r.length; })) || 1, cwid = Math.floor((PW - 2 * M) / nc), maxch = Math.max(4, Math.floor(cwid / 5.4));
        b.rows.forEach(function (r, ri) {
          if (y - 16 < M) np();
          y -= 16; ops += '0.5 G ' + M + ' ' + (y - 4) + ' ' + (PW - 2 * M) + ' 16 re S\n';
          for (var c = 0; c < nc; c++) ops += 'BT 0 g /' + (ri === 0 ? 'F2' : 'F1') + ' 10 Tf ' + (M + c * cwid + 3) + ' ' + y.toFixed(1) + ' Td (' + pdfStr(String(r[c] == null ? '' : r[c]).slice(0, maxch)) + ') Tj ET\n';
        });
        gap(10);
      }
    });
    np();
    if (!pages.length) pages.push('');
    var objs = [], N = pages.length;
    // 1 catalog, 2 pages, 3-5 fonts, then page/content pairs
    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    var kids = []; for (var i = 0; i < N; i++) kids.push((6 + 2 * i) + ' 0 R');
    objs[2] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + N + ' >>';
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    objs[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>';
    pages.forEach(function (c, i) {
      var footer = 'BT 0.5 g /F1 9 Tf ' + (PW / 2 - 12) + ' 30 Td (' + (i + 1) + ' / ' + N + ') Tj ET\n';
      objs[6 + 2 * i] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ' + (7 + 2 * i) + ' 0 R >>';
      var stream = c + footer; objs[7 + 2 * i] = { stream: stream };
    });
    var out = '%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n', offs = [];
    for (var k = 1; k < objs.length; k++) {
      offs[k] = out.length;
      var o = objs[k];
      out += k + ' 0 obj\n' + (typeof o === 'string' ? o : '<< /Length ' + o.stream.length + ' >>\nstream\n' + o.stream + 'endstream') + '\nendobj\n';
    }
    var xref = out.length;
    out += 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n' + offs.slice(1).map(function (o) { return ('0000000000' + o).slice(-10) + ' 00000 n \n'; }).join('') +
      'trailer\n<< /Size ' + objs.length + ' /Root 1 0 R /Info << /Title (' + pdfStr(title) + ') /Producer (Perplexity Artifacts) >> >>\nstartxref\n' + xref + '\n%%EOF\n';
    return new Blob([latin1(out)], { type: 'application/pdf' });
  }

  /* ---------- API ---------- */
  var FORMATS = {
    docx: { fn: docx, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', label: 'Word (.docx)' },
    xlsx: { fn: xlsx, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', label: 'Excel (.xlsx)' },
    pptx: { fn: pptx, mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', label: 'PowerPoint (.pptx)' },
    pdf: { fn: pdf, mime: 'application/pdf', label: 'PDF (.pdf)' }
  };
  function generate(fmt, src) {
    var f = FORMATS[fmt]; if (!f) throw new Error('Unsupported format: ' + fmt);
    var b = f.fn(src || {}); return b.type === f.mime ? b : new Blob([b], { type: f.mime });
  }
  function fileName(fmt, src) { return (titleOf(src).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'artifact') + '.' + fmt; }
  function download(fmt, src) {
    var blob = generate(fmt, src), name = fileName(fmt, src), url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000); return { name: name, size: blob.size };
  }

  /* ---------- UI: Export menu ---------- */
  function exportMenu(getSrc, cls) {
    var wrap = document.createElement('span'); wrap.className = 'artifact-export'; wrap.style.position = 'relative'; wrap.style.display = 'inline-block';
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = cls; btn.textContent = 'Export \u25BE'; btn.setAttribute('aria-haspopup', 'menu'); btn.setAttribute('aria-expanded', 'false');
    var menu = document.createElement('div'); menu.className = 'artifact-export-menu'; menu.setAttribute('role', 'menu'); menu.hidden = true;
    Object.keys(FORMATS).forEach(function (f) {
      var it = document.createElement('button'); it.type = 'button'; it.setAttribute('role', 'menuitem'); it.setAttribute('data-format', f); it.textContent = FORMATS[f].label;
      it.onclick = function (e) { e.stopPropagation(); menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); try { download(f, getSrc()); } catch (err) { console.error(err); } };
      menu.appendChild(it);
    });
    btn.onclick = function (e) { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden)); };
    document.addEventListener('click', function () { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); });
    wrap.appendChild(btn); wrap.appendChild(menu); return wrap;
  }
  function hookViewer() {
    new MutationObserver(function (muts) {
      muts.forEach(function (m) { m.addedNodes.forEach(function (n) {
        if (n.nodeType === 1 && n.classList.contains('artifact-overlay') && !n.querySelector('.artifact-export') && window.ArtifactsUI && window.ArtifactsUI.current) {
          var bar = n.querySelector('.artifact-bar'), close = bar.querySelector('[data-action="close"]'), art = window.ArtifactsUI.current();
          if (art) bar.insertBefore(exportMenu(function () { return { artifact: art }; }, 'artifact-btn'), close);
        }
      }); });
    }).observe(document.body, { childList: true });
  }
  /* v95: the answer footer has ONE Export menu (owned by export.js). It pulls the file formats from here
     via menuItems() instead of rendering a second "Export ▾" button next to it. */
  function menuItems(getSrc) {
    return Object.keys(FORMATS).map(function (f) {
      return { label: FORMATS[f].label, run: function () { try { download(f, getSrc()); } catch (err) { console.error(err); } } };
    });
  }
  function hookAnswers() { /* no-op: see menuItems() */ }
  function ready() { if (document.body) { hookViewer(); hookAnswers(); } else document.addEventListener('DOMContentLoaded', function () { hookViewer(); hookAnswers(); }); }

  window.ArtifactsFiles = { _loaded: true, generate: generate, download: download, fileName: fileName, formats: Object.keys(FORMATS), exportMenu: exportMenu, menuItems: menuItems, parseMd: parseMd, zip: zip };
  ready();
})();
