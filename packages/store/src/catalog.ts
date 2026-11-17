// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// Warframes, weapons and companions, and how to get the ones that don't
// come from relics, from sources other than the drop tables: WFCD's item
// catalog and the Warframe Wiki.

import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_FILES,
  assignWeaponParts,
  extractAcquisition,
  joinCatalog,
  parseEquipment,
  wikiPage,
  type CatalogEntry,
} from "@iaframe/core";
import type { FetchJson } from "./ingest.ts";
import { catalogFileUrl } from "./names.ts";

export const WARFRAMES_URL = catalogFileUrl("Warframes");
export const WIKI_API_URL = "https://wiki.warframe.com/api.php";

/** MediaWiki serves at most 50 pages' content per request. */
const PAGES_PER_REQUEST = 50;

interface WikiQuery {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: { title: string; missing?: boolean; revisions?: { slots?: { main?: { content?: string } } }[] }[];
  };
}

export function wikiPagesUrl(titles: string[]): string {
  const params = new URLSearchParams({
    action: "query",
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    format: "json",
    formatversion: "2",
    redirects: "1",
    titles: titles.join("|"),
  });
  return `${WIKI_API_URL}?${params}`;
}

/**
 * Every Warframe, weapon and companion, with its parts among `items` (the
 * drop tables' item names) and, where it doesn't simply come from relics,
 * the wiki's text on how to get it.
 */
export async function fetchCatalog(fetchJson: FetchJson, items: readonly string[]): Promise<CatalogEntry[]> {
  const lists = await Promise.all(
    EQUIPMENT_CATEGORIES.flatMap((category) =>
      EQUIPMENT_FILES[category].map(async (file) => parseEquipment(category, await fetchJson(catalogFileUrl(file)))),
    ),
  );
  const entries = joinCatalog(lists);
  assignWeaponParts(entries, items);
  await addAcquisition(fetchJson, entries.filter(needsAcquisition));
  return entries;
}

/** Regular things, and Primes whose parts aren't in the drop tables (War Prime, from Hunhow). */
export function needsAcquisition(entry: CatalogEntry): boolean {
  return !entry.prime || (entry.category !== "warframe" && !entry.parts?.length);
}

async function addAcquisition(fetchJson: FetchJson, entries: CatalogEntry[]): Promise<void> {
  for (let i = 0; i < entries.length; i += PAGES_PER_REQUEST) {
    const batch = entries.slice(i, i + PAGES_PER_REQUEST);
    const titles = batch.map(wikiPage);
    const content = pageContents((await fetchJson(wikiPagesUrl(titles))) as WikiQuery);
    batch.forEach((entry, j) => {
      const text = content.get(titles[j]);
      const paragraphs = text ? extractAcquisition(text) : [];
      if (paragraphs.length > 0) entry.acquisition = paragraphs;
    });
  }
}

/** Page text by the title it was asked for, following the API's title normalisation and redirects. */
function pageContents(result: WikiQuery): Map<string, string> {
  const query = result.query ?? {};
  const byTitle = new Map<string, string>();
  for (const page of query.pages ?? []) {
    const text = page.revisions?.[0]?.slots?.main?.content;
    if (!page.missing && text) byTitle.set(page.title, text);
  }
  const renames = [...(query.redirects ?? []), ...(query.normalized ?? [])];
  // Resolve each rename chain (normalised -> redirected) back to the asked title.
  for (let pass = 0; pass < 2; pass++) {
    for (const { from, to } of renames) {
      const text = byTitle.get(to);
      if (text !== undefined && !byTitle.has(from)) byTitle.set(from, text);
    }
  }
  return byTitle;
}
