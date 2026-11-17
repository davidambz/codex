// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import type { Platform } from "@iaframe/core";
import type { IaframeDesktopApi } from "../shared/api";

declare global {
  interface Window {
    iaframe: IaframeDesktopApi;
  }
}

/** Adapts the preload bridge (window.iaframe) to the shared Platform port. */
export function createDesktopPlatform(api: IaframeDesktopApi = window.iaframe): Platform {
  return {
    kind: "desktop",
    appVersion: api.appVersion,
    search: (query, limit) => api.search(query, limit),
    getItem: (name) => api.getItem(name),
    getDropsDeep: (name) => api.getDropsDeep(name),
    getSource: (key) => api.getSource(key),
    getDataStatus: () => api.getDataStatus(),
    updateData: () => api.updateData(),
    onDataStatus: (listener) => api.onDataStatus(listener),
    getSystemTheme: () => api.getTheme(),
    onSystemThemeChange: (listener) => api.onThemeChange(listener),
    getSystemLocale: () => api.getLocale(),
  };
}
