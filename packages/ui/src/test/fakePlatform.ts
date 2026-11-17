// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import type { DataStatus, DeepDrops, ItemDetails, ItemLanguage, Platform, Settings, SourceDetails } from "@iaframe/core";

/** Names the fake knows in Portuguese, as the real data would have them. */
export const names: Partial<Record<ItemLanguage, Record<string, string>>> = {
  pt: { "Axi A21 Relic": "Relíquia Axi A21", "Arcane Momentum": "Impulso Arcano" },
};

const hydron = { key: "mission:Sedna/Hydron", kind: "mission", name: "Hydron", location: "Sedna", gameMode: "Defense" } as const;

const cetus = { key: "bounty:Plains of Eidolon/Level 5 - 15 Cetus Bounty", kind: "bounty", name: "Level 5 - 15 Cetus Bounty", location: "Plains of Eidolon" } as const;
const ghoul = { key: "bounty:Plains of Eidolon/Ghoul Purge", kind: "bounty", name: "Ghoul Purge", location: "Plains of Eidolon", isEvent: true } as const;

export const items: Record<string, ItemDetails> = {
  "Gara Chassis Blueprint": { name: "Gara Chassis Blueprint", kind: "blueprint" },
  "Alternox Prime Stock": { name: "Alternox Prime Stock", kind: "prime_part", vaulted: false },
  "Axi A21 Relic": { name: "Axi A21 Relic", kind: "relic", relic: { tier: "Axi", code: "A21", vaulted: false } },
  Serration: { name: "Serration", kind: "mod" },
  "Mystery Thing": { name: "Mystery Thing", kind: "other" },
  "Arcane Momentum": { name: "Arcane Momentum", kind: "arcane" },
  Nezha: {
    name: "Nezha",
    kind: "warframe",
    equipment: {
      category: "warframe",
      prime: false,
      counterpart: "Nezha Prime",
      wikiUrl: "https://wiki.warframe.com/w/Nezha",
      acquisition: ["Nezha's blueprints can be researched from the Tenno Lab in the dojo."],
      parts: [
        { name: "Nezha Blueprint", label: "Blueprint", status: "none" },
        { name: "Nezha Chassis Blueprint", label: "Chassis", status: "none" },
        { name: "Nezha Neuroptics Blueprint", label: "Neuroptics", status: "none" },
        { name: "Nezha Systems Blueprint", label: "Systems", status: "none" },
      ],
    },
  },
  "Nezha Prime": {
    name: "Nezha Prime",
    kind: "warframe",
    equipment: {
      category: "warframe",
      prime: true,
      counterpart: "Nezha",
      parts: [
        { name: "Nezha Prime Blueprint", label: "Blueprint", status: "vaulted", relics: 8, openRelics: 0 },
        { name: "Nezha Prime Chassis Blueprint", label: "Chassis", status: "relics", relics: 5, openRelics: 2 },
        { name: "Nezha Prime Neuroptics Blueprint", label: "Neuroptics", status: "drops", bestChance: 12.5 },
        { name: "Nezha Prime Systems Blueprint", label: "Systems", status: "vaulted", relics: 9, openRelics: 0 },
      ],
    },
  },
  "War Prime": {
    name: "War Prime",
    kind: "melee",
    equipment: {
      category: "melee",
      prime: true,
      counterpart: "War",
      parts: [],
      acquisition: ["War Prime is acquired upon crafting Hunhow's Trinket."],
    },
  },
  "Lex Prime": {
    name: "Lex Prime",
    kind: "secondary",
    equipment: {
      category: "secondary",
      prime: true,
      parts: [{ name: "Lex Prime Barrel", label: "Barrel", status: "relics", relics: 3, openRelics: 1 }],
    },
  },
  "Nezha Prime Chassis Blueprint": { name: "Nezha Prime Chassis Blueprint", kind: "prime_part", vaulted: false },
};

export const deep: Record<string, DeepDrops> = {
  "Alternox Prime Stock": {
    direct: [],
    relics: [
      {
        relic: "Axi A21 Relic",
        info: { tier: "Axi", code: "A21", vaulted: false },
        rarity: "Rare",
        chances: { Intact: 2, Exceptional: 4, Flawless: 6, Radiant: 10 },
        sources: [{ source: hydron, rotation: "C", chance: 12.5, slots: 1, conditional: false }],
      },
      {
        relic: "Meso A9 Relic",
        info: { tier: "Meso", code: "A9", vaulted: true },
        chances: { Intact: 2, Exceptional: 4, Flawless: 6, Radiant: 10 },
        sources: [],
      },
    ],
  },
  "Axi A21 Relic": { direct: [{ source: hydron, rotation: "C", chance: 12.5, slots: 1, conditional: false }], relics: [] },
  Serration: {
    direct: [
      { source: hydron, rotation: "B", chance: 8.6, slots: 1, conditional: false },
      {
        source: { key: "enemy:Void Shade", kind: "enemy", name: "Void Shade" },
        chance: 0.3318,
        enemyChance: 3,
        tableChance: 11.06,
        slots: 1,
        conditional: false,
      },
    ],
    relics: [],
  },
  "Mystery Thing": { direct: [], relics: [] },
  "Arcane Momentum": { direct: [{ source: hydron, rotation: "C", chance: 2, slots: 1, conditional: false }], relics: [] },
  "Gara Chassis Blueprint": {
    direct: [
      { source: ghoul, chance: 20, slots: 1, conditional: false },
      { source: cetus, chance: 10, slots: 1, conditional: false },
      { source: hydron, rotation: "C", chance: 7, slots: 1, conditional: false },
      { source: hydron, rotation: "B", chance: 5, slots: 1, conditional: false },
    ],
    relics: [],
  },
};

export const sources: Record<string, SourceDetails> = {
  "relic:Axi A21": {
    source: { key: "relic:Axi A21", kind: "relic", name: "Axi A21 Relic" },
    drops: [{ item: "Alternox Prime Stock", kind: "prime_part", refinement: "Intact", rarity: "Rare", chance: 2, conditional: false }],
  },
  [hydron.key]: {
    source: hydron,
    drops: [
      { item: "Serration", kind: "mod", rotation: "B", rarity: "Rare", chance: 8.6, conditional: false },
      { item: "400 Endo", kind: "endo", rotation: "A", rarity: "Common", chance: 20, conditional: false },
      ...["Oxium", "Polymer Bundle", "Rubedo", "Plastids", "Ferrite", "Salvage", "Circuits", "Alloy Plate", "Nano Spores", "Morphics"].map(
        (item) => ({ item, kind: "other" as const, rotation: "A" as const, rarity: "Common", chance: 8, conditional: false }),
      ),
    ],
  },
};

export function fakePlatform(
  overrides: Partial<Platform> & { status?: DataStatus; settings?: Settings } = {},
): Platform {
  const listeners = new Set<(status: DataStatus) => void>();
  let settings: Settings = overrides.settings ?? { itemLanguage: "en", searchLanguages: [] };
  let status: DataStatus = overrides.status ?? {
    busy: false,
    outcome: "up-to-date",
    info: { hash: "h1", items: 4, drops: 5, sourceModified: "2026-11-17T12:00:00.000Z" },
  };
  return {
    kind: "web",
    appVersion: "0.0.0",
    search: async (query, _limit, kinds) =>
      Object.values(items)
        .filter((item) => {
          const word = query.trim().toLowerCase().split(" ")[0];
          if (!word) return false;
          const languages = [settings.itemLanguage, ...settings.searchLanguages];
          const aliases = languages.map((language) => names[language]?.[item.name]).filter(Boolean) as string[];
          return [item.name, ...aliases].some((name) => name.toLowerCase().includes(word));
        })
        .filter((item) => !kinds?.length || kinds.includes(item.kind))
        .map((item) => ({ name: item.name, kind: item.kind, score: 1 })),
    getItem: async (name) => items[name],
    getDropsDeep: async (name) => deep[name] ?? { direct: [], relics: [] },
    getSource: async (key) => sources[key],
    getDataStatus: async () => status,
    updateData: async () => status,
    onDataStatus(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSystemTheme: async () => "dark",
    onSystemThemeChange: () => () => {},
    getSystemLocale: async () => "en-US",
    getSettings: async () => settings,
    updateSettings: async (patch) => (settings = { ...settings, ...patch }),
    getItemNames: async (language) => names[language] ?? {},
    ...overrides,
    // Lets a test push a new status as the main process would.
    ...({ emit: (next: DataStatus) => ((status = next), listeners.forEach((l) => l(next))) } as object),
  };
}
