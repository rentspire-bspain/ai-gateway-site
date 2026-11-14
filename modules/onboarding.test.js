// Unit tests for Getting-started polish (34e) in modules/onboarding.js.
// Run: node --test modules/onboarding.test.js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC = fs.readFileSync(path.join(__dirname, "onboarding.js"), "utf8");

function makeEnv(opts = {}) {
  const store = new Map(Object.entries(opts.initialStorage || {}));
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    get length() { return store.size; },
    key: (i) => Array.from(store.keys())[i] || null
  };

  const docListeners = {};
  const winListeners = {};
  const byId = {};

  const makeEl = (tag) => {
    const elListeners = {};
    const classSet = new Set();
    const el = {
      tagName: String(tag || "div").toUpperCase(),
      id: "",
      type: "",
      href: "",
      title: "",
      value: "",
      hidden: false,
      innerHTML: "",
      textContent: "",
      style: {},
      attributes: {},
      children: [],
      parentNode: null,
      focused: false,
      get className() {
        return Array.from(classSet).join(" ");
      },
      set className(v) {
        classSet.clear();
        String(v || "").split(/\s+/).filter(Boolean).forEach((c) => classSet.add(c));
      },
      classList: {
        add(c) { classSet.add(c); },
        remove(c) { classSet.delete(c); },
        toggle(c, on) {
          if (on === undefined) on = !classSet.has(c);
          if (on) classSet.add(c); else classSet.delete(c);
        },
        contains(c) { return classSet.has(c); }
      },
      setAttribute(k, v) {
        this.attributes[k] = String(v);
        if (k === "id") {
          this.id = String(v);
          byId[this.id] = this;
        }
      },
      getAttribute(k) {
        return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null;
      },
      appendChild(ch) {
        ch.parentNode = this;
        if (ch.id) byId[ch.id] = ch;
        this.children.push(ch);
        return ch;
      },
      focus() { this.focused = true; },
      click() { this.dispatch("click", { target: this, preventDefault() {} }); },
      addEventListener(ev, fn) {
        (elListeners[ev] = elListeners[ev] || []).push(fn);
      },
      dispatch(ev, payload = {}) {
        const evt = Object.assign({ target: this, preventDefault() {}, stopPropagation() {} }, payload);
        (elListeners[ev] || []).forEach((fn) => fn(evt));
        return evt;
      },
      querySelector() { return makeEl("button"); }
    };
    return el;
  };

  const body = makeEl("body");
  const landing = makeEl("div");
  landing.id = "landing";
  if (opts.landingDisplay) landing.style.display = opts.landingDisplay;
  byId.landing = landing;

  const landingInput = makeEl("textarea");
  landingInput.id = "landingInput";
  landingInput.value = opts.composerValue || "";
  byId.landingInput = landingInput;

  const landingSubmit = makeEl("button");
  landingSubmit.id = "landingSubmit";
  byId.landingSubmit = landingSubmit;

  const suggestions = makeEl("div");
  suggestions.id = "suggestions";
  byId.suggestions = suggestions;

  const footerP = makeEl("p");
  const statusLink = makeEl("a");
  statusLink.id = "statusLink";
  footerP.appendChild(statusLink);
  byId.statusLink = statusLink;

  const threadItems = makeEl("div");
  threadItems.id = "threadItems";
  byId.threadItems = threadItems;

  const threadSearch = makeEl("input");
  threadSearch.id = "threadSearch";
  byId.threadSearch = threadSearch;

  const authOverlay = makeEl("div");
  authOverlay.id = "authOverlay";
  authOverlay.style.display = opts.authVisible ? "flex" : "none";
  byId.authOverlay = authOverlay;

  const threads = Array.isArray(opts.threads) ? opts.threads.slice() : [];
  const submittedQueries = [];
  let renderThreadsCount = 0;

  const document = {
    readyState: "complete",
    body,
    createElement: (tag) => makeEl(tag),
    createTextNode: (txt) => ({ nodeType: 3, textContent: String(txt), parentNode: null }),
    getElementById: (id) => {
      if (byId[id]) return byId[id];
      for (const ch of body.children) {
        if (ch.id === id) return ch;
      }
      return null;
    },
    addEventListener(ev, fn) {
      (docListeners[ev] = docListeners[ev] || []).push(fn);
    },
    dispatchKey(key) {
      let prevented = false;
      const evt = {
        key,
        preventDefault() { prevented = true; },
        stopPropagation() {}
      };
      (docListeners.keydown || []).forEach((fn) => fn(evt));
      return prevented;
    }
  };

  const windowObj = {
    localStorage,
    document,
    location: {
      pathname: opts.pathname || "/",
      search: opts.search || ""
    },
    __appGlobals: {
      threads
    },
    autosize() {},
    submitQuery(q) {
      submittedQueries.push(q);
      threads.push({ id: "t-" + threads.length, title: q });
    },
    renderThreads() {
      renderThreadsCount += 1;
      threadItems.children = [];
      threads.forEach((t) => {
        const row = makeEl("div");
        row.className = "thread-item";
        row.textContent = t.title;
        threadItems.appendChild(row);
      });
    },
    showLanding() {},
    addEventListener(ev, fn) {
      (winListeners[ev] = winListeners[ev] || []).push(fn);
    },
    setTimeout: (fn) => { fn(); return 1; }
  };

  const ctx = vm.createContext({
    window: windowObj,
    document,
    localStorage,
    setTimeout: windowObj.setTimeout,
    Number,
    String,
    Boolean,
    Array,
    Object,
    JSON,
    Math
  });
  vm.runInContext(SRC, ctx);

  return {
    api: windowObj.OnboardingUI,
    window: windowObj,
    document,
    localStorage,
    byId,
    threads,
    submittedQueries,
    get renderThreadsCount() { return renderThreadsCount; }
  };
}

test("EXAMPLE_PROMPTS defines 4-6 runnable platform-tailored queries", () => {
  const { api } = makeEnv({ initialStorage: { "pplx-onboarded": "1" } });
  assert.ok(Array.isArray(api.EXAMPLE_PROMPTS));
  assert.ok(api.EXAMPLE_PROMPTS.length >= 4 && api.EXAMPLE_PROMPTS.length <= 6);

  const ids = new Set();
  const queries = new Set();
  for (const item of api.EXAMPLE_PROMPTS) {
    assert.ok(typeof item.id === "string" && item.id.trim().length > 0);
    assert.ok(typeof item.tag === "string" && item.tag.trim().length > 0);
    assert.ok(typeof item.query === "string" && item.query.trim().length >= 20);
    assert.ok(!ids.has(item.id), "duplicate example id: " + item.id);
    assert.ok(!queries.has(item.query), "duplicate example query: " + item.query);
    ids.add(item.id);
    queries.add(item.query);
  }

  assert.ok(queries.has("Research Redondo Beach multifamily cap rates with live data"));
  assert.ok(queries.has("Compare FHA vs conventional loan limits 2026"));
  assert.ok(queries.has("Build a rent-comp table for Austin TX ZIP 78704"));
  assert.ok(queries.has("What's in my Comptrove coverage for Maricopa County?"));
});

test("STEPS defines the 4 compact getting-started tour steps and pplx-onboarded key", () => {
  const { api } = makeEnv({ initialStorage: { "pplx-onboarded": "1" } });
  assert.equal(api.STORAGE_KEY, "pplx-onboarded");
  assert.equal(api.STEPS.length, 4);
  assert.equal(api.STEPS[0].title, "Ask anything \u2014 live web research with citations");
  assert.equal(api.STEPS[1].title, "Attach files and generate docs/tables");
  assert.equal(api.STEPS[2].title, "Model picker \u2014 pick the lane that fits the task");
  assert.equal(api.STEPS[3].title, "Settings \u2014 connectors, fleet, tasks, automations");
});

test("overlay auto-opens on landing when pplx-onboarded is absent, steps through, and sets flag on finish", () => {
  const { api, document, localStorage } = makeEnv();
  const tour = document.getElementById("tour");
  assert.ok(tour, "#tour element created");
  assert.equal(api.getState().open, true);
  assert.equal(api.getState().step, 0);
  assert.equal(tour.classList.contains("open"), true);
  assert.equal(tour.getAttribute("aria-hidden"), "false");
  assert.equal(localStorage.getItem("pplx-onboarded"), null);
  assert.match(tour.innerHTML, /Ask anything/);

  api.next();
  assert.equal(api.getState().step, 1);
  assert.match(tour.innerHTML, /Attach files and generate docs\/tables/);

  api.prev();
  assert.equal(api.getState().step, 0);

  api.goToStep(3);
  assert.equal(api.getState().step, 3);
  assert.match(tour.innerHTML, /Get started/);

  // Advancing past the final step completes the tour and sets pplx-onboarded
  api.next();
  assert.equal(api.getState().open, false);
  assert.equal(tour.classList.contains("open"), false);
  assert.equal(tour.getAttribute("aria-hidden"), "true");
  assert.equal(localStorage.getItem("pplx-onboarded"), "1");
  assert.equal(api.isOnboarded(), true);
});

test("overlay does not auto-open when pplx-onboarded is set, on /t/<id> routes, or on ?share= links", () => {
  const already = makeEnv({ initialStorage: { "pplx-onboarded": "1" } });
  assert.equal(already.api.getState().open, false);
  assert.equal(already.document.getElementById("tour").classList.contains("open"), false);

  const threadRoute = makeEnv({ pathname: "/t/prelaunch" });
  assert.equal(threadRoute.api.getState().open, false);
  assert.equal(threadRoute.localStorage.getItem("pplx-onboarded"), null);

  const sharedLink = makeEnv({ pathname: "/", search: "?share=abc123" });
  assert.equal(sharedLink.api.getState().open, false);

  const hiddenLanding = makeEnv({ landingDisplay: "none" });
  assert.equal(hiddenLanding.api.getState().open, false);
});

test("overlay is skippable via skip(), Escape key, and backdrop click, persisting pplx-onboarded", () => {
  // 1. skip()
  const env1 = makeEnv();
  assert.equal(env1.api.getState().open, true);
  env1.api.skip();
  assert.equal(env1.api.getState().open, false);
  assert.equal(env1.localStorage.getItem("pplx-onboarded"), "1");

  // 2. Escape key + Arrow navigation
  const env2 = makeEnv();
  env2.document.dispatchKey("ArrowRight");
  assert.equal(env2.api.getState().step, 1);
  env2.document.dispatchKey("ArrowLeft");
  assert.equal(env2.api.getState().step, 0);
  const prevented = env2.document.dispatchKey("Escape");
  assert.equal(prevented, true);
  assert.equal(env2.api.getState().open, false);
  assert.equal(env2.localStorage.getItem("pplx-onboarded"), "1");

  // 3. Backdrop click
  const env3 = makeEnv();
  const tour3 = env3.document.getElementById("tour");
  tour3.dispatch("click", { target: tour3 });
  assert.equal(env3.api.getState().open, false);
  assert.equal(env3.localStorage.getItem("pplx-onboarded"), "1");
});

test("empty-state prompt chips show only when composer is empty AND zero threads exist", () => {
  const env = makeEnv({ initialStorage: { "pplx-onboarded": "1" } });
  const box = env.byId.suggestions;
  const input = env.byId.landingInput;

  // Initial: empty composer + 0 threads -> visible
  assert.equal(env.api.getState().emptyPromptsVisible, true);
  assert.equal(box.hidden, false);
  assert.equal(box.style.display, "");

  // Typing hides empty-state chips immediately
  input.value = "cap rates";
  input.dispatch("input");
  assert.equal(env.api.getState().emptyPromptsVisible, false);
  assert.equal(box.hidden, true);
  assert.equal(box.style.display, "none");

  // Clearing composer while 0 threads exist restores chips
  input.value = "   ";
  input.dispatch("input");
  assert.equal(env.api.getState().emptyPromptsVisible, true);
  assert.equal(box.hidden, false);

  // Once a thread exists, chips stay hidden even when composer is empty
  env.threads.push({ id: "t-1", title: "Existing thread" });
  env.window.renderThreads();
  assert.equal(env.api.getState().emptyPromptsVisible, false);
  assert.equal(box.hidden, true);
});

test("clicking an example prompt chip fills #landingInput, closes open tour, and calls submitQuery", () => {
  const env = makeEnv({ initialStorage: { ai_draft_landing: "stale draft" } });
  assert.equal(env.api.getState().open, true);

  const box = env.byId.suggestions;
  const grid = box.children.find((ch) => ch.className.includes("ob-example-grid"));
  assert.ok(grid, "example grid mounted");
  assert.equal(grid.children.length, env.api.EXAMPLE_PROMPTS.length);

  const firstChip = grid.children[0];
  const expectedQuery = env.api.EXAMPLE_PROMPTS[0].query;
  firstChip.click();

  assert.equal(env.byId.landingInput.value, expectedQuery);
  assert.deepEqual(env.submittedQueries, [expectedQuery]);
  assert.equal(env.localStorage.getItem("ai_draft_landing"), null);
  assert.equal(env.api.getState().open, false);
  assert.equal(env.localStorage.getItem("pplx-onboarded"), "1");
  assert.equal(env.api.getState().emptyPromptsVisible, false);
});
