"use strict";
// Intentionally minimal: the web app needs no Node access. contextIsolation stays on.
const { contextBridge } = require("electron");
contextBridge.exposeInMainWorld("aiSpaincosDesktop", { platform: process.platform, wrapper: true });
