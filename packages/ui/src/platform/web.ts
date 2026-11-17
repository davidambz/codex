// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// Browser adapter for `npm run dev:web`: the Vite dev server runs the
// real data service (see vite.config.ts) and answers under /api, so the
// UI can be worked on in a browser, at any width, with real data.

import type { DataStatus, Platform, Theme } from "@iaframe/core";

async function api<T>(path: string, params: Record<string, string> = {}, method = "GET"): Promise<T> {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`/api/${path}${query ? `?${query}` : ""}`, { method });
  if (!response.ok) throw new Error(`/api/${path}: HTTP ${response.status}`);
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function createWebPlatform(): Platform {
  const listeners = new Set<(status: DataStatus) => void>();
  const dark = window.matchMedia?.("(prefers-color-scheme: dark)");
  return {
    kind: "web",
    appVersion: "dev",
    search: (query, limit = 10, kinds) =>
      api("search", { q: query, limit: String(limit), ...(kinds?.length ? { kinds: kinds.join(",") } : {}) }),
    getItem: (name) => api("item", { name }),
    getDropsDeep: (name) => api("deep", { name }),
    getSource: (key) => api("source", { key }),
    getDataStatus: () => api("status"),
    async updateData() {
      const status = await api<DataStatus>("update", {}, "POST");
      for (const listener of listeners) listener(status);
      return status;
    },
    onDataStatus(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSystemTheme: async (): Promise<Theme> => (dark?.matches === false ? "light" : "dark"),
    onSystemThemeChange(listener) {
      const onChange = (event: MediaQueryListEvent) => listener(event.matches ? "dark" : "light");
      dark?.addEventListener("change", onChange);
      return () => dark?.removeEventListener("change", onChange);
    },
    getSystemLocale: async () => navigator.language,
  };
}
