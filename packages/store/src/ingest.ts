// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// Keeps the local database in step with WFCD's drop data:
//   1. fetch info.json (~100 bytes), the catalog's last commit and the Public Export index
//      (~500 bytes), and stop if none changed;
//   2. fetch all.json (~7 MB), parse and validate it;
//   3. fetch the Warframe, weapon and companion catalog, the game's part recipes and the
//      wiki's acquisition text (optional: when that fails, the last good list is kept and
//      retried next time);
//   4. fetch item names in the languages asked for (optional in the same way);
//   5. build a fresh database next to the live one and rename it over it.
// The live file is never written in place, so a failed or rejected
// ingest leaves it exactly as it was.

import { mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import {
  parseDropData,
  validateDropData,
  type ItemLanguage,
  type PreviousCounts,
  assignWeaponParts,
  type CatalogEntry,
} from "@iaframe/core";
import { buildDatabase } from "./build.ts";
import { fetchCatalog, fetchCatalogVersion } from "./catalog.ts";
import { fetchRecipesEntry, type FetchBytes } from "./export.ts";
import { SCHEMA_VERSION } from "./schema.ts";
import { fetchItemImages, fetchItemNames, type ItemNames } from "./names.ts";
import { readCatalog, readItemImages, readItemNames, readMeta } from "./sqlite.ts";

export const WFCD_INFO_URL = "https://drops.warframestat.us/data/info.json";
export const WFCD_DATA_URL = "https://drops.warframestat.us/data/all.json";
const USER_AGENT = "IAFrame (+https://github.com/davidambz/iaframe)";

export type FetchJson = (url: string) => Promise<unknown>;

export interface IngestOptions {
  dbPath: string;
  /** Rebuild even when the hash hasn't changed. */
  force?: boolean;
  fetchJson?: FetchJson;
  /**
   * For the Public Export's packed index. When only `fetchJson` is given
   * (tests), it serves these too, returning the bytes.
   */
  fetchBytes?: FetchBytes;
  now?: () => Date;
  /** Called right before the new file replaces the old one: close any open connection here. */
  beforeSwap?: () => void;
  /** Languages to fetch item names in, besides English. */
  languages?: readonly ItemLanguage[];
}

export type IngestResult =
  | { status: "up-to-date"; hash: string }
  | {
      status: "updated";
      hash: string;
      items: number;
      drops: number;
      skipped: number;
      /** Warframes, weapons and companions in the catalog. */
      equipment: number;
      /** Why the catalog couldn't be refreshed (the previous one was kept). */
      catalogError?: string;
      /** Why item names couldn't be refreshed (the previous ones were kept). */
      namesError?: string;
    }
  | { status: "rejected"; hash: string; problems: string[] };

export async function ingest(options: IngestOptions): Promise<IngestResult> {
  // The catalog and the names read some of the same files: fetch each once per run.
  const fetched = new Map<string, Promise<unknown>>();
  const fetchUncached = options.fetchJson ?? defaultFetchJson;
  const fetchJson: FetchJson = (url) => {
    let result = fetched.get(url);
    if (!result) {
      result = fetchUncached(url);
      fetched.set(url, result);
      result.catch(() => fetched.delete(url));
    }
    return result;
  };
  const now = options.now ?? (() => new Date());
  const injected = options.fetchJson;
  const fetchBytes: FetchBytes =
    options.fetchBytes ??
    (injected
      ? async (url) => {
          const bytes = await injected(url);
          if (!(bytes instanceof Uint8Array)) throw new Error(`${url}: expected bytes`);
          return bytes;
        }
      : defaultFetchBytes);

  const info = (await fetchJson(WFCD_INFO_URL)) as { hash?: unknown; modified?: unknown } | null;
  const hash = info?.hash;
  if (typeof hash !== "string" || hash === "") throw new Error("WFCD info.json has no hash");

  const meta = readMeta(options.dbPath);
  const sameSchema = meta?.schema_version === String(SCHEMA_VERSION);
  const languages = [...new Set(options.languages ?? [])].filter((l) => l !== "en").sort();
  const stored = new Set((meta?.languages ?? "").split(",").filter(Boolean));
  // A database built while the catalog or the names were unreachable, or
  // without a language now wanted, is rebuilt at the next check.
  const complete =
    Boolean(meta?.catalog_at) &&
    (languages.length === 0 || Boolean(meta?.names_at)) &&
    languages.every((language) => stored.has(language));
  // The catalog and the recipes change without the drop tables (new items, Prime Access):
  // a newer version of either is reason enough to rebuild. Unreachable ones don't count.
  const [catalogVersion, recipesEntry] = await Promise.all([
    fetchCatalogVersion(fetchJson).catch(() => undefined),
    fetchRecipesEntry(fetchBytes).catch(() => undefined),
  ]);
  const newer =
    (catalogVersion !== undefined && catalogVersion !== meta?.catalog_version) ||
    (recipesEntry !== undefined && recipesEntry !== meta?.recipes_entry);
  if (!options.force && sameSchema && complete && meta?.drops_hash === hash && !newer) return { status: "up-to-date", hash };

  const data = parseDropData(await fetchJson(WFCD_DATA_URL));
  const previous: PreviousCounts | undefined =
    sameSchema && meta ? { items: Number(meta.items), drops: Number(meta.drops) } : undefined;
  const problems = validateDropData(data, previous);
  if (problems.length > 0) return { status: "rejected", hash, problems };

  const dropItems = data.items.map((item) => item.name);
  let catalog: CatalogEntry[];
  let images: Map<string, string>;
  let catalogAt = now().toISOString();
  let catalogError: string | undefined;
  try {
    if (!recipesEntry) throw new Error("The game's Public Export is unreachable");
    [catalog, images] = await Promise.all([fetchCatalog(fetchJson, dropItems, recipesEntry), fetchItemImages(fetchJson)]);
  } catch (error) {
    catalogError = error instanceof Error ? error.message : String(error);
    catalog = sameSchema ? readCatalog(options.dbPath) : [];
    images = sameSchema ? readItemImages(options.dbPath) : new Map();
    // Parts are matched against this run's drop tables, not the old ones.
    assignWeaponParts(catalog, dropItems);
    catalogAt = "";
  }

  let names: ItemNames;
  let namesAt = now().toISOString();
  let namesError: string | undefined;
  try {
    const items = [
      ...dropItems,
      ...catalog.flatMap((entry) => [
        entry.name,
        ...(entry.parts ?? []),
        ...(entry.materials ?? []).map((m) => m.name),
        ...Object.values(entry.partRecipes ?? {}).flatMap((r) => r.materials.map((m) => m.name)),
      ]),
    ];
    names = await fetchItemNames(fetchJson, items, languages);
  } catch (error) {
    namesError = error instanceof Error ? error.message : String(error);
    const previous = sameSchema ? readItemNames(options.dbPath) : new Map();
    names = new Map([...previous].filter(([language]) => languages.includes(language)));
    namesAt = "";
  }

  mkdirSync(dirname(options.dbPath), { recursive: true });
  const tmpPath = `${options.dbPath}.tmp`;
  try {
    buildDatabase(tmpPath, data, {
      drops_hash: hash,
      source_modified: typeof info?.modified === "number" ? new Date(info.modified).toISOString() : "",
      ingested_at: now().toISOString(),
      catalog_at: catalogAt,
      // Kept only for a fresh catalog, so a fallback one is retried next time.
      catalog_version: catalogAt ? (catalogVersion ?? "") : "",
      recipes_entry: catalogAt ? (recipesEntry ?? "") : "",
      names_at: namesAt,
    }, catalog, names, images);
    options.beforeSwap?.();
    renameSync(tmpPath, options.dbPath);
  } finally {
    rmSync(tmpPath, { force: true });
  }
  const result: IngestResult = {
    status: "updated",
    hash,
    items: data.items.length,
    drops: data.drops.length,
    skipped: data.skipped,
    equipment: catalog.length,
  };
  if (catalogError) result.catalogError = catalogError;
  if (namesError) result.namesError = namesError;
  return result;
}

async function defaultFetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function defaultFetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}
