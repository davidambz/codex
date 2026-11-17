// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// The game's Public Export, which Digital Extremes publishes for
// community tools: an LZMA-packed index naming each export file with
// its content hash, then the files themselves under Manifest/. Only the
// recipes are read, for what each part's blueprint costs; WFCD's item
// catalog only has the recipe of the finished item.

import { decodeLzma } from "./lzma.ts";
import type { FetchJson } from "./ingest.ts";

export type FetchBytes = (url: string) => Promise<Uint8Array>;

const EXPORT_BASE = "https://content.warframe.com/PublicExport";
export const EXPORT_INDEX_URL = `${EXPORT_BASE}/index_en.txt.lzma`;
export const exportFileUrl = (entry: string) => `${EXPORT_BASE}/Manifest/${entry}`;

/** The index's entries ("ExportRecipes_en.json!00_oac..."), by file name. */
export function parseExportIndex(text: string): Map<string, string> {
  const entries = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const entry = line.trim();
    const bang = entry.indexOf("!");
    if (bang > 0) entries.set(entry.slice(0, bang), entry);
  }
  return entries;
}

/** The recipes entry of the current index: its name carries the content hash, so it doubles as a version. */
export async function fetchRecipesEntry(fetchBytes: FetchBytes): Promise<string> {
  const index = parseExportIndex(new TextDecoder().decode(decodeLzma(await fetchBytes(EXPORT_INDEX_URL))));
  const entry = index.get("ExportRecipes_en.json");
  if (!entry) throw new Error("Public Export index has no ExportRecipes_en.json");
  return entry;
}

export async function fetchRecipes(fetchJson: FetchJson, entry: string): Promise<unknown> {
  return fetchJson(exportFileUrl(entry));
}
