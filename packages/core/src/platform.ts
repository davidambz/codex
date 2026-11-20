// Codex — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// What the UI needs from whatever hosts it (the Electron app, or a fake in
// the browser for layout work). The UI only ever talks to this.

import type { DataInfo, DeepDrops, EquipmentCard, ItemDetails, RelicListEntry, SourceItemRow } from "./queries.ts";
import type { SearchHit } from "./search/index.ts";
import type { ItemKind, Source } from "./types.ts";
import { isItemLanguage, type ItemLanguage } from "./catalog/names.ts";

export type Theme = "dark" | "light";

export interface SourceDetails {
  source: Source;
  drops: SourceItemRow[];
}

export interface DataStatus {
  /** Checking WFCD or rebuilding the database right now. */
  busy: boolean;
  /** The database in use; absent until the first download finishes. */
  info?: DataInfo;
  /** Last time WFCD was asked for news (ISO). */
  checkedAt?: string;
  /** How the last check ended. */
  outcome?: "up-to-date" | "updated" | "rejected" | "failed";
  /** For "failed": the error message. */
  error?: string;
}

export interface Settings {
  /** The language item names are shown in. */
  itemLanguage: ItemLanguage;
  /** Other languages search also matches names in (English and the item language always do). */
  searchLanguages: ItemLanguage[];
}

/** Settings read from disk or IPC, with anything unknown dropped. */
export function sanitizeSettings(value: unknown, fallback: Settings): Settings {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof Settings, unknown>>;
  const itemLanguage = isItemLanguage(raw.itemLanguage) ? raw.itemLanguage : fallback.itemLanguage;
  const searchLanguages = Array.isArray(raw.searchLanguages)
    ? [...new Set(raw.searchLanguages.filter(isItemLanguage))]
    : fallback.searchLanguages;
  return { itemLanguage, searchLanguages };
}

/** Every language whose names the data needs for these settings. */
export function settingsLanguages(settings: Settings): ItemLanguage[] {
  return [...new Set([settings.itemLanguage, ...settings.searchLanguages])].filter((l) => l !== "en");
}

export interface Platform {
  kind: "desktop" | "web";
  appVersion: string;
  search(query: string, limit?: number, kinds?: readonly ItemKind[]): Promise<SearchHit[]>;
  getItem(name: string): Promise<ItemDetails | undefined>;
  getDropsDeep(name: string): Promise<DeepDrops>;
  getSource(key: string): Promise<SourceDetails | undefined>;
  getDataStatus(): Promise<DataStatus>;
  /** Asks WFCD now, even if it was asked recently. */
  updateData(): Promise<DataStatus>;
  onDataStatus(listener: (status: DataStatus) => void): () => void;
  getSystemTheme(): Promise<Theme>;
  onSystemThemeChange(listener: (theme: Theme) => void): () => void;
  getSystemLocale(): Promise<string>;
  getSettings(): Promise<Settings>;
  /** Saves the change; fetches names for any new language (watch the data status). */
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
  /** English name -> name in `language`, where they differ. */
  getItemNames(language: ItemLanguage): Promise<Record<string, string>>;
  /** Every Warframe, weapon and companion, for the Foundry grid. */
  listEquipment(): Promise<EquipmentCard[]>;
  listRelics(): Promise<RelicListEntry[]>;
  /** Where the page can load a warframe-items picture from ("SomaPrime.png"). */
  imageUrl(imageName: string): string;
}
