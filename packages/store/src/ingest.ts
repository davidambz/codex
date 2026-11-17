// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// Keeps the local database in step with WFCD's drop data:
//   1. fetch info.json (~100 bytes) and stop if its hash is the one we have;
//   2. fetch all.json (~7 MB), parse and validate it;
//   3. fetch the Warframe list and the wiki's acquisition text (optional:
//      when that fails, the last good list is kept and retried next time);
//   4. build a fresh database next to the live one and rename it over it.
// The live file is never written in place, so a failed or rejected
// ingest leaves it exactly as it was.

import { mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { parseDropData, validateDropData, type PreviousCounts, type WarframeEntry } from "@iaframe/core";
import { buildDatabase } from "./build.ts";
import { fetchWarframes } from "./catalog.ts";
import { SCHEMA_VERSION } from "./schema.ts";
import { readMeta, readWarframes } from "./sqlite.ts";

export const WFCD_INFO_URL = "https://drops.warframestat.us/data/info.json";
export const WFCD_DATA_URL = "https://drops.warframestat.us/data/all.json";
const USER_AGENT = "IAFrame (+https://github.com/davidambz/iaframe)";

export type FetchJson = (url: string) => Promise<unknown>;

export interface IngestOptions {
  dbPath: string;
  /** Rebuild even when the hash hasn't changed. */
  force?: boolean;
  fetchJson?: FetchJson;
  now?: () => Date;
  /** Called right before the new file replaces the old one: close any open connection here. */
  beforeSwap?: () => void;
}

export type IngestResult =
  | { status: "up-to-date"; hash: string }
  | {
      status: "updated";
      hash: string;
      items: number;
      drops: number;
      skipped: number;
      warframes: number;
      /** Why the Warframe list couldn't be refreshed (the previous one was kept). */
      catalogError?: string;
    }
  | { status: "rejected"; hash: string; problems: string[] };

export async function ingest(options: IngestOptions): Promise<IngestResult> {
  const fetchJson = options.fetchJson ?? defaultFetchJson;
  const now = options.now ?? (() => new Date());

  const info = (await fetchJson(WFCD_INFO_URL)) as { hash?: unknown; modified?: unknown } | null;
  const hash = info?.hash;
  if (typeof hash !== "string" || hash === "") throw new Error("WFCD info.json has no hash");

  const meta = readMeta(options.dbPath);
  const sameSchema = meta?.schema_version === String(SCHEMA_VERSION);
  // A database built while the catalog was unreachable is rebuilt at the next check.
  const complete = Boolean(meta?.catalog_at);
  if (!options.force && sameSchema && complete && meta?.drops_hash === hash) return { status: "up-to-date", hash };

  const data = parseDropData(await fetchJson(WFCD_DATA_URL));
  const previous: PreviousCounts | undefined =
    sameSchema && meta ? { items: Number(meta.items), drops: Number(meta.drops) } : undefined;
  const problems = validateDropData(data, previous);
  if (problems.length > 0) return { status: "rejected", hash, problems };

  let warframes: WarframeEntry[];
  let catalogAt = now().toISOString();
  let catalogError: string | undefined;
  try {
    warframes = await fetchWarframes(fetchJson);
  } catch (error) {
    catalogError = error instanceof Error ? error.message : String(error);
    warframes = sameSchema ? readWarframes(options.dbPath) : [];
    catalogAt = "";
  }

  mkdirSync(dirname(options.dbPath), { recursive: true });
  const tmpPath = `${options.dbPath}.tmp`;
  try {
    buildDatabase(tmpPath, data, {
      drops_hash: hash,
      source_modified: typeof info?.modified === "number" ? new Date(info.modified).toISOString() : "",
      ingested_at: now().toISOString(),
      catalog_at: catalogAt,
    }, warframes);
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
    warframes: warframes.length,
  };
  if (catalogError) result.catalogError = catalogError;
  return result;
}

async function defaultFetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}
