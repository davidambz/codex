// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// A tiny stand-in for WFCD's Warframes.json and the wiki API, for tests.

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
  { name: "Khora Prime", isPrime: true, productCategory: "Suits", wikiaUrl: "https://wiki.warframe.com/w/Khora%2FPrime" },
  { name: "Nezha", isPrime: false, productCategory: "Suits", wikiaUrl: "https://wiki.warframe.com/w/Nezha" },
  { name: "Bonewidow", isPrime: false, productCategory: "MechSuits" },
];

export const WIKI_PAGES: Record<string, string> = {
  "Khora/Main":
    "Intro.\n\n{{Acquisition|name=Khora|Khora's main [[blueprint]] can be purchased from the [[Market]].}}\n\n==Crafting==\n",
  "Nezha/Main":
    "==Acquisition==\nNezha's blueprints can be [[research]]ed from the [[Research/Tenno Lab|Tenno Lab]] in the [[dojo]].\n\n" +
    "Prior to {{ver|19}}, they came from [[Sortie]]s.\n\n==Crafting==\n",
};

/** A slice of the category files and the Portuguese i18n file. */
export const CATALOG: Record<string, unknown[]> = {
  Mods: [{ name: "Serration", uniqueName: "/Mods/Serration" }],
  Relics: [
    { name: "Axi G13 Intact", uniqueName: "/Relics/AxiG13Bronze" },
    { name: "Axi G13 Radiant", uniqueName: "/Relics/AxiG13Platinum" },
  ],
  Resources: [{ name: "Oxium", uniqueName: "/Resources/Oxium" }],
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
