# Refreshing the Terminal corpus

The chat answers Terminal questions from a bundled corpus (supabase/functions/gateway-chat/corpus.ts), generated from the spain-terminal-shell docs plus the latest nightly anomaly snapshot. Refresh whenever those docs change materially, or after a new nightly snapshot you want reflected.

1. Update a spain-terminal-shell checkout: `git -C <checkout> pull origin master`
2. Rebuild: `python3 retrieval/build_corpus.py <checkout>` (prints chunk count and the commit it built from; the script skips any text matching secret patterns)
3. Review the diff of corpus.ts. Check the public/internal split: a doc is public only if it is in PUBLIC_DOCS in build_corpus.py; everything else defaults to internal and is shown only to OWNER_EMAILS. Adding a doc means editing DOCS (and PUBLIC_DOCS only if safe for every signed-in user).
4. If call-model defaults changed, edit retrieval/GATEWAY_FACTS.md by hand (public tier).
5. Branch, PR, merge, then redeploy gateway-chat with its files: index.ts, retrieve.ts, corpus.ts.
6. Verify: ask a known question as the owner and as a non-owner; the response field x_corpus_tier shows which tier was served.
