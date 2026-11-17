// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import type { ItemKind, SourceKind } from "@iaframe/core";

export interface Strings {
  app: {
    search: string;
    searchPlaceholder: string;
    noResults: (query: string) => string;
    back: string;
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
  };
  source: {
    rewardsLabel: string;
    rotationGroup: (r: string) => string;
    noRotation: string;
  };
  refinements: Record<"Intact" | "Exceptional" | "Flawless" | "Radiant", string>;
}
