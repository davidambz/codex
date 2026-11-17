// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// Everything the app does with its data, minus Electron: owns the open
// database and the search index, and keeps both current with WFCD.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  buildSearchIndex,
  getDataInfo,
  getDropsDeep,
  getItemNames,
  sanitizeSettings,
  settingsLanguages,
  getItem,
  getSource,
  getSourceDrops,
  listEquipment,
  listItems,
  listRelics,
  type EquipmentCard,
  type RelicListEntry,
  type DataStatus,
  type DeepDrops,
  type ItemKind,
  type ItemLanguage,
  type Settings,
  type ItemDetails,
  type SearchHit,
  type SearchIndex,
  type SourceDetails,
} from "@iaframe/core";
import { ingest, type FetchJson } from "./ingest.ts";
import { SCHEMA_VERSION } from "./schema.ts";
import { openStore, readMeta, type Store } from "./sqlite.ts";

export interface DataServiceOptions {
  dbPath: string;
  /** Where settings are saved; without it they live only in memory. */
  settingsPath?: string;
  /** Settings before any are saved (e.g. names in the system's language). */
  defaultSettings?: Partial<Settings>;
  fetchJson?: FetchJson;
  now?: () => Date;
  onStatus?: (status: DataStatus) => void;
}

export interface DataService {
  search(query: string, limit?: number, kinds?: readonly ItemKind[]): SearchHit[];
  getItem(name: string): ItemDetails | undefined;
  getDropsDeep(name: string): DeepDrops;
  getSource(key: string): SourceDetails | undefined;
  getItemNames(language: ItemLanguage): Record<string, string>;
  /** Every Warframe, weapon and companion, for the Foundry grid. */
  listEquipment(): EquipmentCard[];
  listRelics(): RelicListEntry[];
  settings(): Settings;
  /** Saves the change, re-indexes search, and fetches names for a new language. */
  updateSettings(patch: Partial<Settings>): Settings;
  status(): DataStatus;
  /** Asks WFCD for news and swaps the database in if there are any. Concurrent calls share one run. */
  update(force?: boolean): Promise<DataStatus>;
  close(): void;
}

export function createDataService(options: DataServiceOptions): DataService {
  const now = options.now ?? (() => new Date());
  let store: Store | undefined;
  // Built on first use and dropped whenever the database is swapped.
  let lists: { equipment?: EquipmentCard[]; relics?: RelicListEntry[] } = {};
  let index: SearchIndex | undefined;
  let status: DataStatus = { busy: false };
  let running: Promise<DataStatus> | undefined;
  const fallback: Settings = { itemLanguage: "en", searchLanguages: [], ...options.defaultSettings };
  let settings = loadSettings(options.settingsPath, fallback);

  const emit = (next: DataStatus) => {
    status = next;
    options.onStatus?.(status);
  };

  const open = () => {
    if (!existsSync(options.dbPath) || readMeta(options.dbPath)?.schema_version !== String(SCHEMA_VERSION)) return;
    store = openStore(options.dbPath);
    lists = {};
    index = buildSearchIndex(listItems(store, settingsLanguages(settings)));
    status = { ...status, info: getDataInfo(store) };
  };

  const close = () => {
    store?.close();
    store = undefined;
    index = undefined;
  };

  open();

  const run = async (force: boolean): Promise<DataStatus> => {
    emit({ ...status, busy: true });
    try {
      const result = await ingest({
        dbPath: options.dbPath,
        fetchJson: options.fetchJson,
        now,
        force,
        beforeSwap: close,
        languages: settingsLanguages(settings),
      });
      if (result.status === "updated") open();
      emit({ busy: false, info: status.info, checkedAt: now().toISOString(), outcome: result.status });
      if (result.status === "rejected") console.warn("WFCD data rejected:", result.problems);
      if (result.status === "updated" && result.catalogError) console.warn("Catalog kept:", result.catalogError);
      if (result.status === "updated" && result.namesError) console.warn("Item names kept:", result.namesError);
    } catch (error) {
      // A failed swap may have closed the database; whatever is on disk is still good.
      if (!store) open();
      emit({
        busy: false,
        info: status.info,
        checkedAt: now().toISOString(),
        outcome: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return status;
  };

  const update = (force = false): Promise<DataStatus> => {
    running ??= run(force).finally(() => {
      running = undefined;
    });
    return running;
  };

  return {
    search: (query, limit, kinds) => index?.search(query, limit, kinds) ?? [],
    getItem: (name) => (store ? getItem(store, name) : undefined),
    getDropsDeep: (name) => (store ? getDropsDeep(store, name) : { direct: [], relics: [] }),
    getSource(key) {
      if (!store) return undefined;
      const source = getSource(store, key);
      return source ? { source, drops: getSourceDrops(store, key) } : undefined;
    },
    getItemNames: (language) => (store ? getItemNames(store, language) : {}),
    listEquipment() {
      if (!store) return [];
      lists.equipment ??= listEquipment(store);
      return lists.equipment;
    },
    listRelics() {
      if (!store) return [];
      lists.relics ??= listRelics(store);
      return lists.relics;
    },
    settings: () => settings,
    updateSettings(patch) {
      const before = settingsLanguages(settings);
      settings = sanitizeSettings({ ...settings, ...patch }, settings);
      saveSettings(options.settingsPath, settings);
      if (store) index = buildSearchIndex(listItems(store, settingsLanguages(settings)));
      // A language not in the database yet: the next check sees it missing and fetches it.
      if (settingsLanguages(settings).some((language) => !before.includes(language))) void update();
      return settings;
    },
    status: () => status,
    update,
    close,
  };
}

function loadSettings(path: string | undefined, fallback: Settings): Settings {
  if (!path) return fallback;
  try {
    return sanitizeSettings(JSON.parse(readFileSync(path, "utf8")), fallback);
  } catch {
    return fallback;
  }
}

function saveSettings(path: string | undefined, settings: Settings): void {
  if (!path) return;
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.warn("Couldn't save settings:", error);
  }
}
