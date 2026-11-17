// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import fs from "node:fs";
import path from "node:path";
import { app, BrowserWindow, ipcMain, nativeTheme, screen, session, shell } from "electron";
import { ITEM_KINDS, type DataStatus, type ItemKind, type Theme } from "@iaframe/core";
import { createDataService, type DataService } from "@iaframe/store";
import { IPC } from "../shared/api";

const devServerUrl = process.env.VITE_DEV_SERVER_URL;
// WFCD is asked on start and then this often; the check itself is ~100 bytes.
const CHECK_EVERY_MS = 24 * 60 * 60 * 1000;

let mainWindow: BrowserWindow | null = null;
let data: DataService | null = null;

if (!app.requestSingleInstanceLock()) app.quit();

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

function currentTheme(): Theme {
  return nativeTheme.shouldUseDarkColors ? "dark" : "light";
}

function backgroundFor(theme: Theme) {
  // Matches --color-bg in tokens.css, so there's no white flash on open.
  return theme === "dark" ? "#141210" : "#e9e6e1";
}

function broadcast(channel: string, value: unknown) {
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send(channel, value);
}

function startData(): DataService {
  const service = createDataService({
    dbPath: path.join(app.getPath("userData"), "iaframe.db"),
    onStatus: (status: DataStatus) => broadcast(IPC.dataStatus, status),
  });
  const check = () => void service.update();
  check();
  setInterval(check, CHECK_EVERY_MS).unref();
  return service;
}

function text(value: unknown, max = 200): string {
  if (typeof value !== "string" || value.length > max) throw new Error("expected a short string");
  return value;
}

function itemKinds(value: unknown): ItemKind[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || !value.every((kind) => ITEM_KINDS.includes(kind as ItemKind))) {
    throw new Error("expected a list of item kinds");
  }
  return value as ItemKind[];
}

function registerIpc(service: DataService) {
  ipcMain.handle(IPC.search, (_event, query: unknown, limit: unknown, kinds: unknown) =>
    service.search(
      text(query),
      typeof limit === "number" ? Math.min(Math.max(1, limit), 50) : undefined,
      itemKinds(kinds),
    ),
  );
  ipcMain.handle(IPC.getItem, (_event, name: unknown) => service.getItem(text(name)));
  ipcMain.handle(IPC.getDropsDeep, (_event, name: unknown) => service.getDropsDeep(text(name)));
  ipcMain.handle(IPC.getSource, (_event, key: unknown) => service.getSource(text(key)));
  ipcMain.handle(IPC.getDataStatus, () => service.status());
  ipcMain.handle(IPC.updateData, () => service.update(true));
  ipcMain.handle(IPC.getTheme, () => currentTheme());
  ipcMain.handle(IPC.getLocale, () => app.getPreferredSystemLanguages()[0] ?? app.getLocale());

  nativeTheme.on("updated", () => {
    const theme = currentTheme();
    for (const window of BrowserWindow.getAllWindows()) window.setBackgroundColor(backgroundFor(theme));
    broadcast(IPC.themeChanged, theme);
  });
}

// The renderer needs no browser permissions at all; Electron grants every
// one by default, so deny them all.
function denyPermissions() {
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => {
    console.warn("Denied permission request:", permission);
    callback(false);
  });
  session.defaultSession.setPermissionCheckHandler(() => false);
}

function createWindow() {
  const window = new BrowserWindow({
    ...devWindowPlacement(),
    width: 1100,
    height: 760,
    minWidth: 400,
    minHeight: 500,
    show: false,
    title: "IAFrame",
    backgroundColor: backgroundFor(currentTheme()),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      additionalArguments: [`--iaframe-version=${app.getVersion()}`],
    },
  });
  mainWindow = window;

  window.once("ready-to-show", () => window.show());
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });

  // Links (the wiki, WFCD) open in the browser; the app never navigates away.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!devServerUrl || !url.startsWith(devServerUrl)) event.preventDefault();
  });

  if (!app.isPackaged) {
    window.webContents.on("before-input-event", (_event, input) => {
      if (input.type === "keyDown" && input.key === "F12") window.webContents.toggleDevTools();
    });
  }

  if (devServerUrl) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadFile(path.join(__dirname, "../dist-renderer/index.html"));
  }

  if (!app.isPackaged && process.env.IAFRAME_CAPTURE_PNG) {
    scheduleDevCapture(window, process.env.IAFRAME_CAPTURE_PNG, process.env.IAFRAME_DEV_SCRIPT);
  }
}

/**
 * Dev-only: IAFRAME_DEV_DISPLAY=secondary opens the window on a
 * non-primary monitor (or =<index>), so automated runs stay off the
 * screen someone is using.
 */
function devWindowPlacement(): { x?: number; y?: number } {
  const wanted = app.isPackaged ? undefined : process.env.IAFRAME_DEV_DISPLAY;
  if (!wanted) return {};
  const displays = screen.getAllDisplays();
  const primaryId = screen.getPrimaryDisplay().id;
  const display =
    wanted === "secondary" ? displays.find((candidate) => candidate.id !== primaryId) : displays[Number(wanted)];
  if (!display) return {};
  return { x: display.workArea.x + 40, y: display.workArea.y + 40 };
}

/**
 * Dev-only: optionally run a script in the page (its result is printed),
 * then save a screenshot of the window and quit. Lets the UI be checked
 * from a terminal.
 */
function scheduleDevCapture(window: BrowserWindow, pngPath: string, script?: string) {
  window.webContents.once("did-finish-load", async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      if (script) {
        const result: unknown = await window.webContents.executeJavaScript(script, true);
        console.log("Dev script result:", result);
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      const image = await window.webContents.capturePage();
      fs.writeFileSync(pngPath, image.toPNG());
      console.log("Saved", pngPath);
    } catch (error) {
      console.error("Dev capture failed:", error);
    } finally {
      app.quit();
    }
  });
}

void app.whenReady().then(() => {
  denyPermissions();
  data = startData();
  registerIpc(data);
  createWindow();
});

app.on("window-all-closed", () => app.quit());
app.on("will-quit", () => data?.close());
