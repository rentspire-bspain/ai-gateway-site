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
  var PROXY = "https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/live-data?action=quotes&symbols=";
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


  // ---------- Wave 3: sports / places / shopping / travel ----------
  var LIVE = "https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/live-data";
  var TEAMS = {
    nba: "hawks celtics nets hornets bulls cavaliers cavs mavericks mavs nuggets pistons warriors rockets pacers clippers lakers grizzlies heat bucks timberwolves wolves pelicans knicks thunder magic 76ers sixers suns blazers kings spurs raptors jazz wizards",
    nfl: "cardinals falcons ravens bills panthers bears bengals browns cowboys broncos lions packers texans colts jaguars jags chiefs raiders chargers rams dolphins vikings patriots saints giants jets eagles steelers 49ers niners seahawks buccaneers bucs titans commanders",
    mlb: "diamondbacks braves orioles red sox cubs white sox reds guardians rockies tigers astros royals angels dodgers marlins brewers twins mets yankees athletics phillies pirates padres mariners cardinals rays rangers blue jays nationals",
    nhl: "bruins sabres flames hurricanes blackhawks avalanche blue jackets stars red wings oilers panthers kings wild canadiens predators devils islanders rangers senators flyers penguins sharks kraken blues lightning maple leafs canucks golden knights capitals jets utah"
  };
  var LEAGUE_KW = [[/\bwnba\b/i, "wnba"], [/\bnba\b|basketball/i, "nba"], [/college football|\bncaaf\b/i, "ncaaf"], [/\bnfl\b|\bfootball\b/i, "nfl"], [/\bmlb\b|baseball/i, "mlb"],
    [/\bnhl\b|hockey/i, "nhl"], [/premier league|\bepl\b/i, "epl"], [/\bmls\b/i, "mls"], [/champions league|\bucl\b/i, "ucl"], [/la ?liga/i, "laliga"]];
  var LEAGUE_NAME = { nba: "NBA", wnba: "WNBA", nfl: "NFL", mlb: "MLB", nhl: "NHL", ncaaf: "College Football", ncaam: "College Basketball", epl: "Premier League", mls: "MLS", ucl: "Champions League", laliga: "La Liga" };
  function sportsIntent(q) {
    if (!q) return null;
    var lg = null, team = null, i;
    for (i = 0; i < LEAGUE_KW.length; i++) if (LEAGUE_KW[i][0].test(q)) { lg = LEAGUE_KW[i][1]; break; }
    var ql = q.toLowerCase();
    Object.keys(TEAMS).forEach(function (k) {
      TEAMS[k].split(" ").concat(k === "nba" ? ["trail blazers"] : []).forEach(function (t) {
        if (!team && t.length > 3 && new RegExp("\\b" + t + "\\b").test(ql)) { team = t; if (!lg) lg = k; }
      });
    });
    if (!lg || !(/\b(scores?|games?|playing|plays|tonight|today|schedule|standings|vs\.?|versus|result|results|won|win|live)\b/i.test(q) || team)) return null;
    return { league: lg, team: team };
  }
  function getGames(lg) {
    return cached("s:" + lg, function () {
      return tfetch(LIVE + "?action=sports&league=" + lg).then(function (t) { var g = (JSON.parse(t) || {}).games; if (!g || !g.length) throw new Error("ng"); return g; });
    });
  }
  function gameRow(g) {
    var r = el("div", "ec-game"), live = g.state === "in";
    function side(x, cls) { var d = el("div", "ec-team " + cls + (x.winner ? " ec-win" : "")); d.appendChild(el("span", "ec-tn", x.abbr || x.name)); if (g.state !== "pre") d.appendChild(el("span", "ec-ts", String(x.score))); return d; }
    r.appendChild(side(g.away, "ec-away")); r.appendChild(side(g.home, "ec-home"));
    r.appendChild(el("span", "ec-gs" + (live ? " ec-gs-live" : ""), g.detail || (g.completed ? "Final" : "")));
    return r;
  }
  function sportsCard(d) {
    var c = el("div", "ec-card ec-sports ec-col"), top = el("div", "ec-top");
    top.appendChild(el("span", "ec-sym", LEAGUE_NAME[d.league] || d.league.toUpperCase())); top.appendChild(liveChip()); c.appendChild(top);
    d.games.forEach(function (g) { c.appendChild(gameRow(g)); });
    return c;
  }
  function getSports(it) {
    return getGames(it.league).then(function (all) {
      var g = all;
      if (it.team) { var m = all.filter(function (x) { return (x.home.name + " " + x.away.name).toLowerCase().indexOf(it.team) >= 0; }); if (m.length) g = m; else throw new Error("nt"); }
      else g = all.slice().sort(function (a, b) { return (b.state === "in") - (a.state === "in"); });
      return sportsCard({ league: it.league, games: g.slice(0, 3) });
    });
  }

  var PLACE_RE = /\b(restaurants?|cafes?|coffee( shops?)?|bars?|pubs?|pizza|sushi|tacos?|bakery|hotels?|hostels?|gas stations?|pharmac(y|ies)|gyms?|museums?|parks?|beaches|libraries|supermarkets?|grocery|where (is|can)|directions? to|map of)\b/i;
  function placesIntent(q) {
    if (!q || !PLACE_RE.test(q) || /weather|temperature|forecast|flights?/i.test(q)) return null;
    if (!/\b(in|near|around|at|by|of|to)\s+[A-Za-z]/i.test(q) && !/^\s*(where|map)/i.test(q)) return null;
    var s = q.replace(/[?!.]+$/, "").replace(/\b(what|which|where|are|is|the|best|top|good|great|find|me|can|i|you|recommend|some|any|get|to|go|eat|a|an|please|show)\b/gi, " ").replace(/\s+/g, " ").trim();
    return s.length > 2 ? { q: s.slice(0, 100) } : null;
  }
  function getPlaces(it) {
    return cached("p:" + it.q.toLowerCase(), function () {
      return tfetch(LIVE + "?action=places&q=" + encodeURIComponent(it.q)).then(function (t) { var p = (JSON.parse(t) || {}).places; if (!p || !p.length) throw new Error("np"); return p; });
    }).then(function (p) {
      var c = el("div", "ec-card ec-places ec-col"), top = el("div", "ec-top");
      top.appendChild(el("span", "ec-sym", "Places")); top.appendChild(liveChip()); c.appendChild(top);
      p.slice(0, 4).forEach(function (x) {
        var r = el("div", "ec-place"), m = el("div", "ec-main");
        m.appendChild(el("div", "ec-pn", x.name)); if (x.address) m.appendChild(el("div", "ec-sub", x.address));
        r.appendChild(m); r.appendChild(link("Map", x.maps_url)); r.appendChild(link("OSM", x.osm_url)); c.appendChild(r);
      });
      return c;
    });
  }

  function link(label, href) { var a = el("a", "ec-link", label); a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer"; return a; }
  function linkCard(title, sub, links) {
    var c = el("div", "ec-card ec-col"), top = el("div", "ec-top");
    top.appendChild(el("span", "ec-sym", title)); c.appendChild(top);
    if (sub) c.appendChild(el("div", "ec-sub", sub));
    var row = el("div", "ec-links"); links.forEach(function (l) { row.appendChild(link(l[0], l[1])); }); c.appendChild(row); return c;
  }
  function shoppingIntent(q) {
    if (!q || !/\b(buy|purchase|cheapest|deals?|where to (buy|get)|shop(ping)? for|price of|how much (is|does|are)|best .{2,40} under \$?\d+|on sale)\b/i.test(q)) return null;
    var s = q.replace(/[?!.]+$/, "").replace(/\b(where|to|buy|get|the|a|an|cheapest|best|price of|how much (is|does|are)|do|does|i|can|find|me|for|deals?|on|sale|shop(ping)?)\b/gi, " ").replace(/\s+/g, " ").trim();
    return s.length > 2 ? { q: s.slice(0, 80) } : null;
  }
  function shoppingCard(it) {
    var e = encodeURIComponent(it.q);
    return linkCard("Shop: " + it.q, "Compare prices across stores", [["Google Shopping", "https://www.google.com/search?tbm=shop&q=" + e], ["Amazon", "https://www.amazon.com/s?k=" + e],
      ["eBay", "https://www.ebay.com/sch/i.html?_nkw=" + e], ["Walmart", "https://www.walmart.com/search?q=" + e]]);
  }
  function travelIntent(q) {
    if (!q || !/\b(flights?|flying|hotels?|trip|travel|vacation|holiday|visit|itinerary|getaway)\b/i.test(q)) return null;
    var m = /\b(?:to|in|visit|visiting|for)\s+([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,2})/.exec(q);
    return m ? { city: m[1].trim() } : null;
  }
  function travelCard(it) {
    return getWeather(it.city).then(function (w) {
      var e = encodeURIComponent(it.city), wc = WC[w.code] || ["", "\uD83C\uDF21\uFE0F"];
      var c = linkCard("Trip: " + w.name, "Right now: " + Math.round(w.temp) + "\u00B0F, " + wc[0].toLowerCase() + ", wind " + Math.round(w.wind) + " mph",
        [["Flights", "https://www.google.com/travel/flights?q=" + encodeURIComponent("Flights to " + it.city)], ["Hotels", "https://www.google.com/travel/hotels/" + e],
         ["Kayak", "https://www.kayak.com/explore/" + e], ["Things to do", "https://www.tripadvisor.com/Search?q=" + e]]);
      c.querySelector(".ec-top").appendChild(liveChip()); return c;
    });
  }

  function process(content, question) {
    if (!content || content.getAttribute("data-ec")) return;
    content.setAttribute("data-ec", "1");
    var text = content.textContent || "", jobs = [];
    var q = question != null ? question : hint, travel = travelIntent(q), sp = sportsIntent(q), pl = placesIntent(q), sh = shoppingIntent(q);
    var city = travel ? null : cityFromHint(q);
    if (city) jobs.push(getWeather(city).then(weatherCard));
    if (travel) jobs.push(travelCard(travel));
    if (sp) jobs.push(getSports(sp));
    if (pl && !travel) jobs.push(getPlaces(pl));
    if (sh && !travel) jobs.push(Promise.resolve(shoppingCard(sh)));
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
  window.EntityCards = { attach: attach, questionHint: function (q) { hint = String(q || ""); }, process: process, _detect: detectTickers, _intents: function (q) { return { sports: sportsIntent(q), places: placesIntent(q), shopping: shoppingIntent(q), travel: travelIntent(q), city: cityFromHint(q) }; }, _getWeather: getWeather, _tfetch: tfetch, LIVE: LIVE, _city: cityFromHint };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", attach); else attach();
})();
