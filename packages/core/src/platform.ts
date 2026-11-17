// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// What the UI needs from whatever hosts it (the Electron app, or a fake in
// the browser for layout work). The UI only ever talks to this.

import type { DataInfo, DeepDrops, ItemDetails, SourceItemRow } from "./queries.ts";
import type { SearchHit } from "./search/index.ts";
import type { Source } from "./types.ts";

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

export interface Platform {
  kind: "desktop" | "web";
  appVersion: string;
  search(query: string, limit?: number): Promise<SearchHit[]>;
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
}
