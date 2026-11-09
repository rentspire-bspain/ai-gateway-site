/* repo-pr.js — "Propose change -> review diff -> Approve -> PR" panel.
   The gateway only ever PREPARES a proposal (stored server-side, nothing sent to GitHub). This panel renders the
   diff with textContent only (no innerHTML for diff/data) and calls the repo-pr edge function:
     list -> show pending proposals;  approve {proposal_id, content_sha256} -> opens a PR (never merges);  reject.
   Usage: RepoPR.mount(containerEl, { getToken: async () => accessToken, url: ".../functions/v1/repo-pr" }); RepoPR.refresh(); */
(function (root) {
  "use strict";
  var cfg = null, host = null;
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  async function call(body) {
    var t = await cfg.getToken();
    var r = await fetch(cfg.url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + t }, body: JSON.stringify(body) });
    var d = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(d.error || ("HTTP " + r.status));
    return d;
  }
  function diffNode(diff) {
    var pre = el("pre", "rp-diff");
    String(diff || "").split("\n").forEach(function (line) {
      var s = el("span", "rp-l " + (line.indexOf("+++") === 0 || line.indexOf("---") === 0 ? "rp-file" : line[0] === "+" ? "rp-add" : line[0] === "-" ? "rp-del" : line[0] === "@" ? "rp-hunk" : ""), line + "\n");
      pre.appendChild(s);
    });
    return pre;
  }
  function card(p) {
    var c = el("div", "rp-card");
    c.appendChild(el("div", "rp-title", p.title));
    c.appendChild(el("div", "rp-meta", (p.files || []).length + " file(s) · " + p.status + " · proposal " + String(p.id).slice(0, 8)));
    if (p.body) c.appendChild(el("div", "rp-body", p.body));
    c.appendChild(diffNode(p.diff));
    var msg = el("div", "rp-msg");
    if (p.status === "pending") {
      var ok = el("button", "rp-btn rp-approve", "Approve and open PR"), no = el("button", "rp-btn", "Reject");
      ok.onclick = async function () {
        ok.disabled = no.disabled = true; msg.textContent = "Opening pull request…";
        try { var d = await call({ action: "approve", proposal_id: p.id, content_sha256: p.content_sha256 });
          msg.textContent = ""; var a = el("a", "rp-link", "Pull request #" + d.pr_number + " opened (not merged)"); a.href = d.pr_url; a.target = "_blank"; a.rel = "noopener noreferrer"; msg.appendChild(a);
        } catch (e) { msg.textContent = "Not approved: " + e.message; ok.disabled = no.disabled = false; }
      };
      no.onclick = async function () { try { await call({ action: "reject", proposal_id: p.id }); c.remove(); } catch (e) { msg.textContent = e.message; } };
      var row = el("div", "rp-actions"); row.appendChild(ok); row.appendChild(no); c.appendChild(row);
    } else if (p.pr_url) {
      var a2 = el("a", "rp-link", "Pull request #" + p.pr_number); a2.href = root.SafeUrl ? root.SafeUrl.http(p.pr_url) || "#" : "#"; a2.target = "_blank"; a2.rel = "noopener noreferrer"; msg.appendChild(a2);
    } else if (p.error) msg.textContent = p.error;
    c.appendChild(msg);
    return c;
  }
  async function refresh() {
    if (!host) return;
    host.textContent = "";
    try { var d = await call({ action: "list" }); (d.proposals || []).filter(function (p) { return p.status === "pending" || p.status === "pr_opened" || p.status === "failed"; }).slice(0, 5).forEach(function (p) { host.appendChild(card(p)); }); }
    catch (e) { host.appendChild(el("div", "rp-msg", "Proposals unavailable: " + e.message)); }
  }
  root.RepoPR = { mount: function (container, config) { host = container; cfg = config; host.classList.add("rp-host"); return refresh(); }, refresh: refresh, _diffNode: diffNode };
})(typeof window !== "undefined" ? window : globalThis);
