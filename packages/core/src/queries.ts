// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// The one query layer: the search screen and, later, the assistant's
// tools both read the database through these functions.

import type { Db } from "./db.ts";
import type { ItemKind, Refinement, RelicTier, Rotation, Source, SourceKind } from "./types.ts";
import { REFINEMENTS, RELIC_TIERS } from "./types.ts";
import type { SearchEntry } from "./search/index.ts";
import { equipmentPartLabel, partImage, type EquipmentCategory } from "./catalog/equipment.ts";
import { acquisitionNote } from "./wiki/wikitext.ts";
import type { ItemLanguage } from "./catalog/names.ts";

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
  /** When the item is a Warframe, weapon or companion. */
  equipment?: EquipmentSheet;
}

/**
 * Where a part can be had right now:
 * - "drops": from a mission, enemy, bounty... (and maybe relics too);
 * - "relics": only from relics, and at least one of them is obtainable;
 * - "vaulted": only from relics, none obtainable;
 * - "none": in no drop table (bought, researched, quest reward...).
 */
export type PartStatus = "drops" | "relics" | "vaulted" | "none";

export interface EquipmentPart {
  /** "Nezha Prime Chassis Blueprint", "Soma Prime Barrel". */
  name: string;
  /** Which piece it is, in English: "Blueprint" (the main one), "Chassis", "Barrel"... */
  label: string;
  status: PartStatus;
  /** Best chance per attempt among its direct drops, for "drops". */
  bestChance?: number;
  /** For "relics" / "vaulted": how many relics hold it, and how many can be had. */
  relics?: number;
  openRelics?: number;
}

/** Something else a recipe consumes: "15 Orokin Cell", "2 Bolto". */
export interface RecipeMaterial {
  name: string;
  count: number;
  imageName?: string;
  /** Whether it has a page of its own: a drop table has it, or it's equipment ("Bolto"). */
  linked: boolean;
}

/** A Warframe, weapon or companion: its parts and how to get it. */
export interface EquipmentSheet {
  category: EquipmentCategory;
  prime: boolean;
  /** "Nezha Prime" for "Nezha" and the other way round, when both exist. */
  counterpart?: string;
  /** Warframes always list their four blueprints; others, the parts the drop tables name. */
  parts: EquipmentPart[];
  /** Resources (and whole weapons, for some) the recipe consumes, in recipe order. */
  materials: RecipeMaterial[];
  /** Credits the Foundry charges. */
  credits?: number;
  wikiUrl?: string;
  /** How to get it, from the Warframe Wiki (English, CC BY-SA). */
  acquisition?: string[];
  note?: AcquisitionNote;
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

/** Every item, for the search index, with its names in `languages` as aliases. */
export function listItems(db: Db, languages: readonly ItemLanguage[] = []): SearchEntry[] {
  const items = db.all<{ name: string; kind: ItemKind }>("SELECT name, kind FROM items ORDER BY name");
  const wanted = languages.filter((language) => language !== "en");
  if (wanted.length === 0) return items;
  const aliases = new Map<string, string[]>();
  for (const language of wanted) {
    for (const [item, name] of Object.entries(getItemNames(db, language))) {
      aliases.set(item, [...(aliases.get(item) ?? []), name]);
    }
  }
  return items.map((item) => {
    const extra = aliases.get(item.name);
    return extra ? { ...item, aliases: extra } : item;
  });
}

/** English name -> name in `language`, for every item whose name differs. */
export function getItemNames(db: Db, language: ItemLanguage): Record<string, string> {
  if (language === "en") return {};
  const rows = db.all<{ item: string; name: string }>(
    "SELECT i.name AS item, n.name FROM names n JOIN items i ON i.id = n.item_id WHERE n.lang = ?",
    language,
  );
  return Object.fromEntries(rows.map((row) => [row.item, row.name]));
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
  const equipment = getEquipmentSheet(db, row.name);
  if (equipment) details.equipment = equipment;
  return details;
}


/** One card of the Foundry grid. */
export interface EquipmentCard {
  name: string;
  category: EquipmentCategory;
  prime: boolean;
  imageName?: string;
  parts: Pick<EquipmentPart, "name" | "label" | "status">[];
  /** The first sentence of how to get it, from the wiki, for a hint on the card. */
  howTo?: string;
  note?: AcquisitionNote;
}

/** What the wiki says about getting it at all: no longer, or once from a quest. */
export type AcquisitionNote = "unobtainable" | "quest";

/**
 * The note that applies: "quest" only for things that are a single
 * blueprint no drop table names (Excalibur Umbra, Paracesis); a frame
 * whose main blueprint is a quest reward but whose parts drop (Gara) is
 * just farmed.
 */
function noteFor(acquisition: readonly string[], parts: readonly { status: PartStatus }[]): AcquisitionNote | undefined {
  const note = acquisitionNote(acquisition);
  if (note === "quest" && (parts.length > 1 || parts.some((part) => part.status !== "none"))) return undefined;
  return note;
}

/** The first sentence of a paragraph, at most `max` characters. */
export function firstSentence(paragraph: string, max = 200): string {
  const end = paragraph.search(/[.!?](\s|$)/);
  const sentence = end >= 0 ? paragraph.slice(0, end + 1) : paragraph;
  return sentence.length > max ? `${sentence.slice(0, max - 1).trimEnd()}…` : sentence;
}

interface PartStats {
  relics: number;
  open: number;
  direct: number;
  best: number | null;
}

/** Every Warframe, weapon and companion with where each part can be had, in a few queries. */
export function listEquipment(db: Db): EquipmentCard[] {
  const stats = new Map<string, PartStats>();
  for (const row of db.all<PartStats & { name: string }>(`${PART_STATS} GROUP BY i.id`)) stats.set(row.name, row);
  const owned = new Map<string, string[]>();
  for (const { owner, part } of db.all<{ owner: string; part: string }>(
    `SELECT i.name AS owner, p.part FROM parts p JOIN items i ON i.id = p.owner_id ORDER BY i.name, p.position`,
  )) {
    owned.set(owner, [...(owned.get(owner) ?? []), part]);
  }
  return db
    .all<{ name: string; category: EquipmentCategory; prime: number; image_name: string | null; acquisition: string | null }>(
      `SELECT i.name, e.category, e.prime, e.image_name, e.acquisition
       FROM equipment e JOIN items i ON i.id = e.item_id ORDER BY i.name`,
    )
    .map((row) => {
      const names = (owned.get(row.name) ?? []).map(
        (name) => [name, equipmentPartLabel(row.category, row.name, name) ?? name] as const,
      );
      const card: EquipmentCard = {
        name: row.name,
        category: row.category,
        prime: row.prime === 1,
        parts: names.map(([name, label]) => ({ name, label, status: partStatus(stats.get(name)).status })),
      };
      if (row.image_name) card.imageName = row.image_name;
      const acquisition = row.acquisition ? (JSON.parse(row.acquisition) as string[]) : [];
      if (acquisition[0]) card.howTo = firstSentence(acquisition[0]);
      const note = noteFor(acquisition, card.parts);
      if (note) card.note = note;
      return card;
    });
}

/** How to draw an item: its picture, and whether it's a blueprint (the picture on blueprint paper). */
export interface ItemPicture {
  imageName?: string;
  blueprint?: boolean;
}

export interface RelicReward extends ItemPicture {
  item: string;
  rarity: RelicRarity;
}

interface PictureRow {
  item: string;
  image: string | null;
  owner: string | null;
  owner_prime: number | null;
  owner_category: EquipmentCategory | null;
  owner_image: string | null;
  bare_image: string | null;
}

/** Columns for `picture`, over items `i`. */
const PICTURE_COLUMNS = `i.image_name AS image, o.name AS owner, e.prime AS owner_prime, e.category AS owner_category, o.image_name AS owner_image,
       bare.image_name AS bare_image`;
const PICTURE_JOINS = `LEFT JOIN parts p ON p.part = i.name
     LEFT JOIN items o ON o.id = p.owner_id
     LEFT JOIN equipment e ON e.item_id = o.id
     LEFT JOIN items bare ON i.name LIKE '% Blueprint' AND bare.name = substr(i.name, 1, length(i.name) - 10)`;

/**
 * An item's own picture when the catalog has one; for a part, the game's
 * generic picture of that piece, or its owner on blueprint paper; for
 * "X Blueprint", X on blueprint paper.
 */
function picture(row: PictureRow): ItemPicture {
  if (row.image) return { imageName: row.image };
  if (row.owner) {
    const label = row.owner_category ? equipmentPartLabel(row.owner_category, row.owner, row.item) : undefined;
    const generic = partImage(label ?? "", row.owner_prime === 1);
    if (generic) return { imageName: generic };
    if (row.owner_image) return { imageName: row.owner_image, blueprint: true };
  }
  if (row.bare_image) return { imageName: row.bare_image, blueprint: true };
  return {};
}

/** A relic, for the relic list. */
export interface RelicListEntry {
  name: string;
  tier: RelicInfo["tier"];
  code: string;
  vaulted: boolean;
  imageName?: string;
  /** What it holds, rarest last. */
  rewards: RelicReward[];
}

export type RelicRarity = "common" | "uncommon" | "rare";

/**
 * A relic reward's rarity from its Intact chance (25.33%, 11% or 2%): the
 * drop data's own rarity labels lump commons in with uncommons.
 */
export function relicRarity(intactChance: number): RelicRarity {
  return intactChance >= 20 ? "common" : intactChance >= 5 ? "uncommon" : "rare";
}

export function listRelics(db: Db): RelicListEntry[] {
  const rewards = new Map<string, RelicListEntry["rewards"]>();
  for (const row of db.all<PictureRow & { relic: string; chance: number }>(
    `SELECT s.name AS relic, i.name AS item, d.chance, ${PICTURE_COLUMNS}
     FROM drops d JOIN sources s ON s.id = d.source_id JOIN items i ON i.id = d.item_id
     ${PICTURE_JOINS}
     WHERE s.kind = 'relic' AND d.refinement = 'Intact'
     GROUP BY s.id, i.id
     ORDER BY s.name, d.chance DESC, i.name`,
  )) {
    const reward: RelicReward = { item: row.item, rarity: relicRarity(row.chance), ...picture(row) };
    rewards.set(row.relic, [...(rewards.get(row.relic) ?? []), reward]);
  }
  return db
    .all<{ name: string; tier: RelicInfo["tier"]; code: string; vaulted: number; image_name: string | null }>(
      `SELECT i.name, r.tier, r.code, r.vaulted, i.image_name FROM relics r JOIN items i ON i.id = r.item_id`,
    )
    .map((row) => {
      const entry: RelicListEntry = {
        name: row.name,
        tier: row.tier,
        code: row.code,
        vaulted: row.vaulted === 1,
        rewards: rewards.get(row.name) ?? [],
      };
      if (row.image_name) entry.imageName = row.image_name;
      return entry;
    })
    .sort((a, b) => RELIC_TIERS.indexOf(a.tier) - RELIC_TIERS.indexOf(b.tier) || a.code.localeCompare(b.code, undefined, { numeric: true }));
}

function getEquipmentSheet(db: Db, name: string): EquipmentSheet | undefined {
  const row = db.get<{
    category: EquipmentCategory;
    prime: number;
    counterpart: string | null;
    wiki_url: string | null;
    acquisition: string | null;
    credits: number | null;
  }>(
    `SELECT e.category, e.prime, e.counterpart, e.wiki_url, e.acquisition, e.credits
     FROM equipment e JOIN items i ON i.id = e.item_id WHERE i.name = ?`,
    name,
  );
  if (!row) return undefined;
  const parts = db
    .all<{ part: string }>(
      `SELECT p.part FROM parts p JOIN items i ON i.id = p.owner_id WHERE i.name = ? ORDER BY p.position`,
      name,
    )
    .map(({ part }) => partOf(db, part, equipmentPartLabel(row.category, name, part) ?? part));
  const materials = db
    .all<{ name: string; count: number; image_name: string | null; linked: number }>(
      `SELECT m_item.name, m.count, m_item.image_name,
              EXISTS (SELECT 1 FROM drops d WHERE d.item_id = m_item.id)
                OR EXISTS (SELECT 1 FROM equipment e WHERE e.item_id = m_item.id) AS linked
       FROM materials m
       JOIN items o ON o.id = m.owner_id
       JOIN items m_item ON m_item.id = m.item_id
       WHERE o.name = ? ORDER BY m.position`,
      name,
    )
    .map((m) => {
      const material: RecipeMaterial = { name: m.name, count: m.count, linked: m.linked === 1 };
      if (m.image_name) material.imageName = m.image_name;
      return material;
    });
  const sheet: EquipmentSheet = { category: row.category, prime: row.prime === 1, parts, materials };
  if (row.credits !== null) sheet.credits = row.credits;
  if (row.counterpart) sheet.counterpart = row.counterpart;
  if (row.wiki_url) sheet.wikiUrl = row.wiki_url;
  if (row.acquisition) {
    sheet.acquisition = JSON.parse(row.acquisition) as string[];
    const note = noteFor(sheet.acquisition, sheet.parts);
    if (note) sheet.note = note;
  }
  return sheet;
}

const PART_STATS = `SELECT
       i.name,
       COUNT(DISTINCT CASE WHEN s.kind = 'relic' THEN s.id END) AS relics,
       COUNT(DISTINCT CASE WHEN s.kind = 'relic' AND sr.vaulted = 0 THEN s.id END) AS open,
       COUNT(CASE WHEN s.kind <> 'relic' THEN 1 END) AS direct,
       MAX(CASE WHEN s.kind <> 'relic' AND d.conditional = 0 THEN d.chance END) AS best
     FROM drops d
     JOIN items i ON i.id = d.item_id
     JOIN sources s ON s.id = d.source_id
     LEFT JOIN items si ON s.kind = 'relic' AND si.name = s.name
     LEFT JOIN relics sr ON sr.item_id = si.id`;

function partOf(db: Db, name: string, label: string): EquipmentPart {
  return { name, label, ...partStatus(db.get<PartStats & { name: string }>(`${PART_STATS} WHERE i.name = ?`, name)) };
}

function partStatus(r: PartStats | undefined): Omit<EquipmentPart, "name" | "label"> {
  const part: Omit<EquipmentPart, "name" | "label"> = { status: "none" };
  if (!r || r.relics + r.direct === 0) return part;
  if (r.direct > 0) {
    part.status = "drops";
    if (r.best !== null) part.bestChance = r.best;
  } else {
    part.status = r.open > 0 ? "relics" : "vaulted";
  }
  if (r.relics > 0) {
    part.relics = r.relics;
    part.openRelics = r.open;
  }
  return part;
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
