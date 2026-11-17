// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// A tiny stand-in for WFCD's Warframes.json and the wiki API, for tests.

import { WARFRAMES_URL, WIKI_API_URL } from "../catalog.ts";

export const WARFRAMES = [
  { name: "Khora", isPrime: false, productCategory: "Suits", wikiaUrl: "https://wiki.warframe.com/w/Khora" },
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

/** Answers the catalog URLs, or undefined for anything else. */
export function fakeCatalog(url: string): unknown {
  if (url === WARFRAMES_URL) return WARFRAMES;
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
