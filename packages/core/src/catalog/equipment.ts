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
  /** Its picture's file name in warframe-items' data/img ("SomaPrime.png"). */
  imageName?: string;
  /** Its page on the Warframe Wiki. */
  wikiUrl?: string;
  /** How to get it, as plain paragraphs from the wiki. */
  acquisition?: string[];
  /** For weapons and companions: its parts as the drop tables name them ("Soma Prime Barrel"). */
  parts?: string[];
  /** The pieces its recipe calls for ("Blueprint", "Barrel"), from the catalog, whether they drop or not. */
  recipe?: string[];
}

interface RawItem {
  name?: unknown;
  isPrime?: unknown;
  productCategory?: unknown;
  type?: unknown;
  wikiaUrl?: unknown;
  imageName?: unknown;
  components?: unknown;
}

const WIKI = "https://wiki.warframe.com/w/";

/** A plain file name: it ends up in a URL and a file path. */
export const SAFE_IMAGE = /^[\w.-]+\.(png|jpe?g|webp)$/i;

/** Where warframe-items keeps its pictures. */
export const IMAGE_BASE_URL = "https://raw.githubusercontent.com/WFCD/warframe-items/master/data/img/";

/**
 * The game's generic picture for a kind of part, so part icons look like
 * the in-game Foundry. Blueprints, and pieces with no generic picture,
 * have none: the game draws those as the item itself on blueprint paper.
 */
export function partImage(label: string, prime: boolean): string | undefined {
  const p = prime ? "Prime" : "";
  switch (label) {
    case "Chassis":
    case "Carapace":
      return `GenericWarframe${p}Chassis.png`;
    case "Neuroptics":
    case "Cerebrum":
      return `GenericWarframe${p}Helmet.png`;
    case "Systems":
      return `GenericWarframe${p}System.png`;
    case "Barrel":
      return `GenericGun${p}Barrel.png`;
    case "Receiver":
      return `GenericGun${p}Receiver.png`;
    case "Stock":
      return `GenericGun${p}Stock.png`;
    case "Blade":
    case "Blades":
    case "Head":
    case "Disc":
    case "Stars":
      return `GenericWeapon${p}Blade.png`;
    case "Hilt":
    case "Handle":
    case "Grip":
    case "Link":
    case "Chain":
      return `GenericWeapon${p}Hilt.png`;
    case "Guard":
      return `GenericWeapon${p}Guard.png`;
    case "String":
    case "Upper Limb":
    case "Lower Limb":
      return `GenericComponent${p}Latch.png`;
    default:
      return undefined;
  }
}

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
    if (typeof item.imageName === "string" && SAFE_IMAGE.test(item.imageName)) entry.imageName = item.imageName;
    if (typeof item.wikiaUrl === "string" && item.wikiaUrl.startsWith(WIKI)) entry.wikiUrl = item.wikiaUrl;
    if (category !== "warframe" && Array.isArray(item.components)) {
      const recipe = [
        ...new Set(
          item.components.flatMap((c: { uniqueName?: unknown }) =>
            typeof c?.uniqueName === "string" ? (recipePiece(c.uniqueName) ?? []) : [],
          ),
        ),
      ];
      if (recipe.length > 0) entry.recipe = recipe;
    }
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
  "Neuroptics",
  "Subcortex",
  // Sentinels
  "Cerebrum",
  "Carapace",
  "Systems",
]);

/** "UpperLimb" -> "Upper Limb", longest first so "LeftGauntlet" isn't read as "Gauntlet". */
const COMPACT_WORDS = [...PART_WORDS]
  .map((word) => [word.replace(/ /g, ""), word] as const)
  .sort((a, b) => b[0].length - a[0].length);

/**
 * Which piece a recipe component is, from its internal name, since the
 * catalog leaves component names out: ".../WeaponParts/SomaPrimeBarrel"
 * -> "Barrel", ".../Weapons/SomaPrimeBlueprint" -> "Blueprint". Only
 * blueprints and parts count, not resources ("/MiscItems/OrokinCell")
 * nor weapons a recipe consumes. Dojo research keeps its blueprints with
 * the weapons (".../ClanTech/Energy/ChainLightningRifleBlueprint").
 */
export function recipePiece(uniqueName: string): string | undefined {
  if (!uniqueName.includes("/Recipes/")) return /^\/Lotus\/Weapons\/.*Blueprint$/.test(uniqueName) ? "Blueprint" : undefined;
  let rest = uniqueName.slice(uniqueName.lastIndexOf("/") + 1).replace(/Component$/, "");
  const blueprint = rest.endsWith("Blueprint");
  if (blueprint) rest = rest.slice(0, -"Blueprint".length);
  if (rest.endsWith("Helmet")) return "Neuroptics";
  const word = COMPACT_WORDS.find(([compact]) => rest.endsWith(compact));
  if (word) return word[1];
  return blueprint ? "Blueprint" : undefined;
}

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
  // Pieces the recipe calls for that no drop table names still belong on the sheet.
  const known = new Set(items);
  for (const weapon of weapons.values()) {
    const list = new Set([...(weapon.parts ?? []), ...(parts.get(weapon.name) ?? [])]);
    for (const piece of weapon.recipe ?? []) {
      const plain = `${weapon.name} ${piece}`;
      const withBlueprint = `${plain} Blueprint`;
      if (piece !== "Blueprint" && (list.has(withBlueprint) || known.has(withBlueprint))) list.add(withBlueprint);
      else list.add(plain);
    }
    if (list.size === 0) continue;
    const main = `${weapon.name} Blueprint`;
    weapon.parts = [...list].sort((a, b) => Number(b === main) - Number(a === main) || a.localeCompare(b));
  }
}
