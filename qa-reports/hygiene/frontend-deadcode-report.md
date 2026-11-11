# Frontend dead-code and stale-cache audit

Audited `/home/user/workspace/ai-gateway-site`, HEAD `4dcaa0e`, on 2026-11-11. This is a static source audit, not browser coverage; existing concurrent modifications to docs-panel CSS/JS, fleet.js, and QA files were preserved. No source changes, commits, or pushes were made.

## Executive findings

- **No production module orphans confirmed:** all 66 files under `modules/` are accounted for below, including three intentional test files. There is no `js/` directory in this checkout.
- **High-priority route hazard:** lazy asset URLs in `index.html:4952,4963,4979` are relative (`modules/...`). On `/t/<slug>`, they resolve to `/t/modules/...`, not `/modules/...`. The document has no base URL override, and `spa-restore.js` restores the thread pathname before later loading. This is a statically confirmed URL-resolution defect; browser/network reproduction was not performed.
- **Do not clear `ai_sw_reset_98` yet:** its read/write path is still live in `index.html:4848-4859`. Deleting it re-arms origin-wide service-worker unregister/cache purge/reload behavior.
- **CSP passes:** original `--check` exits 0; regeneration on a temporary copy is byte-identical and its subsequent check exits 0. All three inline scripts match the CSP hashes.
- **CSS waste is small in the requested sample:** no unmatched class families after accounting for generated fleet status classes. One redundant `.dp-code pre` rule is removable.

## Complete module inventory and reachability

All paths in this section are relative to `modules/`. Being reachable is not a guarantee that every branch executes; the deep-route loader defect can prevent otherwise reachable assets loading.

| Loading evidence | Every file covered |
|---|---|
| Direct script tags, `index.html:4919-4943` | `settings.js`, `connectors.js`, `skills.js`, `artifacts.js`, `cards.js`, `tasks.js`, `monitors.js`, `research.js`, `projects.js`, `safe-url.js`, `siteassets.js`, `composerx.js`, `skills-actions.js`, `plugins.js`, `settings-security.js`, `settings-org.js`, `voice-convo.js`, `artifacts-files.js`, `artifacts-gallery.js`, `docs-panel.js`, `repo-pr.js`, `sources.js`, `media.js`, `export.js`, `tabstatus.js` |
| Direct stylesheet tags, `index.html:26-37` | `composerx.css`, `settings.css`, `connectors.css`, `artifacts.css`, `cards.css`, `research.css`, `siteassets.css`, `sources.css`, `media.css`, `export.css`, `docs-panel.css`, `voice-convo.css` |
| Lazy `MODS` registry + `loadModule`, `index.html:4948-4968`; nav handlers at 4989-4997; API keys action at 3114 | `library.js`, `library.css`, `docs.js`, `docs.css`, `discover.js`, `discover.css`, `fleet.js`, `fleet.css`, `apikeys.js`, `apikeys.css`, `hubs.js`, `hubs.css` |
| `IDLE_CSS` + `attachIdle`, `index.html:4972-4984` | `skills.css`, `projects.css`, `settings-security.css`, `settings-org.css`, `skills-actions.css`, `plugins.css`, `repo-pr.css` |
| Self-loaded by reachable modules | `tasks.css` via `tasks.js:77-78`; `monitors.css` via `monitors.js:43-44`; `media-labs.css` and `media-labs.js` via `media.js:13-16` |
| Lazy documentation data | `data/docs-claude.json`, `data/docs-openai.json`, `data/docs-perplexity.json`; `docs.js:13,186-189` constructs `/modules/data/docs-` + vendor + `.json` |
| Intentionally not browser-loaded | `fleet.test.js` (Node test importing fleet.js), `connectors.test.py`, `plugins-actions.test.py` (test harnesses constructing fixture pages) |

**Orphan list:** no confirmed production orphans. The three tests are non-runtime files, not dead production implementations; moving them to a tests directory could reduce confusion but deleting them is not justified.

The lazy-loader comment says “five overlays” but the registry contains six. Update this comment to avoid a misleading inventory. `media.css` and `voice-convo.css` have direct and self-loading paths; their guards avoid intentional duplicate loading, so these are not orphan styles.

## CSS sample and waste

Checked class tokens in the requested CSS against index.html and production module JavaScript, then manually checked dynamic class construction. Counts below are class-token inventory counts, not browser coverage percentages; pseudo-classes, responsive branches, generated HTML, and renderer-specific states cannot be declared dead from an unopened page.

| Stylesheet | Size at scan | Class tokens | Findings and evidence |
|---|---:|---:|---|
| `docs-panel.css` | 6,904 bytes | 38 | All tokens occur in production source. Major families `.dp-panel`, `.dp-tabs`, `.dp-grid`, `.dp-card`, `.dp-code`, `.dp-frame` are created by docs-panel.js. `.dp-tw` is generated at docs-panel.js:76. |
| `artifacts.css` | 7,221 bytes | 46 | All tokens occur in production source. `.artifact-card`, `.artifact-overlay`, `.artifact-code`, `.artifact-chart` belong to artifacts.js; `.artifact-export-menu` is created in artifacts-files.js:331; `.artg-*` belongs to artifacts-gallery.js. Chart `.ch-axis`/`.ch-grid` occur at artifacts.js:165-168. |
| `fleet.css` | 1,985 bytes | 23 | Literal search initially misses `.fl-s-live`, `.fl-s-paused`, `.fl-s-on_demand`, but fleet.js:57,80,109,118 constructs `fl-s-` plus status. `.fl-tree.fl-top` is generated at fleet.js:124. None is safe to remove based on token search. |

- **Confirmed redundant declarations:** docs-panel.css:64 repeats `.dp-code pre{margin:0;border:0;border-radius:0}` from line 61. Remove the later duplicate while retaining line 61's `background` and `padding`.
- **Expected overrides, not dead rules:** artifact responsive/safe-area additions intentionally override earlier base declarations. Do not blanket-delete repeated selectors.
- **No broad CSS purge recommended:** establish interaction-based coverage across overlays, narrow screens, charts, generated artifacts, downloads, and status states first.

## Local-storage inventory

The audit included direct `localStorage` calls plus wrappers (`LS`, `lsGet`, `lsSet`, `lsJSON`, `jget`, `jset`, `safeLSArray`) and computed keys. Session storage and Cache Storage are separate stores and must not be swept together.

| Keys | Current owner / evidence | Disposition |
|---|---|---|
| `ai_threads`, `ai_incognito_threads`, `ai_spaces` | index.html state/save paths; projects.js; tasks.js; library.js | Active user data. Incognito expiry is already purged at boot. |
| `ai_theme`, `voiceOn`, `sidebarWidth`, `answerWidth`, `answerWidthPx`, `artifactWidth`, `docPanelWidth` | index.html layout/theme/voice; settings.js; docs-panel.js:8,193-201 | Active preferences. `answerWidth` has a legacy-compatible reader, not a dead key. |
| `ai_personalize`, `ai_tone`, `ai_memory`, `ai_memory_items`, `ai_site_instructions` | settings.js editors; index.html:1755 onward personalization; memory import | Active preferences/user content. |
| `ai_notify_inapp`, `ai_notify_email` | settings.js:425,428 and export list | UI still reads/writes these. No delivery-side consumer found in the scanned frontend; review product semantics rather than silently deleting preferences. |
| `ai_connectors`, `ai_connectors_hint_dismissed` | settings.js:453-480; media-labs.js:152 reads connector list | Active legacy/local connector representation; not safely obsolete while these consumers exist. |
| `ai_skills`, `ai_skills_seeded` | skills.js:3-32 | Active list and seed guard. Clearing seeded state may recreate defaults. |
| `ai_plugin_skills_cache` | plugins.js:4,21-25 | Active warm-start cache. It is rebuildable, but not stale-only storage. |
| `ai_device_id` | settings-security.js:16,67-71 | Active device identity. Preserve. |
| `ai_artifacts`, `ai_artifacts_deleted` | artifacts.js:298-304; artifacts-gallery.js:13-32 | Active saved data and deletion tombstones. Deleting tombstones can revive removed entries. |
| `ai_labs_apps` | media-labs.js:9,16-17 | Active local app storage. Preserve. |
| `ai_feedback`, `ai_shares` | export.js:165-179,279-280 | Active feedback/share mappings. Preserve. |
| `ai_collections`, `ai_pins`, `ai_archived`, `ai_library_seen` | library.js:26-44,285-299 | Active library metadata. Preserve; optionally prune references to deleted thread IDs in a separate data-aware migration. |
| `ai_site_favicon`, `ai_site_logo` | siteassets.js:18,51-56,132 | Active overrides. An old-looking logo can be intentional persisted customization, not an unused image. |
| `hb_watchlist`, `hb_cities`, `hb_destinations` | hubs.js:41-68,153,171,239 | Active local fallback/user preferences. `hb_` suffix is computed. |
| `ai_sw_reset_98` | index.html:4848-4859 | Old-named but currently active reset guard. Conditional retirement only. |
| `sb-bnxermyboeigvwonfrzx-auth-token`; dynamic `sb-…-auth-token` family | Supabase auth, index.html:2897 removal; extension/site-bridge.js mirrors matching keys | Authentication, not stale flags. Never blanket-clear during hygiene. |

No key was proved to be written only by a dead production module. An exact historical-key inventory would require deployment history and/or an explicit client-storage inventory; unknown old flags must not be guessed.

### Conditional one-time cleanup

The only identified old migration marker is `ai_sw_reset_98`, and it is **not safe to remove under the current boot code**. First remove/replace that reset path, roll out and validate the new worker, and account for already-open old tabs. Then a single idempotent removal is sufficient; a new permanent “cleanup complete” marker is unnecessary.

```js
// Future release only: ship AFTER retiring every ai_sw_reset_98 reset reader.
// Do not run on the currently audited release.
try {
  localStorage.removeItem("ai_sw_reset_98");
} catch (_) {
  // Storage may be unavailable. Do not disrupt application boot.
}
```

Do not use `localStorage.clear()` or regex-delete all `ai_*`, `hb_*`, or auth keys. Do not clear `ai_plugin_skills_cache` indiscriminately: it is active and serves a pre-registry fallback.

### Related stale-data hazards

- **Incomplete erase/export inventory:** `settings.js:647-651` defines `ALL_KEYS` as a copy of the old `EXPORT_KEYS`; its “Erase everything” action at 764 clears only those keys. It leaves incognito threads, artifacts, labs apps, collections/pins/archive metadata, shares, and other newer storage behind. Centralize ownership and explicitly define local-data erase versus account/session deletion; do not solve this with an origin-wide clear.
- **Cache scope is broader than comments:** sw.js:3 still describes stale-while-revalidate, but lines 26 onward implement network-first. The handler covers every same-origin GET outside navigation, not just modules/icons/favicon. Cached successful responses can mask later non-OK network responses because `hit || r` is returned.
- **Reset race:** index.html starts unregister/cache-delete promises without awaiting their completion, reloads after a fixed 300 ms, and immediately invokes register outside that chain. Retire the migration or make its sequencing deterministic; do not re-arm it via cleanup.
- **Origin-wide deletion:** sw.js:11 deletes every Cache Storage name except `v99-modules`; the reset path also removes every registered worker/cache on the origin. Restrict future cleanup to application-owned scope/names.
- **Release consistency:** unversioned asset paths and an unchanged cache namespace permit mixed releases when some network requests succeed and others fall back. Prefer versioned asset URLs/manifest and deploy-coherent cache lifecycle. Network-first also still uses normal HTTP-cache semantics; it is not equivalent to `cache: "no-store"`.

## CSP verification

Ran `node tools/gen-csp-sri.mjs index.html --check` on the original: exit **0**. To honor report-only mode, copied index.html to a temporary directory, then ran the requested generate and check sequence against that copy; generation reported `{ inlineScripts: 3, sri: 0 }`, check exited **0**, and regenerated bytes matched the original.

Independently recomputed SHA-256 for all three inline blocks:

| Inline block | Matching CSP hash |
|---|---|
| Main application | `sha256-gFkZY1CbLDmpZp0S6pCM9ySSnjFvrJtEbYCfPlKKFeQ=` |
| Lazy-module loader | `sha256-x7mo/kGln/DkohRSHI8ExYx18GXZdsyR3IpMjSiJSww=` |
| Visibility listener | `sha256-KhRdsAMOudj/M/rrkiiEbbmnNlVHET4UskAZyPZ2WO8=` |

Inline CSP hashes are distinct from external-script SRI. The generator does not refetch/revalidate already-present external integrity attributes, so this pass does not attest to current CDN response bytes.

## Images, fonts, and SPA helpers

- **SPA helpers are both live and complementary:** 404.html loads `/spa-redirect.js`; index.html:9 loads `/spa-restore.js`. Redirect encodes pathname in `?p=`, restore rewrites thread history and applies a pre-boot skeleton. They are not duplicate dead helpers. Redirect currently preserves pathname only, so query/hash loss on initial 404 redirects is a separate routing review item.
- **App images are referenced:** favicon.webp is linked by index and manifest; icons/icon-192.png, icon-512.png, icon-maskable-512.png are manifest icons; icons/apple-touch-icon.png is linked in index.html. No unused app icon confirmed.
- **Extension icons are separate live assets:** extension/icons/icon16.png, icon32.png, icon48.png, icon128.png are referenced by extension/manifest.json. Do not remove them based on index.html alone.
- **Fonts are remote and used:** no local font files found. The sans/serif WOFF2 declarations in index.html:40-41 feed the corresponding CSS variables; the sans preload matches its declaration.
- **QA images are artifacts, not app assets:** qa-reports/prelaunch/{landing,connectors,fleet-qa,fleet,thread}.png are test outputs. Retain or expire under QA retention policy, not frontend dead-code cleanup.
- **Older extension packages merit retention review:** extension-build contains 1.0.0, 1.0.1, 1.0.2, and 1.0.3 ZIPs; the extension manifest is 1.0.3. Older versions are archival candidates, not proven unused downloads, and were not deleted.

## Prioritized fixes

- **P1: Make lazy URLs root-relative.** Change CSS, script, and prefetch construction to `/modules/`; verify every lazy overlay on both `/` and `/t/<slug>`. Regenerate CSP after editing the inline loader.
- **P1: Correct erase/export coverage.** Define and test a central storage inventory; ensure local-content erasure covers incognito and generated artifacts without accidentally wiping unrelated origin data or auth.
- **P1: Retire or sequence the SW reset safely.** Keep `ai_sw_reset_98` until no live reader can re-trigger the destructive path. Scope cache/SW deletion and remove fixed-delay races.
- **P2: Make caching release-aware.** Scope cached requests, assess HTTP cache behavior and non-OK fallback masking, and test mixed-version/offline behavior.
- **P2: Add a reachability check that understands lazy loaders.** Cover MODS, IDLE_CSS, self-loading companions, data-path construction, and non-index entry points; explicitly exclude tests.
- **P3: Remove the duplicate CSS declaration and stale comments.** No broad selector purge is justified by this audit.
- **P3: Establish retention rules for QA screenshots and old extension ZIPs.** Keep historical artifacts separate from live application assets.
