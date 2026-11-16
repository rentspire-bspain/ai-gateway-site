// call-model-policy.js — fail-CLOSED spend decisions + model allowlist for call-model.
export const FREE_MODEL_IDS = new Set(["recursive/flint-v1.0:free", "qwen/qwen3.8-27b"]);
export const PAID_MODEL_ALLOWLIST = new Set([
  "deepseek/deepseek-v4.1-flash-1017",
  "deepseek/deepseek-v4.1-flash",
  "z-ai/glm-5.3",
  "moonshotai/kimi-k3.1-pro",        // long-context + reasoning auto-route, council, picker
  "meta-llama/llama-4-maverick",     // picker
  "openai/gpt-oss-120b",             // picker
  "cognitivecomputations/dolphin-mistral-24b-venice-edition", // picker (Venice + Dolphin)
  "google/gemini-2.5-flash-image" // media-gen image generation (modalities image+text)
]);
export const FALLBACK_FREE = "qwen/qwen3.8-27b";

/** Exact-id matching only (no substring "groq" / prefix tricks). */
export const isFreeModel = (m) => FREE_MODEL_IDS.has(m) || (/^[a-z0-9._-]+\/[a-z0-9._:-]+$/i.test(m) && m.endsWith(":free") && !m.includes("..") && m.split("/").length === 2);
export function resolveModel(requested, defaults, extraAllow = []) {
  const m = requested || defaults;
  if (isFreeModel(m) || PAID_MODEL_ALLOWLIST.has(m) || extraAllow.includes(m)) return { model: m, rejected: false };
  return { model: FALLBACK_FREE, rejected: true };
}
/** cap = 0 (or unset) means NO CAP (owner directive 2026-11-10). */
export function capDecision({ paidToday, monthSpend, dailyCap, monthlyCap, failClosed = true }) {
  const dailyOn = Number(dailyCap) > 0, monthlyOn = Number(monthlyCap) > 0;
  if (!dailyOn && !monthlyOn) return { exceeded: false, reason: "no_cap" };
  if (failClosed && (paidToday === null || monthSpend === null)) {
    // only enforce fail-closed for the caps that are actually on
    if (dailyOn && paidToday === null) return { exceeded: true, reason: "meter_unavailable" };
    if (monthlyOn && monthSpend === null) return { exceeded: true, reason: "meter_unavailable" };
  }
  if (dailyOn && paidToday >= dailyCap) return { exceeded: true, reason: "daily_cap" };
  if (monthlyOn && monthSpend >= monthlyCap) return { exceeded: true, reason: "monthly_cap" };
  return { exceeded: false, reason: "ok" };
}
/** Constant-time string compare; empty expected never matches. */
export function safeEqual(a, b) {
  a = String(a ?? ""); b = String(b ?? "");
  if (!b) return false;
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
