(function () {
  "use strict";
  var LIVE = "https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/live-data";
  var TABS = [["finance", "Finance"], ["sports", "Sports"], ["weather", "Weather"], ["travel", "Travel"]];
  var LEAGUES = [["nba", "NBA"], ["nfl", "NFL"], ["mlb", "MLB"], ["nhl", "NHL"], ["epl", "Premier League"], ["mls", "MLS"], ["ucl", "Champions League"], ["ncaaf", "College Football"], ["ncaam", "College Hoops"], ["wnba", "WNBA"]];
  var WC = { 0: ["Clear", "\u2600\uFE0F"], 1: ["Mainly clear", "\uD83C\uDF24\uFE0F"], 2: ["Partly cloudy", "\u26C5"], 3: ["Overcast", "\u2601\uFE0F"], 45: ["Fog", "\uD83C\uDF2B\uFE0F"], 48: ["Fog", "\uD83C\uDF2B\uFE0F"],
    51: ["Drizzle", "\uD83C\uDF26\uFE0F"], 53: ["Drizzle", "\uD83C\uDF26\uFE0F"], 55: ["Drizzle", "\uD83C\uDF27\uFE0F"], 61: ["Light rain", "\uD83C\uDF27\uFE0F"], 63: ["Rain", "\uD83C\uDF27\uFE0F"], 65: ["Heavy rain", "\uD83C\uDF27\uFE0F"],
    71: ["Light snow", "\uD83C\uDF28\uFE0F"], 73: ["Snow", "\uD83C\uDF28\uFE0F"], 75: ["Heavy snow", "\u2744\uFE0F"], 80: ["Showers", "\uD83C\uDF26\uFE0F"], 81: ["Showers", "\uD83C\uDF27\uFE0F"], 82: ["Heavy showers", "\u26C8\uFE0F"],
    95: ["Thunderstorm", "\u26C8\uFE0F"], 96: ["Thunderstorm", "\u26C8\uFE0F"], 99: ["Thunderstorm", "\u26C8\uFE0F"] };
  var DEF_WL = ["AAPL", "MSFT", "NVDA", "TSLA", "SPY"];
  var root = null, S = null, timer = null, lastFocus = null;

  function esc(s) { var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }
  function client() { return (typeof sb !== "undefined") ? sb : window.sb; }
  function ls(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function getJSON(url) {
    var c = typeof AbortController !== "undefined" ? new AbortController() : null, t = setTimeout(function () { if (c) c.abort(); }, 10000);
    return fetch(url, c ? { signal: c.signal } : undefined).then(function (r) { clearTimeout(t); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }, function (e) { clearTimeout(t); throw e; });
  }
  function ensureCss() {
    if (document.querySelector('link[href*="hubs.css"]')) return;
    var l = document.createElement("link"); l.rel = "stylesheet"; l.href = "modules/hubs.css"; document.head.appendChild(l);
  }
  function user() {
    try { var c = client(); return c.auth.getSession().then(function (r) { return r && r.data && r.data.session ? r.data.session.user : null; }); } catch (e) { return Promise.resolve(null); }
  }
  function spark(vals, up) {
    if (!vals || vals.length < 2) return "";
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), rg = mx - mn || 1;
    var pts = vals.map(function (v, i) { return (i * 80 / (vals.length - 1)).toFixed(1) + "," + (24 - (v - mn) / rg * 22).toFixed(1); }).join(" ");
    return '<svg class="hb-spark ' + (up ? "hb-up" : "hb-down") + '" viewBox="0 0 80 26"><polyline points="' + pts + '"/></svg>';
  }
  function money(n) { return "$" + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function pct(n) { return n == null ? "" : (n >= 0 ? "+" : "") + n.toFixed(2) + "%"; }

  // ---------- persistence (Supabase w/ RLS, localStorage fallback) ----------
  var store = {
    loadWatchlist: function () {
      return user().then(function (u) {
        if (!u) return { list: ls("hb_watchlist", DEF_WL), cloud: false };
        return client().from("watchlist").select("symbol,position").order("position", { ascending: true }).then(function (r) {
          if (r.error) return { list: ls("hb_watchlist", DEF_WL), cloud: false };
          var l = (r.data || []).map(function (x) { return x.symbol; });
          return { list: l.length ? l : [], cloud: true };
        });
      }).catch(function () { return { list: ls("hb_watchlist", DEF_WL), cloud: false }; });
    },
    addSymbol: function (sym, pos) {
      if (!S.cloud) { var l = ls("hb_watchlist", DEF_WL); if (l.indexOf(sym) < 0) l.push(sym); lsSet("hb_watchlist", l); return Promise.resolve(); }
      return client().from("watchlist").insert({ symbol: sym, position: pos }).then(function (r) { if (r.error && !/duplicate/i.test(r.error.message)) throw new Error(r.error.message); });
    },
    delSymbol: function (sym) {
      if (!S.cloud) { lsSet("hb_watchlist", ls("hb_watchlist", DEF_WL).filter(function (x) { return x !== sym; })); return Promise.resolve(); }
      return client().from("watchlist").delete().eq("symbol", sym).then(function (r) { if (r.error) throw new Error(r.error.message); });
    },
    getPref: function (key) {
      return user().then(function (u) {
        if (!u) return ls("hb_" + key, []);
        return client().from("hub_prefs").select(key).maybeSingle().then(function (r) { return !r.error && r.data && r.data[key] ? r.data[key] : ls("hb_" + key, []); });
      }).catch(function () { return ls("hb_" + key, []); });
    },
    setPref: function (key, val) {
      lsSet("hb_" + key, val);
      return user().then(function (u) {
        if (!u) return;
        var row = { user_id: u.id, updated_at: new Date().toISOString() }; row[key] = val;
        return client().from("hub_prefs").upsert(row, { onConflict: "user_id" });
      }).catch(function () {});
    }
  };

  // ---------- Finance ----------
  function quoteRows(qs, cols) {
    return qs.map(function (q) {
      var up = (q.change_pct || 0) >= 0;
      return '<tr><td><b>' + esc(q.symbol) + '</b><div class="hb-muted">' + esc(q.name) + '</div></td><td>' + spark(q.closes, up) + '</td><td class="r">' + money(q.price) +
        '</td><td class="r ' + (up ? "hb-up" : "hb-down") + '">' + pct(q.change_pct) + '</td>' + (cols ? '<td class="r"><button class="hb-del" data-act="wl-del" data-sym="' + esc(q.symbol) + '" aria-label="Remove ' + esc(q.symbol) + '">\u00D7</button></td>' : "") + '</tr>';
    }).join("");
  }
  function loadFinance() {
    var f = S.fin = S.fin || {};
    return store.loadWatchlist().then(function (w) {
      S.cloud = w.cloud; f.list = w.list;
      var all = ["SPY", "QQQ", "BTC", "ETH"].concat(f.list).filter(function (x, i, a) { return a.indexOf(x) === i; }).slice(0, 25);
      return Promise.all([
        getJSON(LIVE + "?action=quotes&symbols=" + encodeURIComponent(all.join(","))).catch(function () { return { quotes: [] }; }),
        f.list.length ? getJSON(LIVE + "?action=earnings&symbols=" + encodeURIComponent(f.list.slice(0, 15).join(","))).catch(function () { return { earnings: [] }; }) : { earnings: [] },
        getJSON(LIVE + "?action=earnings&date=" + new Date().toISOString().slice(0, 10)).catch(function () { return { rows: [] }; })
      ]);
    }).then(function (r) {
      var m = {}; (r[0].quotes || []).forEach(function (q) { m[q.symbol] = q; });
      f.map = m; f.earn = (r[1].earnings || []).sort(function (a, b) { return a.date < b.date ? -1 : 1; }); f.today = (r[2].rows || []).slice(0, 10);
    });
  }
  function viewFinance() {
    var f = S.fin; if (!f || !f.map) return '<div class="hb-muted">Loading markets\u2026</div>';
    var idx = ["SPY", "QQQ", "BTC", "ETH"].map(function (s) {
      var q = f.map[s]; if (!q) return ""; var up = (q.change_pct || 0) >= 0;
      return '<div class="hb-tile"><div class="hb-sym">' + s + '</div><div class="hb-px">' + money(q.price) + '</div><div class="' + (up ? "hb-up" : "hb-down") + '">' + pct(q.change_pct) + '</div></div>';
    }).join("");
    var wl = f.list.map(function (s) { return f.map[s]; }).filter(Boolean);
    var h = '<div class="hb-card"><h3 class="hb-h">Markets</h3><div class="hb-idx">' + idx + '</div></div>';
    h += '<div class="hb-card"><h3 class="hb-h">Watchlist ' + (S.cloud ? '<span class="hb-muted" style="text-transform:none">\u00B7 synced to your account</span>' : '<span class="hb-muted" style="text-transform:none">\u00B7 saved on this device (sign in to sync)</span>') + '</h3>' +
      '<div class="hb-row" style="margin-bottom:8px"><input class="hb-input" id="hbSym" placeholder="Add ticker, e.g. AMD" maxlength="12" style="width:180px"><button class="hb-btn primary" data-act="wl-add">Add</button><span class="hb-err" id="hbErr"></span></div>' +
      (wl.length ? '<table class="hb-table"><tr><th>Symbol</th><th>5 wk</th><th class="r">Price</th><th class="r">Day</th><th></th></tr>' + quoteRows(wl, true) + '</table>' : '<div class="hb-muted">Your watchlist is empty.</div>') + '</div>';
    h += '<div class="hb-card"><h3 class="hb-h">Upcoming earnings (watchlist)</h3>' + (f.earn.length ? '<table class="hb-table"><tr><th>Symbol</th><th>Date</th><th class="r">EPS est.</th><th class="r">Revenue est.</th></tr>' + f.earn.map(function (e) {
      return '<tr><td><b>' + esc(e.symbol) + '</b></td><td>' + esc(e.date) + (e.estimated ? ' <span class="hb-muted">(est.)</span>' : "") + '</td><td class="r">' + (e.eps_avg != null ? e.eps_avg.toFixed(2) : "\u2014") + '</td><td class="r">' + (e.rev_avg ? "$" + (e.rev_avg / 1e9).toFixed(2) + "B" : "\u2014") + '</td></tr>'; }).join("") + '</table>' : '<div class="hb-muted">No upcoming earnings dates found.</div>') + '</div>';
    h += '<div class="hb-card"><h3 class="hb-h">Reporting today \u00B7 largest companies</h3>' + (f.today.length ? '<table class="hb-table"><tr><th>Symbol</th><th>Company</th><th>When</th><th class="r">EPS est.</th></tr>' + f.today.map(function (e) {
      return '<tr><td><b>' + esc(e.symbol) + '</b></td><td>' + esc(e.name) + '</td><td>' + esc(e.time) + '</td><td class="r">' + esc(e.eps_forecast) + '</td></tr>'; }).join("") + '</table>' : '<div class="hb-muted">No reports found for today.</div>') + '</div>';
    return h;
  }

  // ---------- Sports ----------
  function ymd(d) { return d.getFullYear() + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2); }
  function loadSports() {
    var s = S.sp = S.sp || { league: ls("hb_league", "nba"), off: 0 };
    var d = new Date(Date.now() + s.off * 86400000);
    return getJSON(LIVE + "?action=sports&league=" + s.league + "&dates=" + ymd(d)).then(function (r) { s.games = r.games || []; s.date = d; s.err = ""; }).catch(function () { s.games = []; s.err = "Could not load scores."; });
  }
  function viewSports() {
    var s = S.sp || { league: "nba", off: 0 };
    var h = '<div class="hb-card"><div class="hb-row">' + LEAGUES.map(function (l) { return '<button class="hb-chip' + (l[0] === s.league ? " active" : "") + '" data-act="league" data-v="' + l[0] + '">' + l[1] + '</button>'; }).join("") + '</div>' +
      '<div class="hb-row" style="margin-top:12px"><button class="hb-btn" data-act="day" data-v="-1">\u2039 Prev</button><b class="hb-grow" style="text-align:center">' + (s.date ? esc(s.date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })) : "") + '</b><button class="hb-btn" data-act="day" data-v="0">Today</button><button class="hb-btn" data-act="day" data-v="1">Next \u203A</button></div></div>';
    h += '<div class="hb-card">' + (s.err ? '<div class="hb-err">' + esc(s.err) + '</div>' : !s.games ? '<div class="hb-muted">Loading scores\u2026</div>' : !s.games.length ? '<div class="hb-muted">No games scheduled.</div>' : s.games.map(function (g) {
      function t(x) { return '<div class="hb-t' + (x.winner ? " win" : "") + '">' + (x.logo ? '<img src="' + esc(x.logo) + '" alt="" loading="lazy">' : "") + '<span>' + esc(x.name) + '</span>' + (g.state !== "pre" ? '<span class="sc">' + esc(x.score) + '</span>' : "") + '</div>'; }
      return '<div class="hb-game"><div class="hb-teams">' + t(g.away) + t(g.home) + '</div><div class="hb-st' + (g.state === "in" ? " live" : "") + '">' + esc(g.detail) + '</div></div>'; }).join("")) + '</div>';
    return h;
  }

  // ---------- Weather ----------
  function geocode(name) {
    return getJSON("https://geocoding-api.open-meteo.com/v1/search?count=1&name=" + encodeURIComponent(name)).then(function (g) {
      var r = g.results && g.results[0]; if (!r) throw new Error("City not found"); return { name: r.name + (r.admin1 ? ", " + r.admin1 : "") + (r.country_code ? " (" + r.country_code + ")" : ""), lat: r.latitude, lon: r.longitude };
    });
  }
  function forecast(c) {
    return getJSON("https://api.open-meteo.com/v1/forecast?latitude=" + c.lat + "&longitude=" + c.lon + "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=7&timezone=auto");
  }
  function daysHtml(d) {
    return '<div class="hb-days">' + d.time.map(function (t, i) {
      var w = WC[d.weather_code[i]] || ["", "\uD83C\uDF21\uFE0F"], dt = new Date(t + "T12:00:00");
      return '<div class="hb-day"><b>' + (i === 0 ? "Today" : dt.toLocaleDateString(undefined, { weekday: "short" })) + '</b><div class="hb-ico" style="font-size:24px">' + w[1] + '</div>' + Math.round(d.temperature_2m_max[i]) + '\u00B0 / ' + Math.round(d.temperature_2m_min[i]) + '\u00B0<div class="hb-muted">' + (d.precipitation_probability_max[i] != null ? d.precipitation_probability_max[i] + "% rain" : "") + '</div></div>';
    }).join("") + '</div>';
  }
  function nowHtml(f) {
    var c = f.current, w = WC[c.weather_code] || ["Conditions", "\uD83C\uDF21\uFE0F"];
    return '<div class="hb-now"><div class="hb-ico">' + w[1] + '</div><div class="hb-big">' + Math.round(c.temperature_2m) + '\u00B0F</div><div><div>' + w[0] + '</div><div class="hb-muted">Feels ' + Math.round(c.apparent_temperature) + '\u00B0 \u00B7 Humidity ' + c.relative_humidity_2m + '% \u00B7 Wind ' + Math.round(c.wind_speed_10m) + ' mph</div></div></div>';
  }
  function loadWeather(city) {
    var w = S.wx = S.wx || {};
    return store.getPref("cities").then(function (saved) {
      w.saved = saved;
      var c = city || w.city || saved[0] || { name: "Los Angeles, California (US)", lat: 34.05, lon: -118.24 };
      w.city = c; return forecast(c);
    }).then(function (f) { w.f = f; w.err = ""; }).catch(function (e) { w.err = e.message || "Weather unavailable"; });
  }
  function viewWeather() {
    var w = S.wx || {};
    var h = '<div class="hb-card"><div class="hb-row"><input class="hb-input hb-grow" id="hbCity" placeholder="Search a city\u2026"><button class="hb-btn primary" data-act="wx-go">Search</button></div><div class="hb-err" id="hbErr">' + esc(w.err || "") + '</div>' +
      ((w.saved || []).length ? '<div class="hb-row" style="margin-top:10px">' + w.saved.map(function (c, i) { return '<button class="hb-chip" data-act="wx-pick" data-i="' + i + '">' + esc(c.name.split(",")[0]) + '</button>'; }).join("") + '</div>' : "") + '</div>';
    if (w.f) h += '<div class="hb-card"><div class="hb-row"><h3 class="hb-h hb-grow" style="margin:0">' + esc(w.city.name) + '</h3><button class="hb-btn" data-act="wx-save">Save city</button></div><div style="margin:14px 0">' + nowHtml(w.f) + '</div>' + daysHtml(w.f.daily) + '</div>';
    else if (!w.err) h += '<div class="hb-muted">Loading weather\u2026</div>';
    return h;
  }

  // ---------- Travel ----------
  function loadTravel(city) {
    var t = S.tr = S.tr || {};
    return store.getPref("destinations").then(function (saved) {
      t.saved = saved; if (!city && !t.city) { t.f = null; return; }
      var c = city || t.city; t.city = c;
      return Promise.all([forecast(c), getJSON(LIVE + "?action=places&q=" + encodeURIComponent("things to do " + c.name.split(",")[0]) + "&lat=" + c.lat + "&lon=" + c.lon).catch(function () { return { places: [] }; })])
        .then(function (r) { t.f = r[0]; t.places = r[1].places || []; t.err = ""; });
    }).catch(function (e) { t.err = e.message || "Travel data unavailable"; });
  }
  function viewTravel() {
    var t = S.tr || {};
    var h = '<div class="hb-card"><div class="hb-row"><input class="hb-input hb-grow" id="hbDest" placeholder="Where to? e.g. Lisbon"><button class="hb-btn primary" data-act="tr-go">Plan</button></div><div class="hb-err" id="hbErr">' + esc(t.err || "") + '</div>' +
      ((t.saved || []).length ? '<div class="hb-row" style="margin-top:10px">' + t.saved.map(function (c, i) { return '<button class="hb-chip" data-act="tr-pick" data-i="' + i + '">' + esc(c.name.split(",")[0]) + '</button>'; }).join("") + '</div>' : "") + '</div>';
    if (t.f && t.city) {
      var n = t.city.name.split(",")[0], e = encodeURIComponent(n);
      h += '<div class="hb-card"><div class="hb-row"><h3 class="hb-h hb-grow" style="margin:0">' + esc(t.city.name) + '</h3><button class="hb-btn" data-act="tr-save">Save destination</button></div><div style="margin:14px 0">' + nowHtml(t.f) + '</div>' + daysHtml(t.f.daily) + '</div>';
      h += '<div class="hb-card"><h3 class="hb-h">Book &amp; explore</h3><div class="hb-links">' +
        [["Flights", "https://www.google.com/travel/flights?q=" + encodeURIComponent("Flights to " + n)], ["Hotels", "https://www.google.com/travel/hotels/" + e], ["Kayak", "https://www.kayak.com/explore/" + e], ["Things to do", "https://www.tripadvisor.com/Search?q=" + e], ["Map", "https://www.google.com/maps/search/?api=1&query=" + e]]
          .map(function (l) { return '<a class="hb-link" target="_blank" rel="noopener noreferrer" href="' + l[1] + '">' + l[0] + '</a>'; }).join("") + '</div></div>';
      if ((t.places || []).length) h += '<div class="hb-card"><h3 class="hb-h">Things to do nearby</h3>' + t.places.map(function (p) {
        return '<div class="hb-game"><div class="hb-teams"><b>' + esc(p.name) + '</b><span class="hb-muted">' + esc(p.address) + '</span></div><a class="hb-link" target="_blank" rel="noopener noreferrer" href="' + esc(p.maps_url) + '">Map</a></div>'; }).join("") + '</div>';
    } else if (!t.err) h += '<div class="hb-muted">Pick a destination to see the forecast, nearby places, and booking links.</div>';
    return h;
  }

  // ---------- shell ----------
  function render() {
    if (!root) return;
    root.querySelector(".hb-tabs").innerHTML = TABS.map(function (t) { return '<button class="hb-tab' + (S.tab === t[0] ? " active" : "") + '" data-act="tab" data-v="' + t[0] + '">' + t[1] + '</button>'; }).join("");
    var keep = { sym: (root.querySelector("#hbSym") || {}).value, city: (root.querySelector("#hbCity") || {}).value, dest: (root.querySelector("#hbDest") || {}).value };
    var v = { finance: viewFinance, sports: viewSports, weather: viewWeather, travel: viewTravel }[S.tab];
    root.querySelector(".hb-body").innerHTML = '<div class="hb-wrap">' + v() + '</div>';
    ["Sym", "City", "Dest"].forEach(function (k) { var i = root.querySelector("#hb" + k); if (i && keep[k.toLowerCase()]) i.value = keep[k.toLowerCase()]; });
  }
  function load(tab) {
    var p = tab === "finance" ? loadFinance() : tab === "sports" ? loadSports() : tab === "weather" ? loadWeather() : loadTravel();
    return p.catch(function () {}).then(render);
  }
  function setTab(tab) {
    S.tab = tab; render(); load(tab);
    clearInterval(timer);
    var ms = tab === "sports" ? 30000 : tab === "finance" ? 60000 : 0;
    if (ms) timer = setInterval(function () { if (S && S.tab === tab && (tab !== "sports" || S.sp.off === 0)) load(tab); }, ms);
  }
  function err(m) { var e = root && root.querySelector("#hbErr"); if (e) e.textContent = m || ""; }
  function onClick(e) {
    var b = e.target.closest("[data-act]"); if (!b || !root.contains(b)) return;
    var a = b.getAttribute("data-act"), v = b.getAttribute("data-v");
    if (a === "tab") return setTab(v);
    if (a === "close") return close();
    if (a === "wl-add") {
      var sym = (root.querySelector("#hbSym").value || "").trim().toUpperCase();
      if (!/^[A-Z0-9.\-^=]{1,12}$/.test(sym)) return err("Enter a valid ticker.");
      if (S.fin.list.indexOf(sym) >= 0) return err("Already on your watchlist.");
      getJSON(LIVE + "?action=quotes&symbols=" + encodeURIComponent(sym)).then(function (r) {
        if (!(r.quotes || []).length) throw new Error("Ticker not found.");
        return store.addSymbol(sym, S.fin.list.length);
      }).then(function () { return load("finance"); }).catch(function (x) { err(x.message); });
    } else if (a === "wl-del") store.delSymbol(b.getAttribute("data-sym")).then(function () { return load("finance"); }).catch(function (x) { err(x.message); });
    else if (a === "league") { S.sp.league = v; lsSet("hb_league", v); S.sp.games = null; render(); load("sports"); }
    else if (a === "day") { S.sp.off = v === "0" ? 0 : S.sp.off + parseInt(v, 10); S.sp.games = null; render(); load("sports"); }
    else if (a === "wx-go" || a === "tr-go") {
      var inp = root.querySelector(a === "wx-go" ? "#hbCity" : "#hbDest"), q = (inp.value || "").trim(); if (!q) return;
      geocode(q).then(function (c) { return a === "wx-go" ? loadWeather(c) : loadTravel(c); }).then(render).catch(function (x) { err(x.message); });
    }
    else if (a === "wx-pick") { loadWeather(S.wx.saved[+b.getAttribute("data-i")]).then(render); }
    else if (a === "tr-pick") { loadTravel(S.tr.saved[+b.getAttribute("data-i")]).then(render); }
    else if (a === "wx-save" || a === "tr-save") {
      var wx = a === "wx-save", st = wx ? S.wx : S.tr, key = wx ? "cities" : "destinations", list = (st.saved || []).filter(function (c) { return c.name !== st.city.name; });
      list.unshift(st.city); st.saved = list.slice(0, 10);
      store.setPref(key, st.saved).then(render);
    }
  }
  function onKey(e) {
    if (e.key === "Escape" && root) return close();
    if (e.key === "Enter" && root && e.target && e.target.id) {
      var m = { hbSym: "wl-add", hbCity: "wx-go", hbDest: "tr-go" }[e.target.id];
      if (m) { var btn = root.querySelector('[data-act="' + m + '"]'); if (btn) btn.click(); }
    }
  }
  function open(tab) {
    if (root) { setTab(tab || S.tab); return; }
    lastFocus = document.activeElement; ensureCss(); S = { tab: tab || "finance" };
    root = document.createElement("div"); root.className = "hb-root"; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "Live hubs");
    root.innerHTML = '<div class="hb-head"><h2 class="hb-title">Live</h2><div class="hb-tabs"></div><button class="hb-x" data-act="close" aria-label="Close">\u00D7</button></div><div class="hb-body"></div>';
    (document.getElementById("moduleRoot") || document.body).appendChild(root);
    root.addEventListener("click", onClick); document.addEventListener("keydown", onKey);
    setTab(S.tab);
    var x = root.querySelector(".hb-x"); if (x) x.focus();
  }
  function close() {
    if (!root) return; clearInterval(timer); timer = null; document.removeEventListener("keydown", onKey);
    root.remove(); root = null; S = null;
    if (lastFocus && lastFocus.focus && document.contains(lastFocus)) { try { lastFocus.focus(); } catch (e) {} }
  }
  window.LiveHubs = { open: open, close: close };
})();
