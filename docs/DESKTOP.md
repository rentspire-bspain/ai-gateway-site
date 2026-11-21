# Desktop parity: what ships and what is verified

Three layers, in order of reach:

1. Installable PWA (Chrome/Edge desktop, Android): `manifest.webmanifest` + `modules/pwa-install.js` (single install button, native prompt). macOS Safari 17+ gets manual "File, Add to Dock" help; iOS Safari gets Add to Home Screen help. Firefox desktop has no PWA install and shows nothing.
2. Launch surfaces, handled by `modules/desktop-shell.js`:
   - Shortcuts (right-click app icon): New thread, Search threads, Settings (`/?source=pwa-shortcut&intent=...`).
   - Share target: sharing text/title/url to the installed app prefills the composer. It never auto-sends.
   - Protocol handler `web+aispaincos:<text>` and file handler (.txt .md .csv .json, 500KB cap) open into the composer.
   - `launch_handler` focus-existing: a second launch reuses the open window via `launchQueue`.
   - Installed-window shortcuts: Ctrl/Cmd+Shift+O new thread, Ctrl/Cmd+, settings (only in an installed window; `/`, Cmd/Ctrl+K and j/k already exist).
3. Offline: `sw.js` v3 precaches `offline.html` and the desktop shell; the app shows an offline/back-online bar; cached app shell opens offline with saved threads.
4. Desktop wrapper scaffold: `desktop/` (Electron). Not built or signed. See `desktop/README.md`.

## Verification status (honest)

- Verified: pure launch parsing and manifest/SW wiring (`node --test tests/desktop-shell.test.js`), `node --check` on every changed module, a stubbed-DOM smoke run of `desktop-shell.js`, CSP check, and live curl of the deployed files after merge.
- NOT verified (no browser in this lane): the actual install prompt, shortcut menus, share sheet, protocol/file handler registration, offline behavior in a real browser, the Electron app running.
- Known remaining gaps: signed installers, window-controls-overlay titlebar, store screenshots in the manifest, auto-update.
