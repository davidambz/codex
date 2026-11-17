// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import type {
  DataStatus,
  DeepDrops,
  EquipmentCard,
  ItemDetails,
  RelicListEntry,
  ItemKind,
  ItemLanguage,
  SearchHit,
  Settings,
  SourceDetails,
  Theme,
} from "@iaframe/core";

export const IPC = {
  search: "data:search",
  getItem: "data:item",
  getDropsDeep: "data:drops-deep",
  getSource: "data:source",
  getDataStatus: "data:status",
  updateData: "data:update",
  dataStatus: "data:status-changed",
  getTheme: "system:theme",
  themeChanged: "system:theme-changed",
  getLocale: "system:locale",
  getSettings: "settings:get",
  updateSettings: "settings:update",
  getItemNames: "data:item-names",
  listEquipment: "data:equipment",
  listRelics: "data:relics",
} as const;

/** Pictures are served under this scheme: iaframe-img://img/SomaPrime.png. */
export const IMAGE_SCHEME = "iaframe-img";

/** What the preload exposes as window.iaframe. */
export interface IaframeDesktopApi {
  appVersion: string;
  search(query: string, limit?: number, kinds?: readonly ItemKind[]): Promise<SearchHit[]>;
  getItem(name: string): Promise<ItemDetails | undefined>;
  getDropsDeep(name: string): Promise<DeepDrops>;
  getSource(key: string): Promise<SourceDetails | undefined>;
  getDataStatus(): Promise<DataStatus>;
  updateData(): Promise<DataStatus>;
  onDataStatus(listener: (status: DataStatus) => void): () => void;
  getTheme(): Promise<Theme>;
  onThemeChange(listener: (theme: Theme) => void): () => void;
  getLocale(): Promise<string>;
  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
  getItemNames(language: ItemLanguage): Promise<Record<string, string>>;
  listEquipment(): Promise<EquipmentCard[]>;
  listRelics(): Promise<RelicListEntry[]>;
}
