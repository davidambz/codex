// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

/** What a thing is, guessed from its name and the table it came from. */
export type ItemKind =
  | "warframe"
  | "relic"
  | "prime_part"
  | "blueprint"
  | "mod"
  | "arcane"
  | "ayatan"
  | "credits"
  | "endo"
  | "other";

/** Where a drop happens. */
export type SourceKind =
  | "mission"
  | "relic"
  | "enemy"
  | "bounty"
  | "key"
  | "transient"
  | "sortie";

export type Rotation = "A" | "B" | "C";

export const REFINEMENTS = ["Intact", "Exceptional", "Flawless", "Radiant"] as const;
export type Refinement = (typeof REFINEMENTS)[number];

export const RELIC_TIERS = ["Lith", "Meso", "Neo", "Axi", "Requiem", "Vanguard"] as const;
export type RelicTier = (typeof RELIC_TIERS)[number];

export interface Item {
  /** Unique, as the game spells it, without a quantity prefix ("Oxium", not "100X Oxium"). */
  name: string;
  kind: ItemKind;
}

export interface Source {
  /** Stable identity across ingests, e.g. "mission:Sedna/Hydron" or "relic:Axi G13". */
  key: string;
  kind: SourceKind;
  /** What the UI shows: "Hydron", "Axi G13 Relic", "Void Shade". */
  name: string;
  /** Planet, open world or tileset, when there is one. */
  location?: string;
  gameMode?: string;
  isEvent?: boolean;
}

export interface Drop {
  item: string;
  /** Source key. */
  source: string;
  rotation?: Rotation;
  /** For relic sources: the refinement the chance applies to. For relic items: the refinement it drops already at. */
  refinement?: Refinement;
  /** Bounty stage as written in the tables ("Stage 1", "Final Stage"). */
  stage?: string;
  rarity?: string;
  /**
   * Effective chance per attempt, in percent: per rotation reward, per
   * relic opened, or per enemy killed (the enemy's chance to drop anything
   * from the table times the item's share of it).
   */
  chance: number;
  /** Stack size when the reward is a bundle ("100X Oxium" -> 100). */
  quantity?: number;
  /** How many identical rows were merged into this one (chances summed). */
  slots?: number;
  /** For enemy drops: the two factors of `chance`. */
  enemyChance?: number;
  tableChance?: number;
  /**
   * The chance is the item's share of what the source drops when it drops
   * something from this table, not a chance per kill (WFCD's "by avatar"
   * tables don't say how often that happens).
   */
  conditional?: boolean;
}

export interface Relic {
  /** The relic as an item, e.g. "Axi G13 Relic". */
  item: string;
  tier: RelicTier;
  /** "G13". */
  code: string;
  /** No mission, bounty, key or transient reward currently gives it. */
  vaulted: boolean;
}

export interface DropData {
  items: Item[];
  sources: Source[];
  drops: Drop[];
  relics: Relic[];
  /** Source rows dropped because they had no usable chance. */
  skipped: number;
}
