// Codex — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { CATALOG_FILES, englishIds, englishImages, translateNames, type ItemLanguage } from "@codex/core";
import type { FetchJson } from "./ingest.ts";

const ITEMS_DATA = "https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json";

export const catalogFileUrl = (file: string) => `${ITEMS_DATA}/${file}.json`;
export const i18nUrl = (language: ItemLanguage) => `${ITEMS_DATA}/i18n/${language}.json`;

/** Item name -> its name in each language (only where it differs from English). */
export type ItemNames = Map<ItemLanguage, Map<string, string>>;

/** Names of `items` in `languages` (English needs nothing and is skipped). */
export async function fetchItemNames(
  fetchJson: FetchJson,
  items: readonly string[],
  languages: readonly ItemLanguage[],
): Promise<ItemNames> {
  const wanted = languages.filter((language) => language !== "en");
  const names: ItemNames = new Map();
  if (wanted.length === 0) return names;
  const ids = englishIds(await Promise.all(CATALOG_FILES.map((file) => fetchJson(catalogFileUrl(file)))));
  for (const language of wanted) names.set(language, translateNames(items, ids, await fetchJson(i18nUrl(language))));
  return names;
}

/** Item name -> picture file, for everything the catalog has a picture of. */
export async function fetchItemImages(fetchJson: FetchJson): Promise<Map<string, string>> {
  return englishImages(await Promise.all(CATALOG_FILES.map((file) => fetchJson(catalogFileUrl(file)))));
}
