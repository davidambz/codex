// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import type { ItemKind, RelicSortKey, SourceKind } from "@iaframe/core";
import type { KindGroup, WeaponGroup } from "../kindGroups";

export interface Strings {
  app: {
    search: string;
    searchPlaceholder: string;
    noResults: (query: string) => string;
    back: string;
    kindFilterLabel: string;
    kindGroups: Record<KindGroup, string>;
    weaponFilterLabel: string;
    weaponGroups: Record<WeaponGroup, string>;
  };
  data: {
    label: string;
    downloading: string;
    checking: string;
    updatedOn: (date: string) => string;
    failed: string;
    rejected: string;
    update: string;
    noDataTitle: string;
    noDataBody: string;
    noDataFailed: (error: string) => string;
    retry: string;
    credit: string;
  };
  home: {
    title: string;
    body: string;
    examplesLabel: string;
  };
  kinds: Record<ItemKind, string>;
  sourceKinds: Record<SourceKind, string>;
  /** What one attempt is called for each kind of source. */
  attempts: Record<SourceKind, string>;
  item: {
    vaulted: string;
    obtainable: string;
    relicsLabel: string;
    relicsHint: string;
    whereLabel: string;
    directLabel: string;
    noDrops: string;
    relicVaultedNote: string;
    relicSourcesLabel: string;
    contents: string;
    showMore: (count: number) => string;
    filterLabel: string;
    filterAll: string;
    hideVaulted: string;
    bestLabel: string;
    bestDirect: string;
    bestRelic: string;
    bestRelicChances: (intact: string, radiant: string) => string;
    bestRelicWhere: (source: string) => string;
    bestRelicNoSource: string;
    planetLabel: string;
    planetAll: string;
    rotationLabel: string;
    rotationAll: string;
    textFilterLabel: string;
    textFilterPlaceholder: string;
    hideEvents: string;
    hideConditional: string;
    shownOf: (shown: number, total: number) => string;
    noMatches: string;
    clearFilters: string;
    relicSortLabel: string;
    relicSorts: Record<RelicSortKey, string>;
    tierLabel: string;
    tierAll: string;
  };
  languages: {
    open: string;
    title: string;
    itemLanguage: string;
    searchLanguages: string;
    searchHint: string;
    note: string;
    fetching: string;
    english: (name: string) => string;
  };
  equipment: {
    partsLabel: string;
    /** Names of the pieces ("Blueprint", "Chassis", "Barrel"...); others show as they come. */
    parts: Record<string, string>;
    noParts: string;
    drops: (chance: string) => string;
    relics: (open: number, total: number) => string;
    vaulted: (total: number) => string;
    none: string;
    noneHint: string;
    howLabel: string;
    wikiCredit: string;
    openWiki: string;
    counterpart: (name: string) => string;
  };
  table: {
    source: string;
    detail: string;
    chance: string;
    runs: string;
    rotation: (r: string) => string;
    conditionalNote: string;
    enemyChance: (enemy: string, table: string) => string;
    average: (count: string, unit: string) => string;
    forNinety: (count: string) => string;
    event: string;
    sortBy: (column: string) => string;
  };
  source: {
    rewardsLabel: string;
    rotationGroup: (r: string) => string;
    noRotation: string;
    filterLabel: string;
    filterPlaceholder: string;
    noMatches: string;
  };
  refinements: Record<"Intact" | "Exceptional" | "Flawless" | "Radiant", string>;
}
