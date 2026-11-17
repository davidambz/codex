// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// Everything the app does with its data, minus Electron: owns the open
// database and the search index, and keeps both current with WFCD.

import { existsSync } from "node:fs";
import {
  buildSearchIndex,
  getDataInfo,
  getDropsDeep,
  getItem,
  getSource,
  getSourceDrops,
  listItems,
  type DataStatus,
  type DeepDrops,
  type ItemKind,
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
  fetchJson?: FetchJson;
  now?: () => Date;
  onStatus?: (status: DataStatus) => void;
}

export interface DataService {
  search(query: string, limit?: number, kinds?: readonly ItemKind[]): SearchHit[];
  getItem(name: string): ItemDetails | undefined;
  getDropsDeep(name: string): DeepDrops;
  getSource(key: string): SourceDetails | undefined;
  status(): DataStatus;
  /** Asks WFCD for news and swaps the database in if there are any. Concurrent calls share one run. */
  update(force?: boolean): Promise<DataStatus>;
  close(): void;
}

export function createDataService(options: DataServiceOptions): DataService {
  const now = options.now ?? (() => new Date());
  let store: Store | undefined;
  let index: SearchIndex | undefined;
  let status: DataStatus = { busy: false };
  let running: Promise<DataStatus> | undefined;

  const emit = (next: DataStatus) => {
    status = next;
    options.onStatus?.(status);
  };

  const open = () => {
    if (!existsSync(options.dbPath) || readMeta(options.dbPath)?.schema_version !== String(SCHEMA_VERSION)) return;
    store = openStore(options.dbPath);
    index = buildSearchIndex(listItems(store));
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
      });
      if (result.status === "updated") open();
      emit({ busy: false, info: status.info, checkedAt: now().toISOString(), outcome: result.status });
      if (result.status === "rejected") console.warn("WFCD data rejected:", result.problems);
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

  return {
    search: (query, limit, kinds) => index?.search(query, limit, kinds) ?? [],
    getItem: (name) => (store ? getItem(store, name) : undefined),
    getDropsDeep: (name) => (store ? getDropsDeep(store, name) : { direct: [], relics: [] }),
    getSource(key) {
      if (!store) return undefined;
      const source = getSource(store, key);
      return source ? { source, drops: getSourceDrops(store, key) } : undefined;
    },
    status: () => status,
    update(force = false) {
      running ??= run(force).finally(() => {
        running = undefined;
      });
      return running;
    },
    close,
  };
}
