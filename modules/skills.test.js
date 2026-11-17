// node --test modules/skills.test.js — Skills v1 (Parity doc §34c) pure-API unit tests:
// validation rules and the shape of payloads/messages sent to Supabase / the chat thread.
const test = require("node:test");
const assert = require("node:assert/strict");
const skills = require("./skills.js");

// ---------- validation ----------

test("validateSkillInput rejects a missing name", () => {
  const r = skills.validateSkillInput({ instructions: "Do the thing" });
  assert.equal(r.ok, false);
  assert.match(r.error, /name/i);
});

test("validateSkillInput rejects blank instructions", () => {
  const r = skills.validateSkillInput({ name: "Brief", instructions: "   " });
  assert.equal(r.ok, false);
  assert.match(r.error, /instructions/i);
});

test("validateSkillInput enforces length limits", () => {
  assert.equal(skills.validateSkillInput({ name: "x".repeat(81), instructions: "y" }).ok, false);
  assert.equal(skills.validateSkillInput({ name: "ok", description: "d".repeat(301), instructions: "y" }).ok, false);
  assert.equal(skills.validateSkillInput({ name: "ok", instructions: "y".repeat(8001) }).ok, false);
  assert.equal(skills.validateSkillInput({ name: "ok", instructions: "y".repeat(8000) }).ok, true);
  assert.equal(skills.validateSkillInput({ name: "x".repeat(80), instructions: "y" }).ok, true);
});

test("validateSkillInput trims and returns the canonical value shape", () => {
  const r = skills.validateSkillInput({
    name: "  Competitor brief  ",
    description: "  Weekly teardown  ",
    instructions: "  Research the rivals  ",
    tools: [" github ", "web search", "GitHub"]
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, {
    name: "Competitor brief",
    description: "Weekly teardown",
    instructions: "Research the rivals",
    tools: ["github", "web search"]
  });
});

test("validateSkillInput rejects too many or too-long tool tags", () => {
  const tooMany = Array.from({ length: 13 }, (_, i) => "t" + i);
  assert.equal(skills.validateSkillInput({ name: "a", instructions: "b", tools: tooMany }).ok, false);
  assert.equal(
    skills.validateSkillInput({ name: "a", instructions: "b", tools: ["x".repeat(41)] }).ok,
    false
  );
  assert.equal(skills.validateSkillInput({ name: "a", instructions: "b", tools: Array.from({ length: 12 }, (_, i) => "t" + i) }).ok, true);
});

// ---------- tool tag normalization ----------

test("normalizeTools accepts csv strings, arrays, and empties", () => {
  assert.deepEqual(skills.normalizeTools("web search, github , email"), ["web search", "github", "email"]);
  assert.deepEqual(skills.normalizeTools(["A", "a", " b "]), ["A", "b"]);
  assert.deepEqual(skills.normalizeTools(null), []);
  assert.deepEqual(skills.normalizeTools("  "), []);
});

test("normalizeTools dedupes case-insensitively and drops blanks", () => {
  assert.deepEqual(skills.normalizeTools("Search, search, , SEARCH"), ["Search"]);
});

test("normalizeTools returns null for unsupported shapes and over-limit input", () => {
  assert.equal(skills.normalizeTools(42), null);
  assert.equal(skills.normalizeTools(["ok", "x".repeat(41)]), null);
  assert.equal(skills.normalizeTools(Array.from({ length: 13 }, (_, i) => "tag" + i)), null);
});

// ---------- "Use in chat" message ----------

test("buildUseInChatMessage produces the spec'd form", () => {
  assert.equal(
    skills.buildUseInChatMessage({ name: "Competitor brief", instructions: "Research the rivals." }),
    "Use the skill 'Competitor brief': Research the rivals."
  );
});

test("buildUseInChatMessage trims name and instructions", () => {
  assert.equal(
    skills.buildUseInChatMessage({ name: " N ", instructions: " I " }),
    "Use the skill 'N': I"
  );
});

// ---------- DB row -> client shape ----------

test("skillFromRow maps a public.skills row and defaults tools to []", () => {
  const row = {
    id: "6f1c7a52-0000-4000-8000-000000000001",
    name: "Digest",
    description: "Weekly digest",
    instructions: "Summarize the week.",
    tools: ["web search", "email"],
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-13T00:00:00Z"
  };
  assert.deepEqual(skills.skillFromRow(row), {
    id: row.id,
    name: "Digest",
    description: "Weekly digest",
    instructions: "Summarize the week.",
    tools: ["web search", "email"],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
  const bare = skills.skillFromRow({ id: "x", name: "Y", instructions: "Z", tools: null });
  assert.deepEqual(bare.tools, []);
});

// ---------- write payload shape ----------

test("buildSkillWritePayload emits only the authorable columns", () => {
  const p = skills.buildSkillWritePayload({
    id: "should-not-appear",
    user_id: "should-not-appear",
    name: " Competitor brief ",
    description: " Teardown ",
    instructions: " Research the rivals ",
    tools: " github , email ",
    created_at: "2020-01-01",
    updated_at: "2020-01-02"
  });
  assert.equal(p.ok, true);
  assert.deepEqual(Object.keys(p.value).sort(), ["description", "instructions", "name", "tools"]);
  assert.deepEqual(p.value, {
    name: "Competitor brief",
    description: "Teardown",
    instructions: "Research the rivals",
    tools: ["github", "email"]
  });
});

test("buildSkillWritePayload surfaces validation errors instead of a payload", () => {
  const p = skills.buildSkillWritePayload({ name: "", instructions: "" });
  assert.equal(p.ok, false);
  assert.equal(p.value, undefined);
  assert.match(p.error, /name/i);
});

test("LIMITS match the sql/skills.sql check constraints", () => {
  assert.deepEqual(skills.LIMITS, { name: 80, description: 300, instructions: 8000, tool: 40, tools: 12 });
});
