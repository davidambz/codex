// Codex — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

/** What the detail pane shows. */
export type View = { kind: "item"; name: string } | { kind: "source"; key: string };

export interface Navigate {
  openItem(name: string): void;
  openSource(key: string): void;
}

/** The sidebar's sections. */
export const PAGES = ["foundry", "search", "relics", "settings"] as const;
export type Page = (typeof PAGES)[number];

export function isPage(value: unknown): value is Page {
  return typeof value === "string" && (PAGES as readonly string[]).includes(value);
}
