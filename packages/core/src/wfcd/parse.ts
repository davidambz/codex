// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// Turns WFCD's drop data (https://drops.warframestat.us/data/all.json)
// into flat items, sources and drops. Pure: the caller fetches the JSON.
//
// Tables not read here, on purpose:
// - enemyModTables / enemyBlueprintTables: the same rows as modLocations /
//   blueprintLocations, seen from the enemy's side;
// - syndicates: bought with standing, not dropped.

import type { Drop, DropData, Item, ItemKind, Refinement, Relic, Rotation, Source } from "../types.ts";
import { REFINEMENTS } from "../types.ts";
import { kindFromName, parseRelicName, relicItemName, splitQuantity } from "./names.ts";

interface RawReward {
  itemName?: string;
  modName?: string;
  item?: string;
  rarity?: string;
  chance: number | string | null;
  rotation?: string;
  stage?: string;
}

type RawRewards = RawReward[] | Record<string, RawReward[]>;

interface RawRelic {
  tier: string;
  relicName: string;
  state: string;
  rewards: RawReward[];
}

interface RawEnemyDrop {
  enemyName: string;
  enemyModDropChance?: number | string;
  enemyItemDropChance?: number | string;
  rarity?: string;
  chance: number | string | null;
}

interface RawBounty {
  bountyLevel: string;
  rewards: RawRewards;
}

export interface RawDropData {
  missionRewards: Record<string, Record<string, { gameMode?: string; isEvent?: boolean; rewards: RawRewards }>>;
  relics: RawRelic[];
  transientRewards?: { objectiveName: string; rewards: RawReward[] }[];
  modLocations?: { modName: string; enemies: RawEnemyDrop[] }[];
  blueprintLocations?: { itemName?: string; blueprintName?: string; enemies: RawEnemyDrop[] }[];
  sortieRewards?: RawReward[];
  keyRewards?: { keyName: string; rewards: RawRewards }[];
  cetusBountyRewards?: RawBounty[];
  solarisBountyRewards?: RawBounty[];
  deimosRewards?: RawBounty[];
  zarimanRewards?: RawBounty[];
  entratiLabRewards?: RawBounty[];
  hexRewards?: RawBounty[];
  resourceByAvatar?: RawAvatar[];
  sigilByAvatar?: RawAvatar[];
  additionalItemByAvatar?: RawAvatar[];
}

interface RawAvatar {
  source: string;
  items: RawReward[];
}

/** Where each bounty table's missions happen. */
const BOUNTY_LOCATIONS = {
  cetusBountyRewards: "Plains of Eidolon",
  solarisBountyRewards: "Orb Vallis",
  deimosRewards: "Cambion Drift",
  zarimanRewards: "Zariman",
  entratiLabRewards: "Sanctum Anatomica",
  hexRewards: "Höllvania",
} as const;

const AVATAR_TABLES = ["resourceByAvatar", "sigilByAvatar", "additionalItemByAvatar"] as const;

/** Item kinds a table can vouch for, stronger than a guess from the name. */
const KIND_RANK: Record<ItemKind, number> = {
  other: 0,
  blueprint: 1,
  mod: 2,
  arcane: 2,
  credits: 3,
  endo: 3,
  ayatan: 3,
  prime_part: 3,
  relic: 4,
  part: 1,
  warframe: 5,
  primary: 5,
  secondary: 5,
  melee: 5,
  arch_gun: 5,
  arch_melee: 5,
  companion: 5,
  companion_weapon: 5,
};

interface DropFields {
  rotation?: Rotation;
  refinement?: Refinement;
  stage?: string;
  rarity?: string;
  chance: number;
  enemyChance?: number;
  tableChance?: number;
  conditional?: boolean;
}

class Builder {
  readonly items = new Map<string, ItemKind>();
  readonly sources = new Map<string, Source>();
  readonly drops = new Map<string, Drop>();
  readonly relics = new Map<string, Relic>();
  /** Relic items handed out by something other than opening a relic. */
  readonly obtainableRelics = new Set<string>();
  /** Rows WFCD lists without a usable chance (it has a few null ones). */
  skipped = 0;

  source(source: Source): string {
    if (!this.sources.has(source.key)) this.sources.set(source.key, source);
    return source.key;
  }

  item(name: string, hint?: ItemKind): void {
    const guessed = kindFromName(name);
    const kind = hint && KIND_RANK[hint] > KIND_RANK[guessed] ? hint : guessed;
    const known = this.items.get(name);
    if (!known || KIND_RANK[kind] > KIND_RANK[known]) this.items.set(name, kind);
  }

  relic(tier: string, code: string): string {
    const item = relicItemName(tier, code);
    if (!this.relics.has(item)) {
      const parsed = parseRelicName(item);
      if (!parsed) throw new Error(`Unrecognised relic: ${item}`);
      this.relics.set(item, { item, tier: parsed.tier, code: parsed.code, vaulted: true });
    }
    this.item(item, "relic");
    return item;
  }

  drop(rawName: string, sourceKey: string, fields: DropFields, hint?: ItemKind): void {
    const { name: plain, quantity } = splitQuantity(rawName);
    let name = plain;
    let refinement = fields.refinement;
    const relic = parseRelicName(plain);
    if (relic) {
      name = this.relic(relic.tier, relic.code);
      refinement = relic.refinement ?? refinement;
      if (!sourceKey.startsWith("relic:")) this.obtainableRelics.add(name);
    } else {
      this.item(name, hint);
    }

    const key = [name, sourceKey, fields.rotation, refinement, fields.stage, quantity].join("\u0000");
    const existing = this.drops.get(key);
    if (existing) {
      // The same reward listed more than once in one table is several
      // slots: the chance of getting it is their sum.
      existing.chance += fields.chance;
      existing.slots = (existing.slots ?? 1) + 1;
      return;
    }
    const drop: Drop = { item: name, source: sourceKey, chance: fields.chance };
    if (fields.rotation) drop.rotation = fields.rotation;
    if (refinement) drop.refinement = refinement;
    if (fields.stage) drop.stage = fields.stage;
    if (fields.rarity) drop.rarity = fields.rarity;
    if (quantity !== undefined) drop.quantity = quantity;
    if (fields.enemyChance !== undefined) drop.enemyChance = fields.enemyChance;
    if (fields.tableChance !== undefined) drop.tableChance = fields.tableChance;
    if (fields.conditional) drop.conditional = true;
    this.drops.set(key, drop);
  }

  rewards(rewards: RawRewards, sourceKey: string, extra: Partial<DropFields> = {}): void {
    for (const [rotation, list] of rotations(rewards)) {
      for (const reward of list) {
        const name = rewardName(reward);
        const chance = num(reward.chance);
        if (!name || chance === undefined) {
          this.skipped++;
          continue;
        }
        this.drop(name, sourceKey, {
          ...extra,
          rotation: rotation ?? asRotation(reward.rotation),
          stage: reward.stage?.trim() || undefined,
          rarity: reward.rarity,
          chance,
        });
      }
    }
  }

  result(): DropData {
    for (const relic of this.relics.values()) relic.vaulted = !this.obtainableRelics.has(relic.item);
    const items: Item[] = [...this.items].map(([name, kind]) => ({ name, kind }));
    const drops = [...this.drops.values()];
    for (const drop of drops) drop.chance = round(drop.chance);
    return {
      items: items.sort((a, b) => a.name.localeCompare(b.name)),
      sources: [...this.sources.values()].sort((a, b) => a.key.localeCompare(b.key)),
      drops,
      relics: [...this.relics.values()].sort((a, b) => a.item.localeCompare(b.item)),
      skipped: this.skipped,
    };
  }
}

export function parseDropData(raw: unknown): DropData {
  assertDropData(raw);
  const b = new Builder();

  for (const [planet, nodes] of Object.entries(raw.missionRewards)) {
    for (const [node, mission] of Object.entries(nodes)) {
      const key = b.source({
        key: `mission:${planet}/${node}`,
        kind: "mission",
        name: node,
        location: planet,
        gameMode: mission.gameMode,
        isEvent: mission.isEvent || undefined,
      });
      b.rewards(mission.rewards, key);
    }
  }

  for (const relic of raw.relics) {
    const item = b.relic(relic.tier, relic.relicName);
    const refinement = REFINEMENTS.find((r) => r === relic.state);
    const key = b.source({ key: `relic:${relic.tier} ${relic.relicName}`, kind: "relic", name: item });
    b.rewards(relic.rewards, key, { refinement });
  }

  for (const transient of raw.transientRewards ?? []) {
    const key = b.source({
      key: `transient:${transient.objectiveName}`,
      kind: "transient",
      name: transient.objectiveName,
    });
    b.rewards(transient.rewards, key);
  }

  for (const mod of raw.modLocations ?? []) {
    for (const enemy of mod.enemies) {
      enemyDrop(b, mod.modName, enemy, enemy.enemyModDropChance, mod.modName.startsWith("Arcane ") ? "arcane" : "mod");
    }
  }

  for (const blueprint of raw.blueprintLocations ?? []) {
    const name = blueprint.blueprintName ?? blueprint.itemName;
    if (!name) continue;
    for (const enemy of blueprint.enemies) enemyDrop(b, name, enemy, enemy.enemyItemDropChance);
  }

  if (raw.sortieRewards?.length) {
    const key = b.source({ key: "sortie:Sortie", kind: "sortie", name: "Sortie" });
    b.rewards(raw.sortieRewards, key);
  }

  for (const k of raw.keyRewards ?? []) {
    const key = b.source({ key: `key:${k.keyName}`, kind: "key", name: k.keyName });
    b.rewards(k.rewards, key);
  }

  for (const [table, location] of Object.entries(BOUNTY_LOCATIONS)) {
    for (const bounty of raw[table as keyof typeof BOUNTY_LOCATIONS] ?? []) {
      const name = bounty.bountyLevel.trim().replace(/\s+/g, " ");
      const key = b.source({ key: `bounty:${location}/${name}`, kind: "bounty", name, location });
      b.rewards(bounty.rewards, key);
    }
  }

  // These tables say what an enemy or object drops *when* it drops one of
  // them, not the chance per kill, so their drops are marked conditional.
  for (const table of AVATAR_TABLES) {
    for (const avatar of raw[table] ?? []) {
      const key = b.source({ key: `enemy:${avatar.source}`, kind: "enemy", name: avatar.source });
      b.rewards(avatar.items, key, { conditional: true });
    }
  }

  return b.result();
}

function enemyDrop(
  b: Builder,
  name: string,
  enemy: RawEnemyDrop,
  enemyChance: number | string | undefined,
  hint?: ItemKind,
): void {
  const key = b.source({ key: `enemy:${enemy.enemyName}`, kind: "enemy", name: enemy.enemyName });
  const tableChance = num(enemy.chance);
  const outer = enemyChance === undefined ? 100 : num(enemyChance);
  if (tableChance === undefined || outer === undefined) {
    b.skipped++;
    return;
  }
  b.drop(
    name,
    key,
    { rarity: enemy.rarity, chance: (outer * tableChance) / 100, enemyChance: outer, tableChance },
    hint,
  );
}

function* rotations(rewards: RawRewards): Generator<[Rotation | undefined, RawReward[]]> {
  if (Array.isArray(rewards)) {
    yield [undefined, rewards];
    return;
  }
  for (const [rotation, list] of Object.entries(rewards)) yield [asRotation(rotation), list];
}

function rewardName(reward: RawReward): string | undefined {
  return (reward.itemName ?? reward.modName ?? reward.item)?.trim() || undefined;
}

function asRotation(value: string | undefined): Rotation | undefined {
  return value === "A" || value === "B" || value === "C" ? value : undefined;
}

function num(value: number | string | null | undefined): number | undefined {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number.parseFloat(value) : Number.NaN;
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function round(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

function assertDropData(raw: unknown): asserts raw is RawDropData {
  const data = raw as Partial<RawDropData> | null;
  if (!data || typeof data !== "object" || typeof data.missionRewards !== "object" || !Array.isArray(data.relics)) {
    throw new Error("Not WFCD drop data: missionRewards or relics missing");
  }
}
