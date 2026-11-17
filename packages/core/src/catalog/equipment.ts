// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// Which Warframes and weapons exist, from WFCD's item catalog
// (https://github.com/WFCD/warframe-items, data/json/*.json). The drop
// tables only know them through the parts that drop, so anything
// researched in the Dojo, bought from a vendor or given by a quest never
// shows up there; this list is what lets the app know about it anyway.

/** Each is also the item kind of its entries. */
export const EQUIPMENT_CATEGORIES = [
  "warframe",
  "primary",
  "secondary",
  "melee",
  "arch_gun",
  "arch_melee",
  "companion",
  "companion_weapon",
] as const;
export type EquipmentCategory = (typeof EQUIPMENT_CATEGORIES)[number];

/** The weapon categories. */
export const WEAPON_CATEGORIES = ["primary", "secondary", "melee", "arch_gun", "arch_melee", "companion_weapon"] as const;

/** The warframe-items files each category comes from. */
export const EQUIPMENT_FILES: Record<EquipmentCategory, readonly string[]> = {
  warframe: ["Warframes"],
  primary: ["Primary"],
  secondary: ["Secondary"],
  melee: ["Melee"],
  arch_gun: ["Arch-Gun"],
  arch_melee: ["Arch-Melee"],
  companion: ["Sentinels", "Pets"],
  companion_weapon: ["SentinelWeapons"],
};

export interface CatalogEntry {
  /** "Nezha", "Soma Prime". */
  name: string;
  category: EquipmentCategory;
  prime: boolean;
  /** The other version of the same thing ("Soma" <-> "Soma Prime"), when there is one. */
  counterpart?: string;
  /** Its page on the Warframe Wiki. */
  wikiUrl?: string;
  /** How to get it, as plain paragraphs from the wiki. */
  acquisition?: string[];
  /** For weapons: its parts as the drop tables name them ("Soma Prime Barrel"). */
  parts?: string[];
}

interface RawItem {
  name?: unknown;
  isPrime?: unknown;
  productCategory?: unknown;
  type?: unknown;
  wikiaUrl?: unknown;
}

const WIKI = "https://wiki.warframe.com/w/";

/**
 * The entries of one category file: playable Warframes (no Necramechs or
 * special suits like Excalibur Umbra), real weapons (no Zaw parts or amps),
 * and companions (no mutagens, antigens or other pet parts).
 */
export function parseEquipment(category: EquipmentCategory, raw: unknown): CatalogEntry[] {
  if (!Array.isArray(raw)) throw new Error(`Not a WFCD ${EQUIPMENT_FILES[category].join("/")} file: expected an array`);
  const entries = new Map<string, CatalogEntry>();
  for (const item of raw as RawItem[]) {
    if (typeof item?.name !== "string" || !belongs(category, item)) continue;
    const name = item.name.trim();
    if (!name || entries.has(name)) continue;
    const entry: CatalogEntry = { name, category, prime: item.isPrime === true || / Prime$/.test(name) };
    if (typeof item.wikiaUrl === "string" && item.wikiaUrl.startsWith(WIKI)) entry.wikiUrl = item.wikiaUrl;
    entries.set(name, entry);
  }
  return [...entries.values()];
}

function belongs(category: EquipmentCategory, item: RawItem): boolean {
  switch (category) {
    case "warframe":
      return item.productCategory === "Suits";
    case "companion":
      return item.type === "Sentinel" || item.type === "Pets" || item.productCategory === "KubrowPets" || item.productCategory === "SpecialItems";
    default:
      return item.type !== "Zaw Component" && item.productCategory !== "OperatorAmps";
  }
}

/** Sorts the entries and pairs each regular one with its Prime. Names repeated across files keep the first. */
export function joinCatalog(lists: readonly CatalogEntry[][]): CatalogEntry[] {
  const byName = new Map<string, CatalogEntry>();
  for (const list of lists) for (const entry of list) if (!byName.has(entry.name)) byName.set(entry.name, entry);
  for (const entry of byName.values()) {
    const other = entry.prime ? entry.name.replace(/ Prime$/, "") : `${entry.name} Prime`;
    if (other !== entry.name && byName.get(other)?.category === entry.category) entry.counterpart = other;
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** The wiki page holding the article text: Warframes and sentinels keep it in a "/Main" subpage. */
export function wikiPage(entry: CatalogEntry): string {
  const page = entry.wikiUrl ? decodeURIComponent(entry.wikiUrl.slice(WIKI.length)).replace(/_/g, " ") : entry.name;
  return entry.category === "warframe" || entry.category === "companion" ? `${page}/Main` : page;
}

/** The four blueprints a Warframe is built from, as the drop tables name them. */
export function warframeParts(name: string): string[] {
  return [`${name} Blueprint`, `${name} Chassis Blueprint`, `${name} Neuroptics Blueprint`, `${name} Systems Blueprint`];
}

/** What follows a weapon's name in its parts' names, each maybe followed by " Blueprint". */
const PART_WORDS = new Set([
  "Barrel",
  "Receiver",
  "Stock",
  "Blade",
  "Blades",
  "Handle",
  "Hilt",
  "Link",
  "String",
  "Grip",
  "Gauntlet",
  "Left Gauntlet",
  "Right Gauntlet",
  "Glove",
  "Guard",
  "Upper Limb",
  "Lower Limb",
  "Head",
  "Ornament",
  "Disc",
  "Pouch",
  "Stars",
  "Boot",
  "Chain",
  "Rivet",
  "Motor",
  "Core",
  "Chassis",
  "Subcortex",
  // Sentinels
  "Cerebrum",
  "Carapace",
  "Systems",
]);

/** The part's kind of piece: "Soma Prime Barrel" of "Soma Prime" -> "Barrel"; main blueprint -> "Blueprint". */
export function partLabel(weapon: string, part: string): string | undefined {
  if (!part.startsWith(`${weapon} `)) return undefined;
  const rest = part.slice(weapon.length + 1);
  if (rest === "Blueprint") return rest;
  const base = rest.replace(/ Blueprint$/, "");
  return PART_WORDS.has(base) ? base : undefined;
}

/**
 * Gives each weapon and companion the drop-table items that are its parts. An item goes
 * to the longest weapon name it starts with, so "Lex Prime Barrel" is Lex
 * Prime's, not Lex's. Main blueprint first, then by name.
 */
export function assignWeaponParts(entries: readonly CatalogEntry[], items: Iterable<string>): void {
  const weapons = new Map(entries.filter((e) => e.category !== "warframe").map((e) => [e.name, e]));
  const parts = new Map<string, string[]>();
  for (const item of items) {
    let owner: string | undefined;
    for (let i = item.indexOf(" "); i > 0; i = item.indexOf(" ", i + 1)) {
      const prefix = item.slice(0, i);
      if (weapons.has(prefix)) owner = prefix;
    }
    if (!owner || !partLabel(owner, item)) continue;
    parts.set(owner, [...(parts.get(owner) ?? []), item]);
  }
  for (const [name, list] of parts) {
    const main = `${name} Blueprint`;
    weapons.get(name)!.parts = list.sort((a, b) => Number(b === main) - Number(a === main) || a.localeCompare(b));
  }
}
