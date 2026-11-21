const test = require("node:test");
const assert = require("node:assert");
// Evaluate the module with a stub `root` so the exported pure helpers are captured
// without needing a DOM. The module registers onto root.TeammatesPane.
const src = require("fs").readFileSync(__dirname + "/teammates.js", "utf8");
new Function("localStorage", src)({ getItem: () => "{}" });
const h = globalThis.TeammatesPane;

test("memberRow normalizes a full member", () => {
  const m = h.memberRow({ email: "a@b.co", role: "admin", last_seen: "2026-11-10T00:00:00Z" });
  assert.equal(m.email, "a@b.co");
  assert.equal(m.role, "admin");
  assert.equal(m.name, "a"); // email local-part fallback
  assert.equal(m.lastActive, "2026-11-10T00:00:00Z");
  assert.equal(m.invited, false);
});

test("memberRow: invited status flagged, defaults honest", () => {
  const m = h.memberRow({ email: "x@y.io", status: "invited" });
  assert.equal(m.invited, true);
  assert.equal(m.role, "member"); // default, never invented
  assert.equal(h.memberRow(null), null);
});

test("sortMembers sorts by email and drops junk", () => {
  const rows = h.sortMembers([{ email: "b@b.co" }, null, { email: "a@b.co" }, "junk"]);
  assert.deepEqual(rows.map(r => r.email), ["a@b.co", "b@b.co"]);
});

test("fmtLastActive: date, unparseable, and empty", () => {
  assert.match(h.fmtLastActive("2026-11-10T00:00:00Z"), /\d/);
  assert.equal(h.fmtLastActive("not-a-date"), "—");
  assert.equal(h.fmtLastActive(null), "—");
});
test("Settings roster searches locally and only owners can change a teammate's role", async () => {
  const vm = require("node:vm");
  const settings = require("node:fs").readFileSync(__dirname + "/settings-premium.js", "utf8");
  function element(tag) {
    return {
      tag, children: [], attrs: {}, events: {}, value: "",
      set innerHTML(value) { this.children = []; },
      appendChild(node) { this.children.push(node); },
      setAttribute(key, value) { this.attrs[key] = value; },
      addEventListener(key, value) { this.events[key] = value; }
    };
  }
  const all = (node) => [node, ...node.children.flatMap(all)];
  for (const role of ["owner", "admin", "member"]) {
    const calls = [], opened = [];
    const window = { SettingsUI: { open: (pane) => opened.push(pane) }, TeammatesPane: h, sb: { auth: { getSession: async () => ({
      data: { session: { access_token: "current-token" } }
    }) } } };
    vm.runInNewContext(settings, {
      window, document: { createElement: element, getElementById: () => null },
      fetch: async (_url, options) => {
        const body = JSON.parse(options.body);
        calls.push(body);
        return { ok: true, json: async () => body.action === "whoami" ? { role } : {
          members: [
            { full_name: "Ada Example", email: "ada@example.com", role: "member", created_at: "2026-01-12" },
            { email: "pending@example.com", role: "member", status: "invited" }
          ]
        } };
      }
    });
    const pane = window.SettingsTeammatesPane.render();
    await new Promise(setImmediate);
    const nodes = all(pane);
    assert.ok(nodes.some((n) => n.textContent === "Ada Example"));
    assert.ok(nodes.some((n) => /^Added: \d.+Last active:/.test(n.textContent)));
    assert.equal(nodes.find((n) => n.textContent === "Invite a teammate").hidden, role === "member");
    nodes.find((n) => n.textContent === "Edit my account profile").events.click();
    if (role !== "member") nodes.find((n) => n.textContent === "Open Team invitations").events.click();
    assert.deepEqual(opened, role === "member" ? ["account"] : ["account", "team"]);
    const status = nodes.find((n) => n.attrs["aria-label"] === "Teammate invitation status");
    status.value = "invited";
    status.events.change();
    assert.ok(all(pane).some((n) => n.textContent === "pending@example.com (invited)"));
    assert.ok(!all(pane).some((n) => n.textContent === "Ada Example"));
    status.value = "all";
    const select = nodes.find((n) => n.attrs["aria-label"] === "Role for ada@example.com");
    assert.equal(Boolean(select), role === "owner");
    const search = nodes.find((n) => n.type === "search");
    search.value = "missing";
    search.events.input();
    assert.ok(all(pane).some((n) => n.textContent === "No teammates match your search."));
    assert.equal(calls.length, 2);
    if (select) {
      search.value = "";
      search.events.input();
      const current = all(pane).find((n) => n.attrs["aria-label"] === "Role for ada@example.com");
      current.value = "admin";
      current.events.change();
      await new Promise(setImmediate);
      assert.deepEqual(calls.at(-1), { action: "set_role", email: "ada@example.com", role: "admin" });
    }
  }
});
