// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// A tiny stand-in for WFCD's item catalog and the wiki API, for tests.

import { WARFRAMES_URL, WIKI_API_URL } from "../catalog.ts";
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
    ],
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

/** Answers the catalog URLs, or undefined for anything else. */
export function fakeCatalog(url: string): unknown {
  if (url === WARFRAMES_URL) return WARFRAMES;
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
