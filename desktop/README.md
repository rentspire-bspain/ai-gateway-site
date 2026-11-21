# ai.spaincos desktop shell (scaffold)

Status: scaffold only. Not built, not signed, not released. No installer exists yet.

A thin Electron window around https://ai.spaincos.com. The product stays in the web app; the shell adds what a browser tab cannot:

- Global hotkey Ctrl/Cmd+Shift+Space: show the window and focus the composer (`/?source=desktop-hotkey`)
- Tray icon (Open, New thread, Quit); closing the window hides to tray
- Single instance; `aispaincos://ask?q=...` deep links
- Navigation locked to ai.spaincos.com and boundview.com; everything else opens in the system browser
- User agent suffix `AiSpaincosDesktop/<version>`, which `modules/desktop-shell.js` uses to enable installed-window behavior

## Run locally

    cd desktop && npm install && npm start
    AI_SPAINCOS_ORIGIN=http://localhost:3000 npm start   # against a local server

## Before a public release (owner-gated)

1. macOS Developer ID certificate and notarization credentials; Windows code-signing certificate.
2. A packaged tray icon (template image on macOS) in place of the empty placeholder in `main.js`.
3. Decide on auto-update (electron-updater) and a download page.
4. Run on all three platforms; none of this has been executed yet.
