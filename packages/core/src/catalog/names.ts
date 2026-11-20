// Codex — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// Item names in other languages, from WFCD's warframe-items: its category
// files tie each English name to the game's internal id (uniqueName), and
// data/json/i18n/<lang>.json gives that id's name in each language. Only
// names the game data has whole are used; names the drop tables compose
// ("Alternox Prime Stock") have no entry and stay in English.

import { RELIC_TIERS } from "../types.ts";
import { SAFE_IMAGE } from "./equipment.ts";

/** Languages WFCD translates, plus English. "tc" is Traditional Chinese, "zh" Simplified. */
export const ITEM_LANGUAGES = [
  "en",
  "pt",
  "es",
  "fr",
  "de",
  "it",
  "pl",
  "ru",
  "uk",
  "tr",
  "ja",
  "ko",
  "zh",
  "tc",
  "th",
] as const;
export type ItemLanguage = (typeof ITEM_LANGUAGES)[number];

/** Each language in its own words, for pickers. */
export const LANGUAGE_NAMES: Record<ItemLanguage, string> = {
  en: "English",
  pt: "Português",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  pl: "Polski",
  ru: "Русский",
  uk: "Українська",
  tr: "Türkçe",
  ja: "日本語",
  ko: "한국어",
  zh: "简体中文",
  tc: "繁體中文",
  th: "ไทย",
};

export function isItemLanguage(value: unknown): value is ItemLanguage {
  return typeof value === "string" && (ITEM_LANGUAGES as readonly string[]).includes(value);
}

/** The language item names should default to for a system locale ("pt-BR" -> "pt", "zh-TW" -> "tc"). */
export function itemLanguageForLocale(locale: string): ItemLanguage {
  const lower = locale.toLowerCase();
  if (/^zh-(tw|hk|mo|hant)/.test(lower)) return "tc";
  const base = lower.split(/[-_]/)[0];
  return isItemLanguage(base) ? base : "en";
}

/** The warframe-items category files whose items the drop tables can name. */
export const CATALOG_FILES = [
  "Arcanes",
  "Mods",
  "Resources",
  "Misc",
  "Relics",
  "Primary",
  "Secondary",
  "Melee",
  "Arch-Gun",
  "Arch-Melee",
  "Archwing",
  "Sentinels",
  "SentinelWeapons",
  "Pets",
  "Gear",
  "Sigils",
  "Fish",
  "Warframes",
] as const;

const RELIC_ENTRY = new RegExp(`^(${RELIC_TIERS.join("|")}) (\\S+) (?:Intact|Exceptional|Flawless|Radiant)$`);

/**
 * English name, as the drop tables spell it, to the game's id. Relics are
 * listed once per refinement ("Axi A1 Intact"); the tables call them "Axi A1 Relic".
 */
export function englishIds(files: readonly unknown[]): Map<string, string> {
  const ids = new Map<string, string>();
  for (const file of files) {
    if (!Array.isArray(file)) continue;
    for (const item of file as { name?: unknown; uniqueName?: unknown }[]) {
      if (typeof item?.name !== "string" || typeof item.uniqueName !== "string") continue;
      const relic = RELIC_ENTRY.exec(item.name);
      const name = relic ? `${relic[1]} ${relic[2]} Relic` : item.name.trim();
      if (!ids.has(name)) ids.set(name, item.uniqueName);
    }
  }
  return ids;
}

/**
 * English name, as the drop tables spell it, to its picture in
 * warframe-items' data/img. A relic takes its Intact picture.
 */
export function englishImages(files: readonly unknown[]): Map<string, string> {
  const images = new Map<string, string>();
  for (const file of files) {
    if (!Array.isArray(file)) continue;
    for (const item of file as { name?: unknown; imageName?: unknown }[]) {
      if (typeof item?.name !== "string" || typeof item.imageName !== "string" || !SAFE_IMAGE.test(item.imageName)) continue;
      const relic = RELIC_ENTRY.exec(item.name);
      if (relic && !item.name.endsWith(" Intact")) continue;
      const name = relic ? `${relic[1]} ${relic[2]} Relic` : item.name.trim();
      if (!images.has(name)) images.set(name, item.imageName);
    }
  }
  return images;
}

/**
 * The names of `items` in one language, from that language's i18n file.
 * Only names that differ from the English one are kept.
 */
export function translateNames(
  items: Iterable<string>,
  ids: ReadonlyMap<string, string>,
  i18n: unknown,
): Map<string, string> {
  if (!i18n || typeof i18n !== "object") throw new Error("Not a warframe-items i18n file");
  const table = i18n as Record<string, { name?: unknown } | undefined>;
  const names = new Map<string, string>();
  for (const item of items) {
    const id = ids.get(item);
    const raw = id ? table[id]?.name : undefined;
    if (typeof raw !== "string") continue;
    const name = tidy(raw);
    if (name && name !== item) names.set(item, name);
  }
  return names;
}

const CONNECTORS = new Set(["de", "da", "do", "das", "dos", "e", "of", "the", "and", "la", "le", "les", "des", "du", "di", "del", "von", "und", "y"]);

/** A few entries are in capitals ("MATRIZ DE BALÍSTICA OROKIN"); write those like the rest. */
function tidy(raw: string): string {
  const name = raw.replace(/\s+/g, " ").trim();
  const letters = name.replace(/[^\p{L}]/gu, "");
  if (letters.length > 3 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()) {
    return name
      .toLowerCase()
      .split(" ")
      .map((word, i) => (i > 0 && CONNECTORS.has(word) ? word : word.replace(/\p{L}/u, (c) => c.toUpperCase())))
      .join(" ");
  }
  return name;
}
