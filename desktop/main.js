"use strict";
/* ai.spaincos desktop shell (scaffold).
 * A thin Electron window around https://ai.spaincos.com so the web app gets what a browser tab cannot:
 * a global hotkey, a tray icon, a single instance, and aispaincos:// deep links.
 * All product logic stays in the web app (modules/desktop-shell.js reads ?source=desktop-hotkey etc.).
 * Status: NOT built, NOT signed, NOT released. Signing/notarization certificates are owner-gated. */
const { app, BrowserWindow, Menu, Tray, globalShortcut, shell, nativeImage } = require("electron");
const path = require("path");

const ORIGIN = process.env.AI_SPAINCOS_ORIGIN || "https://ai.spaincos.com";
const ALLOWED_HOSTS = new Set([new URL(ORIGIN).host, "ai.spaincos.com", "boundview.com"]);
const HOTKEY = "CommandOrControl+Shift+Space";
const SCHEME = "aispaincos";

let win = null;
let tray = null;
let quitting = false;

function isAllowed(url) {
  try { const u = new URL(url); return u.protocol === "https:" && ALLOWED_HOSTS.has(u.host); } catch (e) { return false; }
}

// aispaincos://ask?q=hello  ->  https://ai.spaincos.com/?q=hello&source=desktop-link
function deepLinkToUrl(link) {
  try {
    const u = new URL(link);
    if (u.protocol !== SCHEME + ":") return null;
    const q = u.searchParams.get("q") || decodeURIComponent((u.pathname || "").replace(/^\/+/, ""));
    const target = new URL("/", ORIGIN);
    if (q) target.searchParams.set("q", q.slice(0, 4000));
    target.searchParams.set("source", "desktop-link");
    return target.toString();
  } catch (e) { return null; }
}

function createWindow(startUrl) {
  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 720, minHeight: 520,
    backgroundColor: "#f7f7f5",
    title: "ai.spaincos",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.webContents.setUserAgent(win.webContents.getUserAgent() + " AiSpaincosDesktop/" + app.getVersion());
  win.loadURL(startUrl || ORIGIN + "/?source=desktop");
  // external links open in the system browser; the app never navigates away from allowed hosts
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowed(url)) return { action: "allow" };
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!isAllowed(url)) { e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); }
  });
  // closing hides to tray so the hotkey stays available; Quit from the tray menu really exits
  win.on("close", (e) => { if (!quitting) { e.preventDefault(); win.hide(); } });
}

function showWindow(url) {
  if (!win) createWindow(url); else if (url) win.loadURL(url);
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function createTray() {
  const icon = nativeImage.createEmpty(); // replace with a packaged template icon before release
  tray = new Tray(icon);
  tray.setToolTip("ai.spaincos");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Open ai.spaincos", click: () => showWindow() },
    { label: "New thread", click: () => showWindow(ORIGIN + "/?intent=new&source=desktop-tray") },
    { type: "separator" },
    { label: "Quit", click: () => { quitting = true; app.quit(); } }
  ]));
  tray.on("click", () => showWindow());
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_e, argv) => {
    const link = argv.find((a) => a.startsWith(SCHEME + "://"));
    showWindow(link ? deepLinkToUrl(link) : undefined);
  });
  app.on("open-url", (e, link) => { e.preventDefault(); showWindow(deepLinkToUrl(link)); }); // macOS
  app.on("before-quit", () => { quitting = true; });
  app.whenReady().then(() => {
    app.setAsDefaultProtocolClient(SCHEME);
    createWindow();
    createTray();
    globalShortcut.register(HOTKEY, () => showWindow(ORIGIN + "/?source=desktop-hotkey"));
  });
  app.on("will-quit", () => globalShortcut.unregisterAll());
  app.on("window-all-closed", () => { /* stay in tray */ });
  app.on("activate", () => showWindow());
}

module.exports = { isAllowed, deepLinkToUrl };
