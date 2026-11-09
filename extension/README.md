# ai.spaincos.com Assistant (Chrome / Comet extension, Manifest V3)

- Toolbar icon opens a side panel with the ai.spaincos.com chat.
- Right-click menu: "Ask ai.spaincos.com about this page" and "Ask ai.spaincos.com about this selection". The page URL, title and any selected text (first 2,000 chars) are typed into the chat composer and sent.
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
| `manifest.json` | MV3 manifest. Permissions: sidePanel, contextMenus, storage. Host: https://ai.spaincos.com/* only. |
| `background.js` | Service worker: side panel behaviour, context menus, builds the one-line question, hands it to the panel. |
| `sidepanel.html/.js/.css` | Side panel page: iframe of the site, Reload and Open in tab buttons, delivers asks with retry and ack. |
| `site-bridge.js` | Content script on ai.spaincos.com (all frames): session mirroring and typing the ask into the composer. |
| `icons/` | 16, 32, 48, 128 px icons. |

## How it works and trade-offs
- The side panel can only host an extension page, so the page embeds the site in an iframe. The site sends no frame-blocking headers.
- Ask delivery: background stores `pendingAsk` in `chrome.storage.session`. The panel posts it to the iframe, where `site-bridge.js` accepts it only from this extension's origin, fills `#landingInput` (or the follow-up box), and dispatches Enter. The panel retries until acknowledged.
- Session mirroring: only keys matching `sb-<ref>-auth-token` are copied. The newest `expires_at` wins; sign-out in one place removes the mirrored copy and signs out the other after a reload. The mirrored token lives in the extension's local storage (same exposure as the site's own localStorage in that profile). If Supabase refresh-token rotation ever logs one copy out, sign in again.
- A page with no existing session shows the site's own sign-in dialog. Sign-in is not automated, and the extension never sees your password.

## Verify
```bash
node --check background.js sidepanel.js site-bridge.js
python3 -c "import json;json.load(open('manifest.json'))"
```

## Needs a real browser (not covered by the headless test)
- The actual right-click menu click opening the side panel (needs a real user gesture).
- Signing in with real credentials and seeing the session carry between panel and tab.
- Microphone permission inside the panel iframe, and Comet-specific side panel behaviour.
