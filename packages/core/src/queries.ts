// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// The one query layer: the search screen and, later, the assistant's
// tools both read the database through these functions.

import type { Db } from "./db.ts";
import type { ItemKind, Refinement, RelicTier, Rotation, Source, SourceKind } from "./types.ts";
import { REFINEMENTS } from "./types.ts";
import type { SearchEntry } from "./search/index.ts";

export interface RelicInfo {
  tier: RelicTier;
  code: string;
  vaulted: boolean;
}

export interface ItemDetails {
  name: string;
  kind: ItemKind;
  /** When the item is a relic. */
  relic?: RelicInfo;
  /**
   * Only comes from relics, and none of them can be had right now. Unknown
   * (undefined) for items that don't come from relics.
   */
  vaulted?: boolean;
}

export interface DropRow {
  source: Source;
  rotation?: Rotation;
  refinement?: Refinement;
  stage?: string;
  rarity?: string;
  chance: number;
  quantity?: number;
  slots: number;
  enemyChance?: number;
  tableChance?: number;
  conditional: boolean;
  /** When the source is a relic: whether it's vaulted. */
  sourceVaulted?: boolean;
}

export interface SourceItemRow {
  item: string;
  kind: ItemKind;
  rotation?: Rotation;
  refinement?: Refinement;
  stage?: string;
  rarity?: string;
  chance: number;
  quantity?: number;
  conditional: boolean;
}

export interface RelicRoute {
  relic: string;
  info: RelicInfo;
  rarity?: string;
  /** Chance of the item per relic opened, at each refinement. */
  chances: Partial<Record<Refinement, number>>;
  /** Where the relic itself drops, best chance first. */
  sources: DropRow[];
}

export interface DeepDrops {
  /** Drops straight from missions, enemies, bounties... */
  direct: DropRow[];
  /** Relics that contain the item: obtainable first, then by Intact chance. */
  relics: RelicRoute[];
}

export interface DataInfo {
  hash?: string;
  ingestedAt?: string;
  sourceModified?: string;
  items: number;
  drops: number;
}

interface DropRecord {
  source_key: string;
  source_kind: SourceKind;
  source_name: string;
  location: string | null;
  game_mode: string | null;
  is_event: number;
  rotation: Rotation | null;
  refinement: Refinement | null;
  stage: string | null;
  rarity: string | null;
  chance: number;
  quantity: number | null;
  slots: number;
  enemy_chance: number | null;
  table_chance: number | null;
  conditional: number;
  source_vaulted: number | null;
}

const DROP_COLUMNS = `
  s.key AS source_key, s.kind AS source_kind, s.name AS source_name, s.location, s.game_mode, s.is_event,
  d.rotation, d.refinement, d.stage, d.rarity, d.chance, d.quantity, d.slots,
  d.enemy_chance, d.table_chance, d.conditional, sr.vaulted AS source_vaulted`;

const DROPS_OF_ITEM = `
  SELECT ${DROP_COLUMNS}
  FROM drops d
  JOIN items i ON i.id = d.item_id
  JOIN sources s ON s.id = d.source_id
  LEFT JOIN items si ON s.kind = 'relic' AND si.name = s.name
  LEFT JOIN relics sr ON sr.item_id = si.id
  WHERE i.name = ?
  ORDER BY d.chance DESC, s.name`;

/** Every item, for the search index. */
export function listItems(db: Db): SearchEntry[] {
  return db.all<SearchEntry>("SELECT name, kind FROM items ORDER BY name");
}

export function getItem(db: Db, name: string): ItemDetails | undefined {
  const row = db.get<{ name: string; kind: ItemKind; tier: RelicTier | null; code: string | null; vaulted: number | null }>(
    `SELECT i.name, i.kind, r.tier, r.code, r.vaulted
     FROM items i LEFT JOIN relics r ON r.item_id = i.id
     WHERE i.name = ?`,
    name,
  );
  if (!row) return undefined;
  const details: ItemDetails = { name: row.name, kind: row.kind };
  if (row.tier && row.code) details.relic = { tier: row.tier, code: row.code, vaulted: row.vaulted === 1 };

  const routes = db.get<{ relics: number; open: number; direct: number }>(
    `SELECT
       COUNT(DISTINCT CASE WHEN s.kind = 'relic' THEN s.id END) AS relics,
       COUNT(DISTINCT CASE WHEN s.kind = 'relic' AND sr.vaulted = 0 THEN s.id END) AS open,
       COUNT(CASE WHEN s.kind <> 'relic' THEN 1 END) AS direct
     FROM drops d
     JOIN items i ON i.id = d.item_id
     JOIN sources s ON s.id = d.source_id
     LEFT JOIN items si ON s.kind = 'relic' AND si.name = s.name
     LEFT JOIN relics sr ON sr.item_id = si.id
     WHERE i.name = ?`,
    name,
  );
  if (routes && routes.relics > 0) details.vaulted = routes.open === 0 && routes.direct === 0;
  return details;
}

/** Where an item drops, best chance first. */
export function getDrops(db: Db, item: string): DropRow[] {
  return db.all<DropRecord>(DROPS_OF_ITEM, item).map(toDropRow);
}

/** Direct drops, plus each relic holding the item with its chances and where the relic drops. */
export function getDropsDeep(db: Db, item: string): DeepDrops {
  const direct: DropRow[] = [];
  const byRelic = new Map<string, RelicRoute>();
  for (const row of getDrops(db, item)) {
    if (row.source.kind !== "relic") {
      direct.push(row);
      continue;
    }
    let route = byRelic.get(row.source.name);
    if (!route) {
      const info = getItem(db, row.source.name)?.relic;
      if (!info) continue;
      route = { relic: row.source.name, info, rarity: row.rarity, chances: {}, sources: [] };
      byRelic.set(row.source.name, route);
    }
    if (row.refinement) route.chances[row.refinement] = row.chance;
  }
  for (const route of byRelic.values()) route.sources = getDrops(db, route.relic);

  const relics = [...byRelic.values()].sort(
    (a, b) =>
      Number(a.info.vaulted) - Number(b.info.vaulted) ||
      (b.chances.Intact ?? 0) - (a.chances.Intact ?? 0) ||
      a.relic.localeCompare(b.relic),
  );
  return { direct, relics };
}

export function getSource(db: Db, key: string): Source | undefined {
  const row = db.get<{ key: string; kind: SourceKind; name: string; location: string | null; game_mode: string | null; is_event: number }>(
    "SELECT key, kind, name, location, game_mode, is_event FROM sources WHERE key = ?",
    key,
  );
  return row ? toSource(row.key, row.kind, row.name, row.location, row.game_mode, row.is_event) : undefined;
}

/** What a mission, relic or enemy drops, by rotation / refinement, best chance first. */
export function getSourceDrops(db: Db, key: string): SourceItemRow[] {
  const rows = db.all<{
    item: string;
    kind: ItemKind;
    rotation: Rotation | null;
    refinement: Refinement | null;
    stage: string | null;
    rarity: string | null;
    chance: number;
    quantity: number | null;
    conditional: number;
  }>(
    `SELECT i.name AS item, i.kind, d.rotation, d.refinement, d.stage, d.rarity, d.chance, d.quantity, d.conditional
     FROM drops d
     JOIN items i ON i.id = d.item_id
     JOIN sources s ON s.id = d.source_id
     WHERE s.key = ?
     ORDER BY d.rotation, d.stage, d.refinement, d.chance DESC, i.name`,
    key,
  );
  const refinementOrder = (r: Refinement | null) => (r ? REFINEMENTS.indexOf(r) : -1);
  return rows
    .sort((a, b) => refinementOrder(a.refinement) - refinementOrder(b.refinement))
    .map((r) => {
      const row: SourceItemRow = { item: r.item, kind: r.kind, chance: r.chance, conditional: r.conditional === 1 };
      if (r.rotation) row.rotation = r.rotation;
      if (r.refinement) row.refinement = r.refinement;
      if (r.stage) row.stage = r.stage;
      if (r.rarity) row.rarity = r.rarity;
      if (r.quantity !== null) row.quantity = r.quantity;
      return row;
    });
}

export function getDataInfo(db: Db): DataInfo {
  const meta = Object.fromEntries(
    db.all<{ key: string; value: string }>("SELECT key, value FROM meta").map((r) => [r.key, r.value]),
  );
  return {
    hash: meta.drops_hash || undefined,
    ingestedAt: meta.ingested_at || undefined,
    sourceModified: meta.source_modified || undefined,
    items: Number(meta.items ?? 0),
    drops: Number(meta.drops ?? 0),
  };
}

function toSource(
  key: string,
  kind: SourceKind,
  name: string,
  location: string | null,
  gameMode: string | null,
  isEvent: number,
): Source {
  const source: Source = { key, kind, name };
  if (location) source.location = location;
  if (gameMode) source.gameMode = gameMode;
  if (isEvent) source.isEvent = true;
  return source;
}

function toDropRow(r: DropRecord): DropRow {
  const row: DropRow = {
    source: toSource(r.source_key, r.source_kind, r.source_name, r.location, r.game_mode, r.is_event),
    chance: r.chance,
    slots: r.slots,
    conditional: r.conditional === 1,
  };
  if (r.rotation) row.rotation = r.rotation;
  if (r.refinement) row.refinement = r.refinement;
  if (r.stage) row.stage = r.stage;
  if (r.rarity) row.rarity = r.rarity;
  if (r.quantity !== null) row.quantity = r.quantity;
  if (r.enemy_chance !== null) row.enemyChance = r.enemy_chance;
  if (r.table_chance !== null) row.tableChance = r.table_chance;
  if (r.source_vaulted !== null) row.sourceVaulted = r.source_vaulted === 1;
  return row;
}
