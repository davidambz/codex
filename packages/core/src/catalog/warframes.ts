// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// Which Warframes exist, from WFCD's item catalog
// (https://github.com/WFCD/warframe-items, data/json/Warframes.json).
// The drop tables only know a frame through the parts that drop, so a
// frame researched in the Dojo or bought from a vendor never shows up
// there; this list is what lets the app know about it anyway.

export interface WarframeEntry {
  /** "Nezha", "Nezha Prime". */
  name: string;
  prime: boolean;
  /** The other version of the same frame, when there is one. */
  counterpart?: string;
  /** Its page on the Warframe Wiki. */
  wikiUrl?: string;
  /** How to get it, as plain paragraphs from the wiki (regular frames only). */
  acquisition?: string[];
}

interface RawWarframe {
  name?: unknown;
  isPrime?: unknown;
  productCategory?: unknown;
  wikiaUrl?: unknown;
}

const WIKI = "https://wiki.warframe.com/w/";

/** The playable Warframes in Warframes.json (Necramechs and special suits like Excalibur Umbra left out). */
export function parseWarframeList(raw: unknown): WarframeEntry[] {
  if (!Array.isArray(raw)) throw new Error("Not a WFCD Warframes.json: expected an array");
  const frames = new Map<string, WarframeEntry>();
  for (const item of raw as RawWarframe[]) {
    if (item?.productCategory !== "Suits" || typeof item.name !== "string") continue;
    const name = item.name.trim();
    if (!name || frames.has(name)) continue;
    const entry: WarframeEntry = { name, prime: item.isPrime === true || / Prime$/.test(name) };
    if (typeof item.wikiaUrl === "string" && item.wikiaUrl.startsWith(WIKI)) entry.wikiUrl = item.wikiaUrl;
    frames.set(name, entry);
  }
  for (const frame of frames.values()) {
    const other = frame.prime ? frame.name.replace(/ Prime$/, "") : `${frame.name} Prime`;
    if (other !== frame.name && frames.has(other)) frame.counterpart = other;
  }
  return [...frames.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** The wiki page that holds a frame's article text: "Nezha" -> "Nezha/Main". */
export function wikiMainPage(frame: WarframeEntry): string {
  const page = frame.wikiUrl ? decodeURIComponent(frame.wikiUrl.slice(WIKI.length)).replace(/_/g, " ") : frame.name;
  return `${page}/Main`;
}

/** The four blueprints a frame is built from, as the drop tables name them. */
export function warframeParts(name: string): string[] {
  return [`${name} Blueprint`, `${name} Chassis Blueprint`, `${name} Neuroptics Blueprint`, `${name} Systems Blueprint`];
}
