// Codex — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import type { Platform } from "@codex/core";
import { IMAGE_SCHEME, type CodexDesktopApi } from "../shared/api";

declare global {
  interface Window {
    codex: CodexDesktopApi;
  }
}

/** Adapts the preload bridge (window.codex) to the shared Platform port. */
export function createDesktopPlatform(api: CodexDesktopApi = window.codex): Platform {
  return {
    kind: "desktop",
    appVersion: api.appVersion,
    search: (query, limit, kinds) => api.search(query, limit, kinds),
    getItem: (name) => api.getItem(name),
    getDropsDeep: (name) => api.getDropsDeep(name),
    getSource: (key) => api.getSource(key),
    getDataStatus: () => api.getDataStatus(),
    updateData: () => api.updateData(),
    onDataStatus: (listener) => api.onDataStatus(listener),
    getSystemTheme: () => api.getTheme(),
    onSystemThemeChange: (listener) => api.onThemeChange(listener),
    getSystemLocale: () => api.getLocale(),
    getSettings: () => api.getSettings(),
    updateSettings: (patch) => api.updateSettings(patch),
    getItemNames: (language) => api.getItemNames(language),
    listEquipment: () => api.listEquipment(),
    listRelics: () => api.listRelics(),
    imageUrl: (imageName) => `${IMAGE_SCHEME}://img/${encodeURIComponent(imageName)}`,
  };
}
