(function () {
  "use strict";
  if (window.EntityCards) return;
  var TICKERS = "AAPL|MSFT|GOOGL|NVDA|TSLA|SPY|QQQ|BTC|ETH";
  var CRYPTO = { BTC: "btcusd", ETH: "ethusd" };
  var TTL = 300000, MAX = 3, TMO = 8000;
  var cache = {}, hint = "", obs = null, timer = null;

  function tfetch(url) {
    var c = typeof AbortController !== "undefined" ? new AbortController() : null;
    var t = setTimeout(function () { if (c) c.abort(); }, TMO);
    var p = fetch(url, c ? { signal: c.signal } : undefined).then(function (r) {
      if (!r || !r.ok) throw new Error("http"); return r.text();
    });
    return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error("timeout")); }, TMO); })])
      .then(function (v) { clearTimeout(t); return v; }, function (e) { clearTimeout(t); throw e; });
  }
  function cached(key, fn) {
    var h = cache[key];
    if (h && Date.now() - h.t < TTL) return h.p;
    var p = fn(); cache[key] = { t: Date.now(), p: p };
    p.catch(function () { delete cache[key]; });
    return p;
  }

  function detectTickers(text) {
    var out = [], seen = {}, re = new RegExp("\\$([A-Za-z]{1,5})\\b|\\b(" + TICKERS + ")\\b", "g"), m;
    while ((m = re.exec(text)) && out.length < MAX) {
      var s = (m[2] || m[1]).toUpperCase();
      if (m[1] && !new RegExp("^(" + TICKERS + ")$").test(s)) continue;
      if (!seen[s]) { seen[s] = 1; out.push(s); }
    }
    return out;
  }
  var PROXY = "https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/quotes?symbols=";
  function getQuotes(syms) {
    var need = syms.filter(function (s) { var h = cache["q:" + s]; return !(h && Date.now() - h.t < TTL); });
    if (need.length) {
      var batch = tfetch(PROXY + need.join(",")).then(function (t) {
        var list = (JSON.parse(t) || {}).quotes || [], map = {};
        list.forEach(function (q) { if (q && q.symbol) map[String(q.symbol).toUpperCase()] = q; });
        return map;
      });
      need.forEach(function (s) {
        cache["q:" + s] = { t: Date.now(), p: batch.then(function (map) {
          var q = map[s]; if (!q || !isFinite(parseFloat(q.price))) throw new Error("nq");
          var cl = (q.closes || []).map(parseFloat).filter(isFinite).slice(-10);
          return { sym: s, last: parseFloat(q.price), chg: parseFloat(q.change_pct) || 0, closes: cl };
        }) };
        cache["q:" + s].p.catch(function () { delete cache["q:" + s]; });
      });
    }
    return syms.map(function (s) { return cache["q:" + s].p; });
  }

  var WC = { 0: ["Clear sky", "\u2600\uFE0F"], 1: ["Mainly clear", "\uD83C\uDF24\uFE0F"], 2: ["Partly cloudy", "\u26C5"], 3: ["Overcast", "\u2601\uFE0F"],
    45: ["Fog", "\uD83C\uDF2B\uFE0F"], 48: ["Rime fog", "\uD83C\uDF2B\uFE0F"], 51: ["Light drizzle", "\uD83C\uDF26\uFE0F"], 53: ["Drizzle", "\uD83C\uDF26\uFE0F"], 55: ["Heavy drizzle", "\uD83C\uDF27\uFE0F"],
    61: ["Light rain", "\uD83C\uDF27\uFE0F"], 63: ["Rain", "\uD83C\uDF27\uFE0F"], 65: ["Heavy rain", "\uD83C\uDF27\uFE0F"], 71: ["Light snow", "\uD83C\uDF28\uFE0F"], 73: ["Snow", "\uD83C\uDF28\uFE0F"], 75: ["Heavy snow", "\u2744\uFE0F"],
    80: ["Rain showers", "\uD83C\uDF26\uFE0F"], 81: ["Rain showers", "\uD83C\uDF27\uFE0F"], 82: ["Violent showers", "\u26C8\uFE0F"], 95: ["Thunderstorm", "\u26C8\uFE0F"], 96: ["Thunderstorm, hail", "\u26C8\uFE0F"], 99: ["Thunderstorm, hail", "\u26C8\uFE0F"] };

  function cityFromHint(q) {
    if (!q || !/weather|temperature|forecast/i.test(q)) return null;
    var m = /\b(?:in|for|at|near)\s+([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,3}|[a-z][a-z.'-]*(?:\s+[a-z][a-z.'-]*){0,2})\s*(?:[?.,!]|\b(?:today|now|right|tomorrow|tonight|this|currently)\b|$)/.exec(q);
    if (m) return m[1].trim();
    m = /^\s*([A-Za-z][A-Za-z .'-]{1,40}?)\s+(?:weather|temperature|forecast)\b/i.exec(q);
    return m ? m[1].trim() : null;
  }
  function getWeather(city) {
    return cached("w:" + city.toLowerCase(), function () {
      return tfetch("https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(city) + "&count=1").then(function (t) {
        var g = JSON.parse(t), r = g && g.results && g.results[0]; if (!r) throw new Error("geo");
        return tfetch("https://api.open-meteo.com/v1/forecast?latitude=" + r.latitude + "&longitude=" + r.longitude +
          "&current=temperature_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph").then(function (w) {
          var c = JSON.parse(w).current; if (!c) throw new Error("nw");
          return { name: r.name + (r.admin1 ? ", " + r.admin1 : ""), temp: c.temperature_2m, code: c.weather_code, wind: c.wind_speed_10m };
        });
      });
    });
  }

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function spark(vals, up) {
    var ns = "http://www.w3.org/2000/svg", s = document.createElementNS(ns, "svg");
    s.setAttribute("class", "ec-spark " + (up ? "ec-up" : "ec-down")); s.setAttribute("viewBox", "0 0 96 32");
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), rg = mx - mn || 1;
    var pts = vals.map(function (v, i) { return (i * 96 / (vals.length - 1)).toFixed(1) + "," + (30 - (v - mn) / rg * 28).toFixed(1); }).join(" ");
    var pl = document.createElementNS(ns, "polyline"); pl.setAttribute("points", pts); s.appendChild(pl); return s;
  }
  function liveChip() { return el("span", "ec-live", "LIVE"); }
  function quoteCard(d) {
    var c = el("div", "ec-card ec-quote"), m = el("div", "ec-main"), top = el("div", "ec-top");
    top.appendChild(el("span", "ec-sym", d.sym)); top.appendChild(liveChip()); m.appendChild(top);
    m.appendChild(el("div", "ec-price", "$" + d.last.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })));
    var up = d.chg >= 0;
    m.appendChild(el("div", "ec-chg " + (up ? "ec-up" : "ec-down"), (up ? "+" : "") + d.chg.toFixed(2) + "% today"));
    c.appendChild(m);
    if (d.closes.length > 1) c.appendChild(spark(d.closes, up));
    return c;
  }
  function weatherCard(d) {
    var w = WC[d.code] || ["Conditions", "\uD83C\uDF21\uFE0F"], c = el("div", "ec-card ec-weather");
    c.appendChild(el("div", "ec-icon", w[1]));
    var m = el("div", "ec-main"), top = el("div", "ec-top");
    top.appendChild(el("span", "ec-sym", d.name)); top.appendChild(liveChip()); m.appendChild(top);
    m.appendChild(el("div", "ec-price", Math.round(d.temp) + "\u00B0F"));
    m.appendChild(el("div", "ec-sub", w[0] + " \u00B7 Wind " + Math.round(d.wind) + " mph"));
    c.appendChild(m); return c;
  }

  function process(content, question) {
    if (!content || content.getAttribute("data-ec")) return;
    content.setAttribute("data-ec", "1");
    var text = content.textContent || "", jobs = [];
    var city = cityFromHint(question != null ? question : hint);
    if (city) jobs.push(getWeather(city).then(weatherCard));
    getQuotes(detectTickers(text)).forEach(function (p) { jobs.push(p.then(quoteCard)); });
    jobs = jobs.slice(0, MAX);
    if (!jobs.length) return;
    var wrap = el("div", "ec-wrap"); wrap.setAttribute("data-ec-wrap", "1");
    Promise.all(jobs.map(function (p) { return p.then(function (n) { return n; }, function () { return null; }); })).then(function (cards) {
      cards = cards.filter(Boolean);
      if (!cards.length) return;
      cards.forEach(function (n) { wrap.appendChild(n); });
      content.insertBefore(wrap, content.firstChild);
    });
  }
  function scan() {
    timer = null;
    var list = document.querySelectorAll(".answer-content:not([data-ec])");
    for (var i = 0; i < list.length; i++) process(list[i]);
  }
  function attach() {
    if (obs || typeof MutationObserver === "undefined") return;
    obs = new MutationObserver(function () { if (!timer) timer = setTimeout(scan, 250); });
    obs.observe(document.body, { childList: true, subtree: true });
    scan();
  }
  window.EntityCards = { attach: attach, questionHint: function (q) { hint = String(q || ""); }, process: process, _detect: detectTickers, _city: cityFromHint };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", attach); else attach();
})();
