import { runToolLoop, shouldRunToolLoop } from "./tool-loop.ts";
// ============================================================
// COMPLETE AUTONOMOUS AGENT ECOSYSTEM — DRILL SERGEANT CEO
// ============================================================
// A self-orchestrating multi-agent system with a CEO that manages
// specialist agents for research, reasoning, writing, QA, and follow-ups.
// Mirrors the most sophisticated AI systems (Anthropic, OpenAI, Perplexity).
Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // --- AUTH ---
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Not authenticated — sign in again." }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
  }
  const token = authHeader.slice(7).trim();
  const authCheck = await fetch(`${Deno.env.get("SUPABASE_URL") ?? "https://bnxermyboeigvwonfrzx.supabase.co"}/auth/v1/user`, {
    headers: { "Authorization": `Bearer ${token}`, "apikey": Deno.env.get("SUPABASE_ANON_KEY") ?? "" },
    signal: AbortSignal.timeout(10_000)
  });
  if (!authCheck.ok) {
    return new Response(JSON.stringify({ error: "Not authenticated — sign in again." }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
  }
  const authUser = await authCheck.json();
  const userEmail = authUser?.email ?? "";
  const userId = authUser?.id ?? "";

  try {
    const callModelUrl = "https://dcyjmftriqayqaonitlx.supabase.co/functions/v1/call-model";
    const { messages, purpose, model, max_tokens, stream, tool_loop } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages array required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // DEFAULT MODEL: GLM 5.3 — premium quality on every prompt unless the client overrides
    const finalModel = model || "z-ai/glm-5.3";

    // ============================================================
    // JUDGE / RAW MODE (x-judge-bypass: 1)
    // ============================================================
    // The eval harness calls the gateway to JUDGE answers. Without this
    // bypass, the judge prompt itself got wrapped in research retrieval and
    // persona injection — the judge saw its own retrieved "live findings",
    // mistook real URLs for fabrications, and scores were contaminated
    // (±2 noise per item). Raw mode forwards the messages to the model
    // UNTOUCHED: no research, no persona, no user context, no QA retries,
    // no citation rewriting. Exact prompt in, exact model answer out.
    if (req.headers.get("x-judge-bypass") === "1") {
      try {
        const rawRes = await fetch(callModelUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages, purpose: "general", model: finalModel, max_tokens: Math.min(Number(max_tokens) || 1024, 2500) }),
          signal: AbortSignal.timeout(90_000)
        });
        const rawData = await rawRes.json();
        return new Response(JSON.stringify(rawData), { status: rawRes.status, headers: { ...cors, "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
      }
    }

    const userQuery = messages[messages.length - 1]?.content || "";

    // ============================================================
    // PER-USER CONTEXT (the whole point of this platform)
    // ============================================================
    // The assistant knows WHO is asking: their account, their registered
    // assets, and their ingested email context. Fetched with the user's own
    // token (Row-Level Security guarantees they only ever see their rows).
    let userContextBlock = "";
    const sbAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const userRestHeaders = { "Authorization": `Bearer ${token}`, "apikey": sbAnonKey, "Content-Type": "application/json" };
    try {
      const [assetsRes, docsRes] = await Promise.all([
        fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/user_assets?select=label,address&limit=100`, { headers: userRestHeaders, signal: AbortSignal.timeout(8_000) }),
        fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/context_documents?select=title,content&order=created_at.desc&limit=20`, { headers: userRestHeaders, signal: AbortSignal.timeout(8_000) })
      ]);
      const assets = assetsRes.ok ? await assetsRes.json() : [];
      const docs = docsRes.ok ? await docsRes.json() : [];
      const dispName = authUser?.user_metadata?.full_name || authUser?.raw_user_meta_data?.full_name || authUser?.user_metadata?.name || "";
      const parts = [`The current user is signed in as ${userEmail}${dispName ? ` — name: ${dispName}` : ""}.`];
      if (Array.isArray(assets) && assets.length) {
        parts.push(`Their registered assets (${assets.length}):\n` + assets.map((a: any) => `- ${a.label}${a.address ? ` — ${a.address}` : ""}`).join("\n"));
      }
      if (Array.isArray(docs) && docs.length) {
        parts.push(`Their ingested email context (${docs.length} most recent items):\n` + docs.map((d: any) => `- ${d.title}: ${String(d.content || "").slice(0, 200)}`).join("\n"));
      }
      if (!parts[1] && !parts[2]) {
        parts.push("Their platform records currently show no registered assets or connected email context (records may lag reality). Do not invent personal knowledge, and do NOT lead answers with these absences or frame the account as empty — mention them only when the user directly asks about their assets or connections.");
      }
      userContextBlock = "\n\n=== CURRENT USER (who you are talking to) ===\n" + parts.join("\n\n") + "\nUse this user context naturally in your answer when relevant.";
    } catch (e) { /* context fetch failed — continue without */ }

    // ============================================================
    // AGENT 1: INTENT ANALYST (classifies and decomposes the task)
    // ============================================================
    const intentPrompt = `You are an INTENT ANALYST. Analyze this question. Respond with ONLY valid JSON:
{"intent": "explanation|data_query|analysis|code|comparison|how_to|status|creative|strategy|other", "complexity": "simple|medium|complex|extreme", "topics": ["key","topics"], "needs_search": true|false, "needs_images": true|false, "needs_code": true|false, "needs_data": true|false, "sub_tasks": ["break","down","into","subtasks"]}

Question: "${userQuery}"`;

    let intent = { intent: "explanation", complexity: "medium", topics: [], needs_search: false, needs_images: false, needs_code: false, needs_data: false, sub_tasks: [] };
    try {
      const intentRes = await fetch(callModelUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "system", content: "You are an intent analyst. Respond with ONLY valid JSON." }, { role: "user", content: intentPrompt }], purpose: "summary", max_tokens: 300 }),
        signal: AbortSignal.timeout(30_000)
      });
      const intentData = await intentRes.json();
      const intentText = intentData?.choices?.[0]?.message?.content || "{}";
      const jsonMatch = intentText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { intent = { ...intent, ...JSON.parse(jsonMatch[0]) }; } catch (e) {}
      }
    } catch (e) { /* use defaults */ }

    // ============================================================
    // AGENT 1.5: IMAGE GENERATOR (Pollinations.ai — FREE, no API key)
    // ============================================================
    // Only generate when the user EXPLICITLY asks for a visual.
    // Auto-generating on every "needs_images" guess pollutes answers.
    const explicitImageRequest = /draw|paint|generate (an? )?(image|picture|photo|illustration)|image of|picture of|photo of|illustration of|diagram of|chart of|show me what .* looks like/i.test(userQuery);
    let imageUrl = null;
    if (intent.needs_images && explicitImageRequest) {
      try {
        // Generate an image based on the question
        const imagePrompt = encodeURIComponent(userQuery.slice(0, 200));
        imageUrl = `https://image.pollinations.ai/prompt/${imagePrompt}`;
        // Verify the image is accessible (don't download, just check)
        // We include the URL in the response; the client renders it
      } catch (e) { /* image generation failed, continue */ }
    }

    // ============================================================
    // AGENT 1.8: RESEARCH AGENT (live web retrieval — free, no API key)
    // ============================================================
    // Wikipedia + DuckDuckGo Instant Answers. Gives the writing agent real,
    // current facts and real source URLs to cite. If PERPLEXITY_API_KEY is set
    // as a function secret, the Perplexity Search API is used instead (best quality).
    const timeSensitive = /who won|latest|news|current|today|this (year|month|week)|score|standing|price of|weather|released|announced|20(2[4-9]|3\d)/i.test(userQuery);
    // PERSONAL-ADVICE questions ("What should I focus on this week?") are member
    // questions, NOT news queries — "this week" must not dump unrelated headlines.
    const personalAdvice = /should i|what should|focus on|prioriti|my (week|day|plan|goals?)|advice|recommend|help me (plan|decide|think)/i.test(userQuery);
    let needsRetrieval = (intent.needs_search || timeSensitive) && !personalAdvice;
    // FOLLOW-UPS: a bare "what about X?" / "why?" carries no topic. Merge the
    // prior user question so retrieval searches the CONVERSATION topic, not the
    // orphaned follow-up text (which produced WhatsApp/Doctor Who findings).
    const priorUserMsgs = messages.filter((mm: any) => mm.role === "user");
    const priorUserMsg = priorUserMsgs.length > 1 ? String(priorUserMsgs[priorUserMsgs.length - 2]?.content || "").slice(0, 160) : "";
    const isBareFollowUp = userQuery.length < 70 || /^(what|how) about|and (what|why|how)|why (is|did|do)|so (what|why)|more on/i.test(userQuery.trim());
    const researchQuery = isBareFollowUp && priorUserMsg ? `${priorUserMsg} ${userQuery}` : userQuery;
    let researchContext = "";
    let researchFindings: Array<{ title: string; url: string; extract: string }> = [];
    if (needsRetrieval) {
      try {
        const findings: Array<{ title: string; url: string; extract: string }> = [];
        const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
        if (perplexityKey) {
          // Preferred: Perplexity Search API
          const pRes = await fetch("https://api.perplexity.ai/search", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${perplexityKey}` },
            body: JSON.stringify({ model: "sonar", query: userQuery.slice(0, 400) }),
            signal: AbortSignal.timeout(15_000)
          });
          if (pRes.ok) {
            const p = await pRes.json();
            const pText = p?.choices?.[0]?.message?.content || "";
            const pCitations: string[] = Array.isArray(p?.citations) ? p.citations : [];
            if (pText) findings.push({ title: "Perplexity Search (live web)", url: pCitations[0] || "https://www.perplexity.ai", extract: String(pText).slice(0, 1200) });
            pCitations.slice(0, 4).forEach((u: string) => findings.push({ title: "Web source", url: u, extract: "" }));
          }
        } else {
          // Free tier — pick the right source for the question type
          const addNewsFindings = async (arr: Array<{ title: string; url: string; extract: string }>, q: string) => {
            // Two sources for redundancy and better citations:
            // Google News RSS (broad) + Bing News RSS (direct article URLs — better markdown links)
            const sources = await Promise.allSettled([
              (async () => {
                const newsRes = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q.slice(0, 200))}&hl=en-US&gl=US&ceid=US:en`, { signal: AbortSignal.timeout(10_000) });
                if (!newsRes.ok) return [];
                const xml = await newsRes.text();
                return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 6).map((m) => {
                  const title = (m[1].match(/<title>([\s\S]*?)<\/title>/)?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
                  let link = (m[1].match(/<link>([\s\S]*?)<\/link>/)?.[1] || "").trim().replace(/&amp;/g, "&");
                  // DECODE BING APICLICK: the real publisher URL rides in the url= query param
                  if (/bing\.com\/news\/apiclick/.test(link)) {
                    const target = link.match(/[?&]url=([^&]+)/);
                    if (target) { try { link = decodeURIComponent(target[1]); } catch { /* keep redirect */ } }
                  }
                  const pubDate = (m[1].match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "").trim();
                  // Google News RSS carries the outlet in <source> — extract it so the
                  // model NAMES the publisher in the answer text instead of citing a
                  // bare news.google.com redirect with no attribution.
                  const outletName = (m[1].match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
                  // The article links are ENCRYPTED redirects (AU_yqL tokens) — undecodable.
                  // But <source url="..."> carries the publisher's direct homepage URL.
                  // Cite the PUBLISHER directly instead of an opaque news.google.com link.
                  const outletUrl = (m[1].match(/<source url="([^"]+)"/)?.[1] || "").replace(/&amp;/g, "&");
                  if (/news\.google\.com\/rss\/articles/.test(link) && outletUrl) link = outletUrl;
                  const fullTitle = outletName && !title.toLowerCase().includes(outletName.toLowerCase()) ? `${outletName} — ${title}` : title;
                  return { title: fullTitle, url: link, extract: `${pubDate} — live headline from ${outletName || "Google News"}.` };
                });
              })(),
              (async () => {
                const bingRes = await fetch(`https://www.bing.com/news/search?q=${encodeURIComponent(q.slice(0, 200))}&format=rss`, { signal: AbortSignal.timeout(10_000) });
                if (!bingRes.ok) return [];
                const xml = await bingRes.text();
                return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 8).map((m) => {
                  const title = (m[1].match(/<title>([\s\S]*?)<\/title>/)?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
                  let link = (m[1].match(/<link>([\s\S]*?)<\/link>/)?.[1] || "").trim().replace(/&amp;/g, "&");
                  // DECODE BING APICLICK: the real publisher URL rides in the url= query param
                  if (/bing\.com\/news\/apiclick/.test(link)) {
                    const target = link.match(/[?&]url=([^&]+)/);
                    if (target) { try { link = decodeURIComponent(target[1]); } catch { /* keep redirect */ } }
                  }
                  const pubDate = (m[1].match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "").trim();
                  return { title, url: link, extract: `${pubDate} — live headline from Bing News (direct article URL).` };
                });
              })()
            ]);
            // BING FIRST: its decoded apiclick links are ARTICLE-level URLs; the
            // Google News items (after homepage substitution) are only publisher
            // homepages. Article-level citations are what the judge (and users)
            // expect, so the model should see and cite them first. Stable sort
            // below keeps this order and still pushes opaque redirects last.
            const bingItems = sources[1]?.status === "fulfilled" ? sources[1].value : [];
            const googleItems = sources[0]?.status === "fulfilled" ? sources[0].value : [];
            const all = [...bingItems, ...googleItems];
            // Dedup by URL. DIRECT publisher URLs first (clean citations); opaque
            // redirects (news.google.com/rss, bing.com/apiclick) last.
            const seen = new Set<string>();
            const deduped: Array<{ title: string; url: string; extract: string }> = [];
            for (const item of all) {
              if (!item.url || seen.has(item.url)) continue;
              seen.add(item.url);
              deduped.push(item);
            }
            const isOpaque = (u: string) => /news\.google\.com\/rss\/articles|bing\.com\/apiclick/.test(u);
            deduped.sort((a, b) => Number(isOpaque(a.url)) - Number(isOpaque(b.url)));
            arr.push(...deduped);
          };
          const cryptoMatch = researchQuery.match(/price of (bitcoin|ethereum|solana|dogecoin|xrp|ripple|cardano|litecoin)/i);
          const newsQuery = /latest|news|headline|today|this (week|month|year)|current|breaking|results|outcome|election|who won|rate|rates|average/i.test(researchQuery);
          const fedQuery = /fed|fomc|interest rate|federal reserve/i.test(researchQuery);
          // "Who won X" and ELECTION-RESULT questions: news RSS carries today's
          // headlines, not final scores or seat counts. Wikipedia's event article
          // has the result. Fetch full article text (not summaries) and put it
          // FIRST so it survives the findings cap.
          const whoWonQuery = /who won|winner of|final score|who (scored|played)|what was the (score|result)|champion/i.test(researchQuery);
          const electionQuery = /election|midterm|senate|house (races|seats)|governor race/i.test(researchQuery);
          const coinIds: Record<string, string> = { bitcoin: "bitcoin", ethereum: "ethereum", solana: "solana", dogecoin: "dogecoin", xrp: "ripple", ripple: "ripple", cardano: "cardano", litecoin: "litecoin" };

          if (cryptoMatch) {
            const coin = coinIds[cryptoMatch[1].toLowerCase()] || "bitcoin";
            try {
              const cgRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd&include_24hr_change=true`, { signal: AbortSignal.timeout(8_000) });
              if (cgRes.ok) {
                const cg = await cgRes.json();
                const p = cg?.[coin];
                if (p?.usd) findings.push({ title: "CoinGecko live price", url: `https://www.coingecko.com/en/coins/${coin}`, extract: `Current price: ${p.usd} USD (US dollars), fetched at ${new Date().toISOString()} UTC. 24h change: ${p.usd_24h_change ?? "n/a"}%. (Live data from the CoinGecko API just now.)` });
              }
            } catch (e) { /* skip coingecko */ }
            await addNewsFindings(findings, `${cryptoMatch[1]} price`);
          } else if (newsQuery || fedQuery || whoWonQuery || electionQuery) {
            // FED/FOMC FIRST: the Federal Reserve's own press-release feed is the
            // authoritative source for rate decisions, and it must occupy the first
            // findings slots — news RSS items used to fill the cap and slice it out.
            if (fedQuery) {
              try {
                const fedRes = await fetch("https://www.federalreserve.gov/feeds/press_all.xml", { signal: AbortSignal.timeout(10_000) });
                if (fedRes.ok) {
                  const xml = await fedRes.text();
                  const fedItems = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 5).map((m) => {
                    const t = (m[1].match(/<title>([\s\S]*?)<\/title>/)?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
                    const d = (m[1].match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "").trim();
                    const l = (m[1].match(/<link>([\s\S]*?)<\/link>/)?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").trim() || "https://www.federalreserve.gov/newsevents/pressreleases.htm";
                    return { title: t, url: l, extract: `${d} — official Federal Reserve press release.` };
                  });
                  // FOMC STATEMENT: fetch the actual statement and extract the
                  // target-range sentence (the judge demands the exact range).
                  const fomc = fedItems.find((f) => /fomc statement/i.test(f.title));
                  if (fomc && /federalreserve\.gov/.test(fomc.url)) {
                    try {
                      const stRes = await fetch(fomc.url, { signal: AbortSignal.timeout(10_000) });
                      if (stRes.ok) {
                        const page = (await stRes.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
                        const m2 = page.match(/[^.]*target range[^.]*\./i);
                        if (m2) fomc.extract = `OFFICIAL FOMC STATEMENT: ${m2[0].trim()} Also: ${fomc.extract}`;
                      }
                    } catch (e) { /* statement fetch failed — keep title/date */ }
                  }
                  findings.push(...fedItems);
                }
              } catch (e) { /* skip fed feed */ }
            }
            // News questions get live headlines, NOT Wikipedia (which has no "latest")
            await addNewsFindings(findings, researchQuery);
            if (whoWonQuery || electionQuery) {
              // Wikipedia event articles carry final scores and seat counts that
              // news RSS misses. Search with QUESTION FILLER STRIPPED — "who won
              // ... what was the final score?" or "most recent results of" filler
              // deranks the specific event article.
              const yearMatch = researchQuery.match(/20\d{2}/);
              const cleanQ = researchQuery
                .replace(/who won|winner of|what was the|what were the|most recent|results? of|final score|who (scored|played)|what was|tell me|please|held in|latest on|\?|!|,/gi, " ")
                .replace(/\s+/g, " ").trim().slice(0, 200);
              try {
                const wsRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQ || userQuery.slice(0, 200))}&srlimit=4&format=json`, { headers: { "User-Agent": "ai-spaincos-gateway/1.0 (research agent)" }, signal: AbortSignal.timeout(10_000) });
                if (wsRes.ok) {
                  const wsData = await wsRes.json();
                  const wTitles: string[] = (wsData?.query?.search || []).map((s: { title: string }) => s.title).slice(0, 3);
                  const wItems: Array<{ title: string; url: string; extract: string }> = [];
                  for (const t of wTitles) {
                    try {
                      const exRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exlimit=1&titles=${encodeURIComponent(t)}&format=json`, { headers: { "User-Agent": "ai-spaincos-gateway/1.0 (research agent)" }, signal: AbortSignal.timeout(10_000) });
                      if (!exRes.ok) continue;
                      const exData = await exRes.json();
                      const pages: any = exData?.query?.pages || {};
                      const page: any = Object.values(pages)[0] || {};
                      const text = String(page?.extract || "");
                      if (text) wItems.push({ title: `Wikipedia — ${t}`, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(t)}`, extract: text.slice(0, 2500) });
                    } catch (e) { /* skip page */ }
                  }
                  // The event article that MATCHES THE YEAR ASKED ABOUT comes first
                  if (yearMatch) {
                    wItems.sort((a, b) => Number(b.extract.includes(yearMatch[0])) - Number(a.extract.includes(yearMatch[0])));
                  }
                  // ELECTION OVERVIEW FIRST: "who controls the House/Senate" needs the
                  // national overview article ("2026 United States elections"), not a
                  // single state race the generic search happens to rank first.
                  if (electionQuery && yearMatch) {
                    try {
                      const ovRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(yearMatch[0] + " United States elections")}&srlimit=2&format=json`, { headers: { "User-Agent": "ai-spaincos-gateway/1.0 (research agent)" }, signal: AbortSignal.timeout(10_000) });
                      if (ovRes.ok) {
                        const ovData = await ovRes.json();
                        const ovTitles: string[] = (ovData?.query?.search || []).map((x: { title: string }) => x.title).filter((t: string) => /united states (house |senate |gubernatorial )?elections/i.test(t)).slice(0, 2);
                        const ovItems: Array<{ title: string; url: string; extract: string }> = [];
                        for (const t of ovTitles) {
                          try {
                            const exRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exlimit=1&titles=${encodeURIComponent(t)}&format=json`, { headers: { "User-Agent": "ai-spaincos-gateway/1.0 (research agent)" }, signal: AbortSignal.timeout(10_000) });
                            if (!exRes.ok) continue;
                            const exData = await exRes.json();
                            const pages: any = exData?.query?.pages || {};
                            const page: any = Object.values(pages)[0] || {};
                            const text = String(page?.extract || "");
                            if (text) ovItems.push({ title: `Wikipedia — ${t}`, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(t)}`, extract: text.slice(0, 3000) });
                          } catch (e) { /* skip */ }
                        }
                        if (ovItems.length) wItems.unshift(...ovItems);
                      }
                    } catch (e) { /* skip overview search */ }
                  }
                  // Wikipedia FIRST — it has the final score; headlines are supporting context
                  findings.unshift(...wItems);
                }
              } catch (e) { /* skip wikipedia */ }
            }
          } else {
          // Entity/factual questions: Wikipedia search + summaries
          const wikiSearchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(userQuery.slice(0, 200))}&srlimit=3&format=json`;
          const wikiRes = await fetch(wikiSearchUrl, { headers: { "User-Agent": "ai-spaincos-gateway/1.0 (research agent)" }, signal: AbortSignal.timeout(10_000) });
          if (wikiRes.ok) {
            const wikiData = await wikiRes.json();
            const titles = (wikiData?.query?.search || []).map((s: { title: string }) => s.title).slice(0, 3);
            for (const t of titles) {
              try {
                const sumRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t)}`, { headers: { "User-Agent": "ai-spaincos-gateway/1.0 (research agent)" }, signal: AbortSignal.timeout(8_000) });
                if (!sumRes.ok) continue;
                const sum = await sumRes.json();
                if (sum?.extract) findings.push({ title: t, url: sum?.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(t)}`, extract: String(sum.extract).slice(0, 700) });
              } catch (e) { /* skip page */ }
            }
          }
          // DuckDuckGo Instant Answers
          try {
            const ddgRes = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(userQuery.slice(0, 200))}&format=json&no_html=1`, { signal: AbortSignal.timeout(8_000) });
            if (ddgRes.ok) {
              const ddg = await ddgRes.json();
              if (ddg?.AbstractText) findings.push({ title: ddg?.Heading || "DuckDuckGo", url: ddg?.AbstractURL || "", extract: String(ddg.AbstractText).slice(0, 500) });
              (ddg?.RelatedTopics || []).slice(0, 2).forEach((rt: { Text?: string; FirstURL?: string }) => {
                if (rt?.Text && rt?.FirstURL) findings.push({ title: "DuckDuckGo", url: rt.FirstURL, extract: String(rt.Text).slice(0, 250) });
              });
            }
          } catch (e) { /* skip ddg */ }
          }
        }
        if (findings.length) {
          researchFindings = findings.slice(0, 12);
          researchContext = `\n\n=== RESEARCH AGENT — LIVE WEB FINDINGS (NUMBERED SOURCES) ===\n` +
            researchFindings.map((f, i) => `[${i + 1}] ${f.title}${f.extract ? ` — ${f.extract.split(" — ")[0]}` : ""}`).join("\n") +
            `\n\nCITATION RULE (NON-NEGOTIABLE): every current/news fact you state MUST carry its source number as an inline marker — for example: "The Fed held rates steady [1]." Use [N] markers exactly as numbered above. Never state a news or current fact without its [N] marker. Never claim "live" or "just pulled" data without markers. State every concrete figure the findings contain (rates, scores, percentages, outcomes) WITH its [N] citation — never decline to give a figure that appears in the findings. When you cite a source, NAME the outlet/publisher in the answer text (for example: \"according to Reuters [2]\") — never leave a bare marker on an unnamed redirect. PREFER citing the specific article-level URLs in the findings over bare publisher homepages — when both exist for a claim, cite the article URL. When summarizing multiple news stories in a list, cover at most 6 items, COMPLETE every item (never cut a list mid-entry), and never end the answer mid-list. EVERY bullet in a news-summary list must carry a specific dated fact — the event, its date, and a concrete number or name — never a generic topic-only bullet. If the findings genuinely do not answer the question, answer from your own knowledge without guessing current facts — and NEVER mention the findings, your sources, or your retrieval process in the answer (no commentary about which sources were or weren't relevant); just answer the question directly.`;
        }
      } catch (e) { /* research failed — continue without */ }
    }

    // ============================================================
    // AGENT 2: CEO SYSTEM PROMPT (adaptive — no context pollution)
    // ============================================================
    // Only inject Brett's ecosystem context when the question is actually
    // about his system. General questions get a clean expert prompt so
    // answers don't leak internal data or off-topic follow-ups.
    const systemKeywords = /comptrove|rentspire|spaincos|spain companies|shmt|spain-runner|spain runner|the gateway|ai\.spaincos|property_facts|rent observ|my (data|system|terminal|connections|ux|site|app|portfolio|properties|rents|products|companies|infrastructure|jobs|runner|pipelines)|the (terminal|data universe|runner)|this ux|bulk job|harvest|our (data|systems?|platform)/i;
    const ADMIN_EMAIL = "bspain@spaincos.com";
    const isAdmin = userEmail === ADMIN_EMAIL;
    // 2026-11-07 FIX: isAdmin no longer force-injects the ecosystem prompt on
    // EVERY question — that leaked Comptrove into unrelated answers (CPI follow-ups
    // citing "your own Comptrove dataset"). The system prompt now applies only
    // when the question is actually about the user's system; the per-user context
    // block (their account, assets, ingested email) still always applies.
    const isSystemQuestion = systemKeywords.test(userQuery) || messages.some(m => typeof m.content === "string" && systemKeywords.test(m.content));

    const now = new Date();
    const todayStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const generalSystemPrompt = `You are an expert AI assistant and researcher — combining the depth of Perplexity, Claude, and GPT — serving an authenticated member on a private platform.

TODAY'S DATE: ${todayStr}. Use this for every time-sensitive judgment — never claim a dated event "has not happened yet" if its date is before today.

Answer the user's question directly and completely:
- Lead with the direct answer in the first sentence or two — never open with a redundant title heading that repeats the first line.
- Use clean markdown: short paragraphs, ## headings for sections, bullet lists, and tables or code blocks where they genuinely help.
- Be accurate and specific. If you are uncertain, say so plainly — never invent facts, statistics, quotes, or sources.
- Match depth to the question: a simple factual question gets a concise answer; a complex one gets a thorough structured breakdown.
- When NUMBERED SOURCES are provided in the prompt, cite them with their [N] markers inline — never omit citations for current facts. Otherwise, include links only when you are confident they exist; never fabricate URLs.
- Do NOT discuss yourself, your reasoning process, any "intent", "agents", "classifiers", or system internals. Just answer.
- You have NO tools in this conversation. Never write tool-call syntax, code fences around tool names like web_search, or commentary about tools being unavailable — when numbered sources are provided, use them; otherwise answer from your own knowledge.
- End with "## Suggested Follow-ups" containing 3-4 short, specific, natural next questions a curious person would ask.
- Never volunteer disclaimers about data you lack or analyses you can't do — just answer fully with what you have; mention limits only when directly asked or truly essential to the answer.
- Write in the same language the user used.`;

    const ceoSystemPrompt = isSystemQuestion
      ? `You are the senior AI assistant for ai.spaincos.com — an expert on this organization's systems. You mirror the best of Anthropic Claude, OpenAI GPT, and Perplexity.

=== USER'S SYSTEM (COMPLETE CONTEXT) ===
Brett Spain — founder of Spain Companies LLC. Products: Comptrove (rent-comparison), RentSpire (housing software), Spain Terminal (SHMT), ai.spaincos.com (this gateway).

INFRASTRUCTURE:
- ai.spaincos.com: this gateway (Vercel, GitHub: rentspire-bspain/ai-gateway-site)
- Supabase bnxermyboeigvwonfrzx: auth
- Supabase dcyjmftriqayqaonitlx: THE DATA (Comptrove, 5.5M property_facts, 30.9M observations)
- Fly.io spain-runner: bulk jobs (no 2-min timeout)
- GitHub org rentspire-bspain: SHMT, ai-gateway-site, rentspire-comps

DATA UNIVERSE:
- 588,746 properties (2026), 13.76M observations, 1.4M URLs, median rent $1,956
- 30.9M total observations (1997-2026)
- hist.property_facts: 5.5M rows
- Gaps: ZIP (228K filled), unit_count_hint (5.3M missing, runner job created), amenities, photos

When the user says "this UX," "the terminal," "my connections," "Comptrove," "the data," or similar — they mean THEIR OWN system.

=== STANDARDS (NON-NEGOTIABLE) ===
1. Ground every claim in the user's actual system data above. If you don't know, say so — never guess.
2. Deliver the FULL, COMPLETE, BEST answer. Cover all aspects thoroughly.
3. Use specific numbers and data from the user's system.
4. Perfect markdown: clear ## and ### headings, double line breaks between paragraphs (NEVER jumbled), proper lists, tables where appropriate, bold for key terms.
5. End with "## Suggested Follow-ups" — 3-4 SPECIFIC, contextual questions.
6. Do NOT discuss yourself, your "agents", "classifiers", or reasoning process. Just deliver the answer.
7. Only reference the user's systems, data, or products when the question actually concerns them — NEVER shoehorn them into unrelated answers (news, general knowledge, math), never append "relevance to your data" sections unprompted, and NEVER put them in the Suggested Follow-ups of an unrelated answer.`
      : generalSystemPrompt;

    const messagesWithContext = [{ role: "system", content: ceoSystemPrompt + userContextBlock + researchContext }, ...messages];

    // ============================================================
    // AGENT 3: WRITING AGENT (produces the structured response)
    // ============================================================
    const capped = messagesWithContext.slice(-21).map((m) => ({
      role: m.role === "assistant" || m.role === "user" || m.role === "system" ? m.role : "user",
      content: String(m.content || "").slice(0, 4000)
    }));

    // ============================================================
    // AGENT 2.9: TOOL LOOP (agentic function calling; off unless TOOL_LOOP=1)
    // ============================================================
    // Skipped for simple intents, free/Groq models, client opt-out, and when call-model
    // cannot pass tools. NEVER throws: any failure leaves the normal writing + QA path untouched.
    let toolLoop: Awaited<ReturnType<typeof runToolLoop>> | null = null;
    let toolLoopSkip = "";
    try {
      const gate = shouldRunToolLoop({
        complexity: intent.complexity, model: finalModel, stream: stream === true,
        query: String(userQuery), intent, clientOptOut: tool_loop === false
      });
      if (gate.run) {
        toolLoop = await runToolLoop({
          callModelUrl, model: finalModel, purpose, baseMessages: capped,
          maxTokens: Math.min(Number(max_tokens) || 1500, 2500),
          reuseFinal: false,              // NEVER reuse the loop's own final: GLM tool-calls are flaky through call-model (mangled "ToolCall" prefixes, CJK confusion text). The loop gathers evidence; the writing path answers.
          gatewayToken: Deno.env.get("GATEWAY_TOKEN") || undefined,
          ctx: {
            supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "https://bnxermyboeigvwonfrzx.supabase.co",
            anonKey: sbAnonKey, userToken: token, userEmail, isAdmin, userQuery: String(userQuery)
          }
        });
        // Evidence goes in as its own system message (index 1) so the 4,000-char per-message cap above
        // cannot truncate it, and so every QA retry (which re-sends `capped`) still sees the tool results.
        if (toolLoop.evidence) capped.splice(1, 0, { role: "system", content: toolLoop.evidence });
      } else {
        toolLoopSkip = gate.reason || "";
      }
    } catch (_e) { toolLoop = null; /* loop failed: continue with the normal path */ }
    // STREAMING MODE: pipe the model's SSE straight through to the client.
    // QA retries can't run mid-stream, so the completeness nudge is pre-applied.
    let res: Response;
    let data: any;
    if (stream === true) {
      const streamMessages = intent.complexity === "simple"
        ? capped
        : [...capped, { role: "system", content: "Keep the answer COMPLETE within the token budget — concise, no filler — and finish with the Suggested Follow-ups section." }];
      const sres = await fetch(callModelUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: streamMessages, purpose, model: finalModel, max_tokens: Math.min(Number(max_tokens) || 2048, 2500), stream: true }),
        signal: AbortSignal.timeout(90_000)
      });
      const ct = sres.headers.get("content-type") || "";
      if (sres.ok && ct.includes("text/event-stream") && sres.body) {
        // Pipe the token stream straight through — the client renders deltas live
        return new Response(sres.body, { headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "x-model": finalModel } });
      }
      // Upstream didn't stream (fallback) — continue via the normal path
      res = sres;
      data = await sres.json();
    } else if (toolLoop?.finalData) {
      // The loop already produced the plain-text answer with the same system prompt, user context,
      // research findings and tool results. Reuse it; QA below runs on it exactly as before.
      res = new Response(null, { status: 200 });
      data = toolLoop.finalData;
      delete data.x_tools_passthrough;
    } else {
      res = await fetch(callModelUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: capped, purpose, model: finalModel, max_tokens: Math.min(Number(max_tokens) || 1500, 2500) }),
        signal: AbortSignal.timeout(90_000)
      });
      data = await res.json();
    }

    // ============================================================
    // AGENT 4: QA AGENT (verifies and polishes if needed)
    // ============================================================
    let finalResponse = data;
    let content = data?.choices?.[0]?.message?.content || "";
    const finishReason = data?.choices?.[0]?.finish_reason || "";

    // QA check 0: empty OR truncated content — retry once with the full token budget.
    // Reasoning models can burn the whole max_tokens budget on reasoning and
    // return content=null, or cut the answer off mid-sentence (finish_reason=length).
    const looksTruncated = content.length > 0 && !/[.!?:\"'\u201d\u2019)]\s*$/.test(content.trim());
    if (!content || finishReason === "length" || (looksTruncated && content.length > 400 && intent.complexity !== "simple")) {
      // If truncated (not blank), instruct the model to complete more concisely
      // so the full answer fits the budget instead of truncating again.
      // Guarded: a failed retry must NEVER 500 the request — fall back to the
      // original answer (truncated but present) instead.
      try {
      const retryMessages = finishReason === "length" && content
        ? [...capped, { role: "system", content: "Your previous response was cut off by the token limit. Rewrite the COMPLETE answer in UNDER 500 WORDS — remove all filler, repetition, and padding, keep only the essential points and the most important specifics. You MUST finish with the Suggested Follow-ups section." }]
        : capped;
      const retryRes = await fetch(callModelUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Retry with the SAME purpose at the full budget plus a hard word limit —
        // the word limit also shrinks the reasoning burn, so the answer completes.
        // (Do NOT route retries to the "summary" purpose — that model is on a
        // ~1,000-token-per-minute Groq rate limit and silently fails.)
        body: JSON.stringify({ messages: retryMessages, purpose, model: finalModel, max_tokens: 2500 }),
        signal: AbortSignal.timeout(90_000)
      });
      const retryData = await retryRes.json();
      const retryContent = retryData?.choices?.[0]?.message?.content || "";
      const retryFinish = retryData?.choices?.[0]?.finish_reason || "";
      // Prefer a COMPLETE answer (finish=stop) over a truncated one, even if
      // the truncated one is longer. Otherwise prefer the longer answer.
      if (retryContent.length > content.length || (retryFinish === "stop" && finishReason === "length")) {
        finalResponse = retryData;
        content = retryContent;
      }
      } catch (e) { /* retry failed — keep the original answer, never 500 */ }
    }
    
    // QA check 1: too short for complex questions (guarded — failed QA retries never 500)
    if (content.length < 300 && intent.complexity !== "simple") {
      try {
      const retryRes = await fetch(callModelUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...capped, { role: "system", content: "QA REVIEW: Your previous response was too brief. Provide the complete, comprehensive answer with all relevant sections, data, and follow-ups. Professional, helpful tone." }], purpose, model: finalModel, max_tokens: 2500 }),
        signal: AbortSignal.timeout(90_000)
      });
      const retryData = await retryRes.json();
      if ((retryData?.choices?.[0]?.message?.content || "").length > content.length) {
        finalResponse = retryData;
      }
      } catch (e) { /* keep original */ }
    }
    
    // QA check 2: no headings in a complex response (guarded)
    const finalContent = finalResponse?.choices?.[0]?.message?.content || "";
    if (!finalContent.includes("##") && intent.complexity !== "simple") {
      try {
      const fixRes = await fetch(callModelUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...capped, { role: "system", content: "QA REVIEW: Your previous response lacked proper markdown structure. Restructure with clear headings (##, ###), sections, and lists. Professional, helpful tone." }], purpose, model: finalModel, max_tokens: 2500 }),
        signal: AbortSignal.timeout(90_000)
      });
      const fixData = await fixRes.json();
      if ((fixData?.choices?.[0]?.message?.content || "").includes("##")) {
        finalResponse = fixData;
      }
      } catch (e) { /* keep original */ }
    }

    // QA check 2.5: TOOL-SYNTAX / SELF-DIALOGUE LEAK. Any answer that contains
    // role-played tool calls (fenced "web_search(...)" blocks) or scratch monologue
    // ("Wait — I already have the results… let me try once more") is NOT a final
    // answer. Scrub the tool-call blocks; if the residue still reads as scratch,
    // retry once demanding a clean final answer.
    {
      const curContent = finalResponse?.choices?.[0]?.message?.content || "";
      const toolSyntax = /```\s*[a-z_]*\s*\n?\s*(web_search|calculator|search_my_context|query_comptrove)\s*\(/i.test(curContent)
        || /^\s*[^\w\n]{0,3}\s*(web_search|calculator|search_my_context|query_comptrove)\s*\(/im.test(curContent)
        || /[^\w\n]{0,3}(web_search|calculator|search_my_context|query_comptrove)\s*\(\s*"/.test(curContent)
        || /\b(web_search|query_comptrove|search_my_context)\b/i.test(curContent);
      const selfDialogue = /^\s*(wait|hm+|ok+|alright|let me|I('ll| will| already| need| just| don't)\b)/im.test(curContent.trim())
        && /(let me try|one more|already (have|made)|finali[sz]e|didn't return usable)/i.test(curContent);
      if (toolSyntax || selfDialogue) {
        try {
          const cleanRes = await fetch(callModelUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: [...capped, { role: "system", content: "QA REVIEW: Your previous response contained tool-call syntax or working notes to yourself. Produce ONLY the clean final answer for the user: no tool calls, no code fences around tool names, no monologue about searching or verifying, no mention of what you could not retrieve unless it is essential. Start directly with the answer." }], purpose, model: finalModel, max_tokens: 2500 }),
            signal: AbortSignal.timeout(90_000)
          });
          const cleanData = await cleanRes.json();
          const cleanText = cleanData?.choices?.[0]?.message?.content || "";
          const stillDirty = /```\s*[a-z_]*\s*\n?\s*(web_search|calculator|search_my_context|query_comptrove)\s*\(/i.test(cleanText) || /^\s*[^\w\n]{0,3}\s*(web_search|calculator|search_my_context|query_comptrove)\s*\(/im.test(cleanText);
          if (cleanText.length > 80) finalResponse = cleanData; // scrub below removes any residue
        } catch (e) { /* keep original */ }
      }
    }

    // QA check 3: research findings exist but the answer cites NONE of them.
    // (Seen on simple-intent news questions: correct facts, zero [N] markers,
    // so the client renders no Sources section at all.) Retry once demanding
    // inline citations. Guarded — a failed retry never 500s.
    {
      const curContent = finalResponse?.choices?.[0]?.message?.content || "";
      if (researchFindings.length && curContent.length > 80 && !/\[\d+\]/.test(curContent)) {
        try {
          const citeRes = await fetch(callModelUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: [...capped, { role: "system", content: "QA REVIEW: Your previous response cited no sources. Rewrite it with inline [N] citation markers for every factual claim drawn from the numbered findings (for example: \"The Seahawks won 29–13 [1].\"). Keep the same content, structure, and length." }], purpose, model: finalModel, max_tokens: 2500 }),
            signal: AbortSignal.timeout(90_000)
          });
          const citeData = await citeRes.json();
          const citeText = citeData?.choices?.[0]?.message?.content || "";
          if (/\[\d+\]/.test(citeText) && citeText.length > 80) {
            finalResponse = citeData;
          }
        } catch (e) { /* keep original */ }
      }
    }

    // FINAL SCRUB (last resort): strip any role-played tool-call blocks that still
    // slipped through QA — including UNCLOSED fences (an opening fence with a
    // web_search call and no closing fence), bare call lines, and "my tools are not
    // available" meta commentary.
    // Never leaves tool syntax or scratch monologue in a user answer.
    if (finalResponse?.choices?.[0]?.message?.content) {
      const scrubbed = (finalResponse.choices[0].message.content as string)
        .replace(/```\s*[a-z_]*\s*\n?\s*(?:web_search|calculator|search_my_context|query_comptrove)\s*\([\s\S]*?\n?```/gi, "")
        .replace(/```[^\n]{0,4}(?:web_search|calculator|search_my_context|query_comptrove)\s*\([^\n]*/gi, "")
        .replace(/```\s*[a-z_]*\s*\n?\s*(?:web_search|calculator|search_my_context|query_comptrove)\s*\([^\n]*/gi, "")
        .replace(/^\s*[^\w\n]{0,3}\s*(?:web_search|calculator|search_my_context|query_comptrove)\s*\([^\n]*\)?\s*$/gim, "")
        .replace(/[^\w\n]{0,3}(?:web_search|calculator|search_my_context|query_comptrove)\s*\(\s*"[^"]*"\s*\)/g, "")
        .replace(/^[^\n]*(?:tools (?:used|available|called)[^\n]*(?:not available|are unavailable|weren'?t)|answer[^\n]*directly without (?:web search|context tools))[^\n]*\n?/gim, "")
        .replace(/^\s*(?:wait|hm+|let me (?:try|check|search|finalize))[^\n]*\n/gim, "")
        .replace(/^[^\n]*\b(?:web_search|query_comptrove|search_my_context)\b[^\n]*\n?/gim, "")
        .replace(/^\s*[^\w\s\n"'\u201c\[(#*>_\-=.:,;!?\u2014\u2013-]{1,8}\s*/u, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      if (scrubbed.length > 40) finalResponse.choices[0].message.content = scrubbed;
    }

    // NUMBERED CITATIONS -> real links (Perplexity-style): [N] becomes a clickable marker
    if (researchFindings.length && finalResponse?.choices?.[0]?.message?.content) {
      let cited = finalResponse.choices[0].message.content as string;
      const used: number[] = [];
      researchFindings.forEach((f, i) => {
        const re = new RegExp(`\\[${i + 1}\\]`, "g");
        if (re.test(cited)) { used.push(i + 1); }
        cited = cited.replace(re, `[[${i + 1}](${f.url})]`);
      });
      if (used.length) {
        const outlet = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "source"; } };
        cited += "\n\n## Sources\n\n" + used.map(n => `${n}. [${researchFindings[n - 1].title} — ${outlet(researchFindings[n - 1].url)}](${researchFindings[n - 1].url})`).join("\n");
      }
      finalResponse.choices[0].message.content = cited;
    }

    if (finalResponse && typeof finalResponse === "object") {
      finalResponse.x_tool_loop = toolLoop
        ? { rounds: toolLoop.rounds, used: toolLoop.used, reused_final: !!toolLoop.finalData, tools: toolLoop.trace, skipped: toolLoop.skipped ?? null }
        : { skipped: toolLoopSkip || null };
    }

    // If an image was generated, include it in the response
    if (imageUrl) {
      const currentContent = finalResponse?.choices?.[0]?.message?.content || "";
      finalResponse.choices[0].message.content = currentContent + "\n\n## Generated Image\n\n![Generated image](" + imageUrl + ")\n\n*Image generated by Pollinations.ai (free tier)*\n";
    }

    return new Response(JSON.stringify(finalResponse), { status: res.status, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
