// BM25 retrieval over the bundled Spain Terminal corpus (corpus.json). Pure functions, no network.
export type Chunk = { id: number; src: string; lines: string; text: string };
const STOP = new Set("a an and are as at be by can do does for from has have how i if in is it its me my of on or our so than that the their this to was we what when where which who why will with you your about into tell show give get any all there these those they them been being was were than then also not no yes".split(" "));
export function tokenize(s: string): string[] {
  const base = (s.toLowerCase().match(/[a-z0-9_.$%]+/g) || []).map((t) => t.replace(/^[._]+|[._]+$/g, "")).filter((t) => t.length > 1);
  const out: string[] = [];
  for (const t of base) { out.push(t); if (t.includes("_")) for (const p of t.split("_")) if (p.length > 1) out.push(p); } // snake_case columns also match their words
  return out.filter((t) => !STOP.has(t));
}
export function buildIndex(chunks: Chunk[]) {
  const docs = chunks.map((c) => { const t = tokenize(c.src + " " + c.text); const tf = new Map<string, number>(); for (const w of t) tf.set(w, (tf.get(w) || 0) + 1); return { tf, len: t.length }; });
  const df = new Map<string, number>(); for (const d of docs) for (const w of d.tf.keys()) df.set(w, (df.get(w) || 0) + 1);
  const avg = docs.reduce((a, d) => a + d.len, 0) / Math.max(1, docs.length);
  return { docs, df, avg, n: docs.length };
}
export function search(idx: ReturnType<typeof buildIndex>, chunks: Chunk[], query: string, k = 5, minScore = 6) {
  const q = [...new Set(tokenize(query))]; const k1 = 1.4, b = 0.75;
  const scored = idx.docs.map((d, i) => {
    let s = 0;
    for (const w of q) { const f = d.tf.get(w); if (!f) continue; const df = idx.df.get(w) || 0; const idf = Math.log(1 + (idx.n - df + 0.5) / (df + 0.5)); s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.len / idx.avg)); }
    return { i, s };
  }).filter((x) => x.s >= minScore).sort((a, b) => b.s - a.s).slice(0, k);
  return scored.map((x) => ({ chunk: chunks[x.i], score: Math.round(x.s * 10) / 10 }));
}
