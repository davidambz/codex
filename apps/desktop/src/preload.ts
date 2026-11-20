// Codex — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { DataStatus, Theme } from "@codex/core";
import { IPC, type CodexDesktopApi } from "./shared/api";

function argValue(name: string): string | undefined {
  const prefix = `--codex-${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function subscribe<T>(channel: string, listener: (value: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, value: T) => listener(value);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const api: CodexDesktopApi = {
  appVersion: argValue("version") ?? "0.0.0",
  search: (query, limit, kinds) => ipcRenderer.invoke(IPC.search, query, limit, kinds ? [...kinds] : undefined),
  getItem: (name) => ipcRenderer.invoke(IPC.getItem, name),
  getDropsDeep: (name) => ipcRenderer.invoke(IPC.getDropsDeep, name),
  getSource: (key) => ipcRenderer.invoke(IPC.getSource, key),
  getDataStatus: () => ipcRenderer.invoke(IPC.getDataStatus),
  updateData: () => ipcRenderer.invoke(IPC.updateData),
  onDataStatus: (listener) => subscribe<DataStatus>(IPC.dataStatus, listener),
  getTheme: () => ipcRenderer.invoke(IPC.getTheme),
  onThemeChange: (listener) => subscribe<Theme>(IPC.themeChanged, listener),
  getLocale: () => ipcRenderer.invoke(IPC.getLocale),
  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  updateSettings: (patch) => ipcRenderer.invoke(IPC.updateSettings, patch),
  getItemNames: (language) => ipcRenderer.invoke(IPC.getItemNames, language),
  listEquipment: () => ipcRenderer.invoke(IPC.listEquipment),
  listRelics: () => ipcRenderer.invoke(IPC.listRelics),
};

contextBridge.exposeInMainWorld("codex", api);
