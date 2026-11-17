/* usage.js — Settings → Usage pane (section 34b: engagement/visibility parity).
   Perplexity shows usage, history and activity surfaces; this pane computes the
   signed-in user's gateway activity client-side from their own Supabase rows
   (RLS-scoped: threads + thread_messages, the same source the sidebar/Library
   sync from). REST via the user's session token — same pattern as fleet.js.

   Stats: total threads (exact count via PostgREST Prefer: count=exact), total
   assistant turns, threads per week (last 4 weekly buckets, from updated_at),
   average answer length (chars, most recent 400 assistant answers — bounded
   sample, labeled honestly). Top models: the model that served each answer is
   NOT stored server-side (thread_messages has thread_id/role/content/sources/
   related only), so the pane says "model data not recorded" rather than
   guessing. Pure aggregation functions are exported for node:test.

   Renders: compact 4-tile stat row + CSS bar chart (no chart library) + a
   recent-activity list (last 10 threads). */
(function (root) {
  "use strict";

  // ---------- pure helpers (unit-tested in usage.test.js) ----------
  var DAY = 86400000, WEEK = 7 * DAY;
  function ts(v) {
    if (v == null) return null;
    var n = typeof v === "number" ? v : Date.parse(String(v));
    return Number.isFinite(n) ? n : null;
  }
  function threadTs(t) {
    return ts(t && (t.updated_at || t.created_at || t.updatedAt || t.createdAt));
  }
  // weekBuckets(items, now, n) — n weekly buckets, OLDEST first, half-open
  // [now-(i+1)*WEEK, now-i*WEEK). Items need a parseable updated_at/created_at.
  // Items older than n weeks or without a timestamp are ignored.
  function weekBuckets(items, now, n) {
    n = n || 4;
    var out = [];
    for (var i = n; i >= 1; i--) out.push({ start: now - i * WEEK, end: now - (i - 1) * WEEK, count: 0 });
    (Array.isArray(items) ? items : []).forEach(function (t) {
      var v = threadTs(t);
      if (v == null) return;
      for (var j = 0; j < out.length; j++) if (v >= out[j].start && v < out[j].end) { out[j].count++; break; }
    });
    return out;
  }
  // topModels(msgs, n) — counts per message model badge (servedModel wins over
  // model). Returns top n [{model, count}], count desc then name asc. [] when
  // no message carries model metadata (the honest "not recorded" case).
  function topModels(msgs, n) {
    var counts = {};
    (Array.isArray(msgs) ? msgs : []).forEach(function (m) {
      var k = m && (m.servedModel || m.model);
      if (k) counts[String(k)] = (counts[String(k)] || 0) + 1;
    });
    return Object.keys(counts)
      .map(function (k) { return { model: k, count: counts[k] }; })
      .sort(function (a, b) { return (b.count - a.count) || a.model.localeCompare(b.model); })
      .slice(0, n || 5);
  }
  // avgLen(strs) — mean length in characters over non-empty strings.
  // Returns {avg: 0, n: 0} for an empty/blank set (never NaN).
  function avgLen(strs) {
    var sum = 0, n = 0;
    (Array.isArray(strs) ? strs : []).forEach(function (s) {
      var v = String(s == null ? "" : s);
      if (!v) return;
      sum += v.length; n++;
    });
    return n ? { avg: sum / n, n: n } : { avg: 0, n: 0 };
  }
  // recentItems(items, n) — newest-first by timestamp (entries without a
  // parseable timestamp sort last, keeping their relative order). Pure: copy.
  function recentItems(items, n) {
    var arr = (Array.isArray(items) ? items : []).slice();
    arr.sort(function (a, b) {
      var ta = threadTs(a), tb = threadTs(b);
      if (ta == null && tb == null) return 0;
      if (ta == null) return 1;
      if (tb == null) return -1;
      return tb - ta;
    });
    return arr.slice(0, n || 10);
  }
  // parseCount(contentRange) — total from a PostgREST Content-Range header
  // ("0-0/5647" -> 5647, "*/0" -> 0, "*/5647" -> 5647). null when unparseable.
  function parseCount(contentRange) {
    if (!contentRange) return null;
    var m = /\/(\d+)$/.exec(String(contentRange).trim());
    return m ? Number(m[1]) : null;
  }

  var api = { threadTs: threadTs, weekBuckets: weekBuckets, topModels: topModels, avgLen: avgLen, recentItems: recentItems, parseCount: parseCount };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  // ---------- browser wiring ----------
  var SB = "https://bnxermyboeigvwonfrzx.supabase.co";
  var LIMIT_THREADS = 1000;   // PostgREST max page; totals come from count=exact
  var SAMPLE_ANSWERS = 400;    // bounded sample for avg answer length

  function client() { return (typeof sb !== "undefined") ? sb : (root.sb || null); }
  function anonKey() {
    if (typeof SUPABASE_ANON !== "undefined" && SUPABASE_ANON) return SUPABASE_ANON;
    var c = client();
    return (c && c.supabaseKey) || "";
  }
  // session token via sb.auth.getSession(), falling back to the localStorage
  // auth-token scan (same fallback library.js uses).
  function auth() {
    var c = client();
    var p = (c && c.auth && typeof c.auth.getSession === "function")
      ? Promise.resolve(c.auth.getSession()).catch(function () { return null; })
      : Promise.resolve(null);
    return p.then(function (r) {
      var sess = r && r.data && r.data.session;
      var token = sess && sess.access_token;
      var userId = (sess && sess.user && sess.user.id) || "";
      if (!token) {
        try {
          var LS = root.localStorage;
          for (var i = 0; i < LS.length; i++) {
            var k = LS.key(i);
            if (k && /^sb-.*-auth-token$/.test(k)) {
              var parsed = JSON.parse(LS.getItem(k) || "null");
              if (parsed && parsed.access_token) {
                token = parsed.access_token;
                if (!userId && parsed.user && parsed.user.id) userId = parsed.user.id;
                break;
              }
            }
          }
        } catch (e) {}
      }
      return { token: token || "", userId: userId || "" };
    });
  }
  function restGet(path) {
    return auth().then(function (a) {
      if (!a.token) { var e = new Error("Sign in to view your usage."); e.code = "UNAUTHENTICATED"; throw e; }
      var h = { Authorization: "Bearer " + a.token };
      var ak = anonKey(); if (ak) h.apikey = ak;
      h.Prefer = "count=exact";
      return fetch(SB + "/rest/v1/" + path, { headers: h }).then(function (res) {
        if (res.status === 404) throw new Error("Thread storage is not set up yet.");
        return res.json().then(function (j) {
          if (!res.ok || !Array.isArray(j)) throw new Error((j && j.message) || "Request failed (" + res.status + ")");
          return { rows: j, total: parseCount(res.headers.get("content-range")) };
        });
      });
    });
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "\u0026amp;").replace(/</g, "\u0026lt;").replace(/>/g, "\u0026gt;")
      .replace(/"/g, "\u0026quot;").replace(/'/g, "\u0026#39;");
  }
  function fmtInt(n) { return (n == null) ? "—" : Number(n).toLocaleString(); }
  function fmtDate(ms) {
    return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }
  function fmtRange(start, end) { // "Oct 31–Nov 6"
    var a = new Date(start), b = new Date(end - DAY < start ? end : end - DAY);
    var sa = a.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    var sb = b.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return sa + "–" + sb;
  }

  // ---------- pane ----------
  function render() {
    var pane = document.createElement("div");
    pane.className = "stg-pane";
    pane.innerHTML =
      '<h3 class="stg-pane-title">Usage</h3>' +
      '<p class="stg-pane-sub">Your gateway activity, from your synced threads.</p>' +
      '<div class="stg-stats" id="usgStats"></div>' +
      '<div id="usgChart" style="margin-top:20px"></div>' +
      '<div id="usgModels" style="margin-top:20px"></div>' +
      '<div id="usgRecent" style="margin-top:20px"></div>';
    var stats = pane.querySelector("#usgStats");
    var chart = pane.querySelector("#usgChart");
    var models = pane.querySelector("#usgModels");
    var recent = pane.querySelector("#usgRecent");

    function tile(num, lbl, title) {
      return '<div class="stg-stat"' + (title ? ' title="' + esc(title) + '"' : "") + '>' +
        '<div class="stg-stat-num">' + esc(num) + '</div>' +
        '<div class="stg-stat-lbl">' + esc(lbl) + '</div></div>';
    }
    function loading() {
      stats.innerHTML = tile("…", "Loading your usage");
    }
    loading();

    function drawError(msg) {
      stats.innerHTML = "";
      var box = document.createElement("div");
      box.className = "stg-info";
      box.innerHTML = '<p>' + esc(msg) + ' <button type="button" class="stg-btn ghost">Retry</button></p>';
      box.querySelector("button").onclick = function () { loading(); load(); };
      stats.appendChild(box);
    }

    function draw(threads, weeks, turns, answers, total) {
      // 4 compact tiles
      stats.innerHTML =
        tile(fmtInt(total != null ? total : threads.length), "Total threads",
          total == null && threads.length >= LIMIT_THREADS ? "First " + LIMIT_THREADS + " threads (exact count unavailable)" : "All-time, from your synced threads") +
        tile(fmtInt(turns != null ? turns : null), "Assistant turns",
          "Answers you've received, all-time") +
        tile(fmtInt(weeks.reduce(function (s, b) { return s + b.count; }, 0)), "Threads · 4 weeks",
          "Threads updated in the last 4 weeks") +
        tile(answers.n ? Math.round(answers.avg).toLocaleString() + " chars" : "—", "Avg answer length",
          "Mean length of your " + answers.n + " most recent answers");

      // weekly bar chart — pure CSS bars, no chart library
      var max = Math.max.apply(null, weeks.map(function (b) { return b.count; }).concat([1]));
      var bars = weeks.map(function (b) {
        var h = Math.max(3, Math.round((b.count / max) * 100));
        return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0">' +
          '<div style="font-size:12px;font-variant-numeric:tabular-nums;font-weight:600">' + b.count + '</div>' +
          '<div style="width:100%;max-width:64px;height:96px;display:flex;align-items:flex-end;justify-content:center">' +
          '<div style="width:100%;height:' + h + '%;min-height:3px;background:var(--accent);border-radius:4px 4px 2px 2px;opacity:.85" title="' + esc(fmtRange(b.start, b.end)) + ': ' + b.count + ' threads"></div></div>' +
          '<div style="font-size:11px;color:var(--text-muted);white-space:nowrap">' + esc(fmtRange(b.start, b.end)) + '</div></div>';
      }).join("");
      chart.innerHTML = '<h3 style="margin:0 0 4px;font-size:14px">Weekly activity</h3>' +
        '<p class="stg-pane-sub" style="margin:0 0 10px">Threads per week, last 4 weeks.</p>' +
        '<div style="display:flex;gap:10px;align-items:flex-end">' + bars + '</div>';

      // top models — only if the data exists server-side; honest otherwise
      var top = topModels((threads[0] && threads[0].messages) || [], 5); // messages never carry model fields over REST
      models.innerHTML = '<h3 style="margin:0 0 4px;font-size:14px">Top models</h3>';
      if (top.length) {
        models.innerHTML += top.map(function (m) {
          return '<div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid var(--border);font-size:13px"><span>' + esc(m.model) + '</span><span class="muted">' + m.count + '</span></div>';
        }).join("");
      } else {
        models.innerHTML += '<p class="stg-empty-note" style="margin:4px 0 0">Model data not recorded — the gateway does not store which model served each answer.</p>';
      }

      // recent activity — last 10 threads with dates
      var rec = recentItems(threads, 10);
      recent.innerHTML = '<h3 style="margin:0 0 4px;font-size:14px">Recent activity</h3>' +
        '<p class="stg-pane-sub" style="margin:0 0 6px">Last ' + rec.length + ' threads.</p>';
      if (!rec.length) {
        recent.innerHTML += '<p class="stg-empty-note" style="margin:4px 0 0">No threads yet.</p>';
      } else {
        rec.forEach(function (t) {
          var v = threadTs(t);
          var row = document.createElement("div");
          row.style.cssText = "display:flex;justify-content:space-between;gap:12px;align-items:baseline;padding:7px 0;border-top:1px solid var(--border);font-size:13px;cursor:pointer";
          row.innerHTML = '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(t.title || "Untitled") + '</span>' +
            '<span style="color:var(--text-muted);white-space:nowrap;font-variant-numeric:tabular-nums">' + (v ? esc(fmtDate(v)) : "—") + '</span>';
          row.title = "Open thread";
          row.onclick = function () {
            if (root.SettingsUI && typeof root.SettingsUI.close === "function") root.SettingsUI.close();
            var lt = root.loadThread;
            if (typeof lt === "function") { try { lt(t.id); } catch (e) {} }
          };
          recent.appendChild(row);
        });
      }
    }

    function load() {
      var since = new Date(Date.now() - 4 * WEEK).toISOString();
      Promise.all([
        restGet("threads?select=id,title,slug,updated_at&order=updated_at.desc&limit=" + LIMIT_THREADS),
        restGet("threads?select=id&updated_at=gte." + encodeURIComponent(since) + "&order=updated_at.desc&limit=" + LIMIT_THREADS),
        restGet("thread_messages?select=thread_id&role=eq.assistant&limit=1"),
        restGet("thread_messages?select=content&role=eq.assistant&order=created_at.desc&limit=" + SAMPLE_ANSWERS)
      ]).then(function (r) {
        var threads = r[0].rows;
        var weeks = weekBuckets(r[1].rows, Date.now(), 4);
        var turns = r[2].total != null ? r[2].total : null;
        var answers = avgLen(r[3].rows.map(function (m) { return m && m.content; }));
        draw(threads, weeks, turns, answers, r[0].total);
      }).catch(function (e) {
        drawError(e && e.message ? e.message : "Could not load usage.");
      });
    }
    load();
    return pane;
  }

  root.UsagePane = { render: render };
})(typeof window !== "undefined" ? window : globalThis);
