// Codex — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// A tiny stand-in for WFCD's item catalog and the wiki API, for tests.

import { readFileSync } from "node:fs";
import { CATALOG_COMMITS_URL, WARFRAMES_URL, WIKI_API_URL } from "../catalog.ts";
import { EXPORT_INDEX_URL, exportFileUrl } from "../export.ts";
import { catalogFileUrl, i18nUrl } from "../names.ts";

export const WARFRAMES = [
  {
    name: "Khora",
    uniqueName: "/Lotus/Powersuits/Khora/Khora",
    isPrime: false,
    productCategory: "Suits",
    wikiaUrl: "https://wiki.warframe.com/w/Khora",
  },
  {
    name: "Khora Prime",
    isPrime: true,
    productCategory: "Suits",
    wikiaUrl: "https://wiki.warframe.com/w/Khora%2FPrime",
    components: [
      { uniqueName: "/Lotus/Types/Recipes/WarframeRecipes/KhoraPrimeBlueprint" },
      { uniqueName: "/Lotus/Types/Recipes/WarframeRecipes/KhoraPrimeChassisComponent" },
      { uniqueName: "/Lotus/Types/Recipes/WarframeRecipes/KhoraPrimeHelmetComponent" },
      { uniqueName: "/Lotus/Types/Recipes/WarframeRecipes/KhoraPrimeSystemsComponent" },
      { uniqueName: "/Resources/Oxium", itemCount: 2 },
    ],
    buildPrice: 25000,
  },
  { name: "Nezha", isPrime: false, productCategory: "Suits", wikiaUrl: "https://wiki.warframe.com/w/Nezha" },
  {
    name: "Excalibur Umbra",
    isPrime: false,
    productCategory: "Suits",
    wikiaUrl: "https://wiki.warframe.com/w/Excalibur%2FUmbra",
    components: [
      { uniqueName: "/Lotus/Types/Recipes/WarframeRecipes/ExcaliburUmbraBlueprint" },
      { uniqueName: "/Lotus/Types/Items/MiscItems/OrokinCell" },
    ],
  },
  { name: "Bonewidow", isPrime: false, productCategory: "MechSuits" },
];

export const WIKI_PAGES: Record<string, string> = {
  // No "/Main" subpage: the text is on the page itself.
  "Excalibur/Umbra":
    "==Acquisition==\nThe blueprint for Excalibur Umbra is given to players upon completing [[The Sacrifice]] quest.\n",
  "War/Prime": "==Acquisition==\nWar Prime is acquired by crafting [[Hunhow's Trinket]].\n\n==Notes==\n",
  "Helios/Main": "==Acquisition==\nHelios is [[research]]ed in the [[Tenno Lab]].\n",
  "Khora/Main":
    "Intro.\n\n{{Acquisition|name=Khora|Khora's main [[blueprint]] can be purchased from the [[Market]].}}\n\n==Crafting==\n",
  "Nezha/Main":
    "==Acquisition==\nNezha's blueprints can be [[research]]ed from the [[Research/Tenno Lab|Tenno Lab]] in the [[dojo]].\n\n" +
    "Prior to {{ver|19}}, they came from [[Sortie]]s.\n\n==Crafting==\n",
};

/** A slice of the category files and the Portuguese i18n file. */
export const CATALOG: Record<string, unknown[]> = {
  Mods: [{ name: "Serration", uniqueName: "/Mods/Serration", imageName: "Serration.png" }],
  Relics: [
    { name: "Axi G13 Intact", uniqueName: "/Relics/AxiG13Bronze", imageName: "RelicAxiD.png" },
    { name: "Axi G13 Radiant", uniqueName: "/Relics/AxiG13Platinum", imageName: "RelicAxiC.png" },
  ],
  Resources: [{ name: "Oxium", uniqueName: "/Resources/Oxium" }],
  Misc: [{ name: "Orokin Cell", uniqueName: "/Lotus/Types/Items/MiscItems/OrokinCell", imageName: "ComponentCell.png" }],
  Primary: [
    { name: "Lex Prime", isPrime: true, productCategory: "Pistols", wikiaUrl: "https://wiki.warframe.com/w/Lex%2FPrime" },
    { name: "Amp Prism", productCategory: "OperatorAmps" },
  ],
  Melee: [
    { name: "War", isPrime: false, productCategory: "Melee", wikiaUrl: "https://wiki.warframe.com/w/War" },
    { name: "War Prime", isPrime: true, productCategory: "Melee", wikiaUrl: "https://wiki.warframe.com/w/War%2FPrime" },
    { name: "Plague Kripath", type: "Zaw Component" },
  ],
  Sentinels: [{ name: "Helios", type: "Sentinel", productCategory: "Sentinels", wikiaUrl: "https://wiki.warframe.com/w/Helios" }],
};

export const I18N: Record<string, Record<string, { name: string }>> = {
  pt: {
    // Made up, so a search can tell the alias from the English name.
    "/Mods/Serration": { name: "Serrilhado" },
    "/Relics/AxiG13Bronze": { name: "Relíquia Axi G13" },
    "/Resources/Oxium": { name: "Óxio" },
    "/Lotus/Powersuits/Khora/Khora": { name: "Khora" },
  },
};

/** The real Public Export index of 2026-11-17, packed as served. */
export const EXPORT_INDEX = new Uint8Array(readFileSync(new URL("./fixtures/export-index.lzma", import.meta.url)));
export const RECIPES_ENTRY = "ExportRecipes_en.json!00_oac+LCAtIyqDxZF8Qe1ZZA";

/** A slice of ExportRecipes: the blueprint that builds Khora Prime's chassis. */
export const EXPORT_RECIPES = {
  ExportRecipes: [
    {
      uniqueName: "/Lotus/Types/Recipes/WarframeRecipes/KhoraPrimeChassisBlueprint",
      resultType: "/Lotus/Types/Recipes/WarframeRecipes/KhoraPrimeChassisComponent",
      buildPrice: 15000,
      ingredients: [
        { ItemType: "/Resources/Oxium", ItemCount: 300 },
        { ItemType: "/Lotus/Types/Items/MiscItems/OrokinCell", ItemCount: 2 },
      ],
    },
  ],
};

export const RESOURCES_ENTRY = "ExportResources_en.json!00_AIngbzxhVpxhDwXhkSq6bA";

/**
 * A slice of ExportResources: Orokin Cell (in a recipe) and Morphics (in
 * the drop tables) say where they're found, Forma doesn't, and Voidplume Crest
 * is nowhere in the data.
 */
export const EXPORT_RESOURCES = {
  ExportResources: [
    {
      uniqueName: "/Lotus/Types/Items/MiscItems/OrokinCell",
      name: "Orokin Cell",
      description: "Ancient energy cell from the Orokin era.\r\n\r\nLocation: Ceres, Saturn, and Deimos",
    },
    { uniqueName: "/Lotus/Types/Items/MiscItems/Forma", name: "Forma", description: "Reshapes polarity." },
    { uniqueName: "/Lotus/Types/Items/MiscItems/Morphics", name: "Morphics", description: "Location: Mars" },
    { uniqueName: "/Lotus/Types/Items/MiscItems/Voidplume", name: "Voidplume Crest", description: "Location: Zariman" },
  ],
};

/** The catalog's commit, which tests change to fake a new catalog. */
export const catalogVersion = { sha: "c1" };

/** Answers the catalog URLs, or undefined for anything else. */
export function fakeCatalog(url: string): unknown {
  if (url === WARFRAMES_URL) return WARFRAMES;
  if (url === CATALOG_COMMITS_URL) return [{ sha: catalogVersion.sha }];
  if (url === EXPORT_INDEX_URL) return EXPORT_INDEX;
  if (url === exportFileUrl(RECIPES_ENTRY)) return EXPORT_RECIPES;
  if (url === exportFileUrl(RESOURCES_ENTRY)) return EXPORT_RESOURCES;
  for (const [file, items] of Object.entries(CATALOG)) if (url === catalogFileUrl(file)) return items;
  for (const [language, table] of Object.entries(I18N)) if (url === i18nUrl(language as "pt")) return table;
  if (url.startsWith(catalogFileUrl("").replace(/\.json$/, ""))) return [];
  if (url.startsWith(`${WIKI_API_URL}?`)) {
    const titles = new URL(url).searchParams.get("titles")?.split("|") ?? [];
    return {
      batchcomplete: true,
      query: {
        pages: titles.map((title) =>
          title in WIKI_PAGES
            ? { title, revisions: [{ slots: { main: { content: WIKI_PAGES[title] } } }] }
            : { title, missing: true },
        ),
      },
    };
  }
  return undefined;
}
