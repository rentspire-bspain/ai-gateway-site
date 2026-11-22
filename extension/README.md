# ai.spaincos.com Assistant (Chrome / Comet extension, Manifest V3)

- Toolbar icon opens a side panel with the ai.spaincos.com chat.
- Keyboard shortcuts open the panel (Ctrl+Shift+S) or ask it to summarize the active HTTP(S) page (Ctrl+Shift+A). Use Command instead of Ctrl on Mac. If the browser already uses a suggested shortcut, assign a free one in its extension shortcuts settings.
- Right-click menu: "Ask ai.spaincos.com about this page" and "Ask ai.spaincos.com about this selection". The page URL, title and any selected text (first 2,000 chars) are typed into the chat composer and sent.
- Page context in the panel (v1.2.0): the strip under the header shows the active tab's title/host and any selected text, each clearly labelled, with toggles for Include page / Include selection. Type a question and press Ask: it is sent as `[Context from my browser tab — Page: "..." (url). Selected text: "..."] My question: ...`, and the exact text is previewed under the box before you send. The Summarize page button sends the same "Read and summarize this page" question as the context menu and Ctrl+Shift+A.
- Settings (v1.2.0): the Settings button picks the site (ai.spaincos.com or boundview.com only) and a model. The model list is read from the site's own model drop-down, so it never drifts. Everything is saved in `chrome.storage.local` under `settings` and re-validated on every read.
- Sign-in reuse: the Supabase session of ai.spaincos.com is mirrored through `chrome.storage.local`, so the side panel and normal tabs stay signed in together.

No changes to the site are required. Works on Chrome 114+ and Chromium-based browsers with the side panel API (Comet, Edge, Brave). Without the side panel API the toolbar icon and menu items open the site in a new tab instead.

## Install (load unpacked)
1. Open `chrome://extensions` (Comet: `comet://extensions`) and turn on Developer mode.
2. Click Load unpacked and pick the `extension/` folder (or unzip `extension-build/ai-spaincos-assistant-1.0.0.zip` and pick the unzipped folder).
3. Pin the extension. Click its icon to open the side panel.
4. Sign in once, in the panel or in a normal ai.spaincos.com tab. The other copy picks the session up on its next load.

## Files
| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest. Hosts: ai.spaincos.com and boundview.com only. `activeTab` + `scripting` read the active tab's title/URL/selection; broader page access is an optional permission the user grants from the panel. `declarativeNetRequest` is used for one rule (see below). |
| `lib.js` | Shared pure helpers (settings validation, question builders, frame rule) used by the service worker, the panel and the node tests. |
| `background.js` | Service worker: side panel behaviour, context menus, shortcuts, update check, installs the frame rule. |
| `sidepanel.html/.js/.css` | Side panel page: iframe of the site, page context strip, Ask / Summarize page, Settings, delivery with retry and ack. |
| `site-bridge.js` | Content script on the two site origins (all frames): session mirroring, applying the chosen model, typing the ask into the composer. |
| `icons/` | 16, 32, 48, 128 px icons. |

## How it works and trade-offs
- The side panel can only host an extension page, so the page embeds the site in an iframe. Since the 2026-11-22 security headers (`X-Frame-Options: DENY`, CSP `frame-ancestors 'none'`) a plain iframe is refused, so the extension installs one dynamic declarativeNetRequest rule that removes those two headers only for sub-frames requested by this extension's own pages (`initiatorDomains` = its id). Normal tabs keep the full headers. If you later allow framing server-side, the rule becomes a harmless no-op.
- Ask delivery: background stores `pendingAsk` in `chrome.storage.session`. The panel posts it to the iframe, where `site-bridge.js` accepts it only from this extension's origin, fills `#landingInput` (or the follow-up box), and dispatches Enter. The panel retries until acknowledged.
- Session mirroring: only keys matching `sb-<ref>-auth-token` are copied. The newest `expires_at` wins; sign-out in one place removes the mirrored copy and signs out the other after a reload. The mirrored token lives in the extension's local storage (same exposure as the site's own localStorage in that profile). If Supabase refresh-token rotation ever logs one copy out, sign in again.
- A page with no existing session shows the site's own sign-in dialog. Sign-in is not automated, and the extension never sees your password.

## Verify
```bash
node --check background.js lib.js sidepanel.js site-bridge.js
python3 -c "import json;json.load(open('manifest.json'))"
```

## Tests
`NODE_PATH=<dir with jsdom>/node_modules node --test tests/extension.test.js` (repo root). Mocks `chrome.*`; the panel and content script run in jsdom. No real browser is involved.

## Needs a real browser (not covered by the headless test)
- The actual right-click menu click opening the side panel (needs a real user gesture).
- Signing in with real credentials and seeing the session carry between panel and tab.
- Microphone permission inside the panel iframe, and Comet-specific side panel behaviour.
