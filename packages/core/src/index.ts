// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

export * from "./types.ts";
export { parseDropData, type RawDropData } from "./wfcd/parse.ts";
export { kindFromName, parseRelicName, splitQuantity } from "./wfcd/names.ts";
export { validateDropData, ANCHORS, type PreviousCounts } from "./wfcd/validate.ts";
export type { Db, SqlValue } from "./db.ts";
export { buildSearchIndex, tokenize, type SearchEntry, type SearchHit, type SearchIndex } from "./search/index.ts";
export { SYNONYMS } from "./search/synonyms.ts";
export { expectedRuns, runsForConfidence } from "./odds.ts";
export * from "./queries.ts";
export type { Platform, Theme, DataStatus, SourceDetails, Settings } from "./platform.ts";
export { sanitizeSettings, settingsLanguages } from "./platform.ts";
export { resolveSupportedLocale } from "./locale.ts";
export {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_FILES,
  IMAGE_BASE_URL,
  SAFE_IMAGE,
  WEAPON_CATEGORIES,
  partImage,
  assignWeaponParts,
  joinCatalog,
  parseEquipment,
  partLabel,
  warframeParts,
  wikiPage,
  type CatalogEntry,
  type EquipmentCategory,
} from "./catalog/equipment.ts";
export { extractAcquisition, toPlainText } from "./wiki/wikitext.ts";
export {
  bestBet,
  dropFacets,
  filterDrops,
  filterRelics,
  relicTiers,
  sortDrops,
  sortRelics,
  type BestBet,
  type DropFilter,
  type DropSortKey,
  type RelicFilter,
  type RelicSortKey,
  type SortDirection,
} from "./filters.ts";
export {
  CATALOG_FILES,
  ITEM_LANGUAGES,
  LANGUAGE_NAMES,
  englishIds,
  englishImages,
  isItemLanguage,
  itemLanguageForLocale,
  translateNames,
  type ItemLanguage,
} from "./catalog/names.ts";
