// Thread slug generation. Mirrors public.slugify_thread_title() in 2026-11-10-thread-slugs.sql
// and slugifyTitle() in ai-gateway-site/index.html.
export function slugify(title: string, maxWords = 8, maxLen = 60): string {
  const words = String(title ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean).slice(0, maxWords);
  let s = words.join("-");
  if (s.length > maxLen) s = s.slice(0, maxLen).replace(/-[^-]*$/, "") || s.slice(0, maxLen);
  return s || "thread";
}
/** Dedupe against a set of taken slugs: foo, foo-2, foo-3 ... */
export function uniqueSlug(base: string, taken: Set<string> | ((s: string) => boolean)): string {
  const has = typeof taken === "function" ? taken : (s: string) => taken.has(s);
  let s = base, n = 2;
  while (has(s)) s = `${base}-${n++}`;
  return s;
}
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Resolve a thread key (slug or UUID) to a PostgREST filter column. */
export function threadKeyFilter(key: string): { column: "id" | "slug"; value: string } {
  return UUID_RE.test(key) ? { column: "id", value: key } : { column: "slug", value: key.toLowerCase() };
}
