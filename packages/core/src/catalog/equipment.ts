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
  /** How many of a piece the recipe takes, by piece, when more than one ("Barrel": 2 for Akbolto Prime). */
  pieceCounts?: Record<string, number>;
  /** Each piece's internal name ("Chassis" -> ".../NezhaChassisComponent"), to find its own recipe. */
  pieceIds?: Record<string, string>;
  /** What building each piece in the Foundry takes, by piece: Nezha's Chassis takes Ferrite, Rubedo... */
  partRecipes?: Record<string, PartRecipe>;
  /** Everything else the recipe consumes: resources, and whole weapons for some ("Bolto" for Akbolto). */
  materials?: Material[];
  /** Credits the Foundry charges to build it. */
  credits?: number;
}

/** What a part's own blueprint consumes. */
export interface PartRecipe {
  materials: Material[];
  credits?: number;
}

/** "15 Orokin Cell". */
export interface Material {
  name: string;
  count: number;
}

interface RawItem {
  name?: unknown;
  isPrime?: unknown;
  productCategory?: unknown;
  type?: unknown;
  wikiaUrl?: unknown;
  imageName?: unknown;
  components?: unknown;
  buildPrice?: unknown;
}

/** Warframe-items files whose entries a recipe may consume, besides the equipment itself. */
export const MATERIAL_FILES = ["Resources", "Misc"] as const;

/** Internal name -> English name, for every entry of the given warframe-items files. */
export function namesById(files: readonly unknown[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const file of files) {
    if (!Array.isArray(file)) continue;
    for (const item of file as { name?: unknown; uniqueName?: unknown }[]) {
      if (typeof item?.name === "string" && typeof item.uniqueName === "string" && !names.has(item.uniqueName)) {
        names.set(item.uniqueName, item.name.trim());
      }
    }
  }
  return names;
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
    case "Day Chassis":
    case "Night Chassis":
    case "Day Neuroptics":
    case "Night Neuroptics":
    case "Day Systems":
    case "Night Systems":
      return partImage(label.split(" ")[1], prime);
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
export function parseEquipment(
  category: EquipmentCategory,
  raw: unknown,
  names: ReadonlyMap<string, string> = new Map(),
): CatalogEntry[] {
  if (!Array.isArray(raw)) throw new Error(`Not a WFCD ${EQUIPMENT_FILES[category].join("/")} file: expected an array`);
  const entries = new Map<string, CatalogEntry>();
  for (const item of raw as RawItem[]) {
    if (typeof item?.name !== "string" || !belongs(category, item)) continue;
    const name = item.name.trim();
    if (!name || entries.has(name)) continue;
    const entry: CatalogEntry = { name, category, prime: item.isPrime === true || / Prime$/.test(name) };
    if (typeof item.imageName === "string" && SAFE_IMAGE.test(item.imageName)) entry.imageName = item.imageName;
    if (typeof item.wikiaUrl === "string" && item.wikiaUrl.startsWith(WIKI)) entry.wikiUrl = item.wikiaUrl;
    if (Array.isArray(item.components)) {
      const components = item.components as { uniqueName?: unknown; itemCount?: unknown }[];
      const recipe = [
        ...new Set(components.flatMap((c) => (typeof c?.uniqueName === "string" ? (recipePiece(c.uniqueName) ?? []) : []))),
      ];
      if (recipe.length > 0) entry.recipe = recipe;
      const counts: Record<string, number> = {};
      const ids: Record<string, string> = {};
      for (const c of components) {
        const piece = typeof c?.uniqueName === "string" ? recipePiece(c.uniqueName) : undefined;
        if (!piece) continue;
        if (piece !== "Blueprint") ids[piece] ??= c.uniqueName as string;
        counts[piece] = (counts[piece] ?? 0) + (typeof c.itemCount === "number" && c.itemCount > 0 ? c.itemCount : 1);
      }
      const many = Object.entries(counts).filter(([, count]) => count > 1);
      if (many.length > 0) entry.pieceCounts = Object.fromEntries(many);
      if (Object.keys(ids).length > 0) entry.pieceIds = ids;
      const materials = recipeMaterials(components, names);
      if (materials.length > 0) entry.materials = materials;
    }
    if (typeof item.buildPrice === "number" && item.buildPrice > 0) entry.credits = item.buildPrice;
    entries.set(name, entry);
  }
  return [...entries.values()];
}

/**
 * What a recipe consumes besides its blueprints and parts, in recipe order,
 * counts of a repeated component added up (Akbolto lists Bolto twice).
 * Components with no known name are left out.
 */
function recipeMaterials(
  components: readonly { uniqueName?: unknown; itemCount?: unknown }[],
  names: ReadonlyMap<string, string>,
): Material[] {
  const counts = new Map<string, number>();
  for (const c of components) {
    if (typeof c?.uniqueName !== "string" || c.uniqueName.includes("/Recipes/") || recipePiece(c.uniqueName)) continue;
    if (c.uniqueName.includes("/FishBait/")) continue;
    const name = names.get(c.uniqueName);
    if (!name) continue;
    const count = typeof c.itemCount === "number" && c.itemCount > 0 ? c.itemCount : 1;
    counts.set(name, (counts.get(name) ?? 0) + count);
  }
  return [...counts].map(([name, count]) => ({ name, count }));
}

interface ExportRecipe {
  resultType?: unknown;
  buildPrice?: unknown;
  ingredients?: { ItemType?: unknown; ItemCount?: unknown }[];
}

/**
 * Gives each piece its own blueprint's cost, from the game's Public
 * Export (ExportRecipes): the recipe whose result is the piece. Prime
 * weapon parts are found ready-made and have none.
 */
export function applyPartRecipes(entries: readonly CatalogEntry[], exportRecipes: unknown, names: ReadonlyMap<string, string>): void {
  const list = (exportRecipes as { ExportRecipes?: unknown } | null)?.ExportRecipes;
  if (!Array.isArray(list)) throw new Error("Not a Public Export recipes file: expected ExportRecipes");
  const byResult = new Map<string, ExportRecipe>();
  for (const recipe of list as ExportRecipe[]) {
    if (typeof recipe?.resultType === "string" && !byResult.has(recipe.resultType)) byResult.set(recipe.resultType, recipe);
  }
  for (const entry of entries) {
    const recipes: Record<string, PartRecipe> = {};
    for (const [piece, id] of Object.entries(entry.pieceIds ?? {})) {
      const recipe = byResult.get(id);
      if (!recipe) continue;
      const components = (Array.isArray(recipe.ingredients) ? recipe.ingredients : []).map((i) => ({
        uniqueName: i?.ItemType,
        itemCount: i?.ItemCount,
      }));
      const part: PartRecipe = { materials: recipeMaterials(components, names) };
      if (typeof recipe.buildPrice === "number" && recipe.buildPrice > 0) part.credits = recipe.buildPrice;
      if (part.materials.length > 0 || part.credits !== undefined) recipes[piece] = part;
    }
    if (Object.keys(recipes).length > 0) entry.partRecipes = recipes;
  }
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

/**
 * A Warframe part's piece: "Nezha Chassis Blueprint" -> "Chassis",
 * "Equinox Day Chassis Blueprint" -> "Day Chassis", the main one -> "Blueprint".
 */
export function warframePartLabel(frame: string, part: string): string | undefined {
  if (!part.startsWith(`${frame} `)) return undefined;
  const rest = part.slice(frame.length + 1);
  return rest === "Blueprint" ? rest : rest.replace(/ Blueprint$/, "");
}

/** The piece a part is, by the kind of thing it belongs to. */
export function equipmentPartLabel(category: EquipmentCategory, owner: string, part: string): string | undefined {
  return category === "warframe" ? warframePartLabel(owner, part) : partLabel(owner, part);
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

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A Warframe's parts are the blueprints its recipe calls for, usually the
 * four standard ones; Excalibur Umbra is built from its main blueprint
 * alone, and Excalibur Prime, a Founders reward, from nothing. When the
 * drop tables name variants, those win: Equinox is built from Day and
 * Night Chassis, Neuroptics, Systems and Aspect blueprints.
 */
function assignWarframeParts(entries: readonly CatalogEntry[], items: readonly string[]): void {
  for (const frame of entries) {
    if (frame.category !== "warframe") continue;
    const variant = new RegExp(`^${escapeRegExp(frame.name)} (?!Prime )\\S+ (Chassis|Neuroptics|Systems|Aspect) Blueprint$`);
    const variants = items.filter((item) => variant.test(item)).sort((a, b) => a.localeCompare(b));
    if (variants.length > 0) {
      frame.parts = [`${frame.name} Blueprint`, ...variants];
    } else if (frame.recipe) {
      const wanted = new Set(frame.recipe.map((piece) => (piece === "Blueprint" ? "" : ` ${piece}`)));
      frame.parts = warframeParts(frame.name).filter((part) =>
        wanted.has(part.slice(frame.name.length).replace(/ Blueprint$/, "")),
      );
    } else if (!frame.parts) {
      // No recipe in the catalog: the usual four, unless it's a Prime (those always list theirs).
      frame.parts = frame.prime ? [] : warframeParts(frame.name);
    }
  }
}

/**
 * Gives each weapon and companion the drop-table items that are its parts. An item goes
 * to the longest weapon name it starts with, so "Lex Prime Barrel" is Lex
 * Prime's, not Lex's. Main blueprint first, then by name.
 */
export function assignWeaponParts(entries: readonly CatalogEntry[], items: Iterable<string>): void {
  assignWarframeParts(entries, [...items]);
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
