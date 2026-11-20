// Codex — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// Warframes, weapons and companions, and how to get the ones that don't
// come from relics, from sources other than the drop tables: WFCD's item
// catalog and the Warframe Wiki.

import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_FILES,
  MATERIAL_FILES,
  applyPartRecipes,
  assignWeaponParts,
  extractAcquisition,
  joinCatalog,
  namesById,
  parseEquipment,
  wikiPage,
  type CatalogEntry,
} from "@codex/core";
import { fetchRecipes } from "./export.ts";
import type { FetchJson } from "./ingest.ts";
import { catalogFileUrl } from "./names.ts";

export const WARFRAMES_URL = catalogFileUrl("Warframes");
/** The last warframe-items commit that touched its data: a version for the whole catalog. */
export const CATALOG_COMMITS_URL = "https://api.github.com/repos/WFCD/warframe-items/commits?path=data/json&per_page=1";
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

/** The current catalog version (a commit hash). */
export async function fetchCatalogVersion(fetchJson: FetchJson): Promise<string> {
  const commits = await fetchJson(CATALOG_COMMITS_URL);
  const sha = Array.isArray(commits) ? (commits[0] as { sha?: unknown } | undefined)?.sha : undefined;
  if (typeof sha !== "string" || !sha) throw new Error("warframe-items: no commit");
  return sha;
}

/**
 * Every Warframe, weapon and companion, with its parts among `items` (the
 * drop tables' item names), what each part's blueprint costs (from the
 * Public Export file `recipesEntry`) and, where it doesn't simply come
 * from relics, the wiki's text on how to get it.
 */
export async function fetchCatalog(
  fetchJson: FetchJson,
  items: readonly string[],
  recipesEntry: string,
): Promise<CatalogEntry[]> {
  const files = EQUIPMENT_CATEGORIES.flatMap((category) => EQUIPMENT_FILES[category].map((file) => [category, file] as const));
  const [equipment, materials] = await Promise.all([
    Promise.all(files.map(([, file]) => fetchJson(catalogFileUrl(file)))),
    Promise.all(MATERIAL_FILES.map((file) => fetchJson(catalogFileUrl(file)))),
  ]);
  // Recipes name what they consume by internal name: resources, and some whole weapons.
  const names = namesById([...materials, ...equipment]);
  const entries = joinCatalog(files.map(([category], i) => parseEquipment(category, equipment[i], names)));
  applyPartRecipes(entries, await fetchRecipes(fetchJson, recipesEntry), names);
  assignWeaponParts(entries, items);
  const drops = new Set(items);
  await addAcquisition(
    fetchJson,
    entries.filter((entry) => needsAcquisition(entry, drops)),
  );
  return entries;
}

/**
 * Regular things, and Primes none of whose parts are in the drop tables
 * (War Prime, from Hunhow; Excalibur Prime, a Founders reward).
 */
export function needsAcquisition(entry: CatalogEntry, drops: ReadonlySet<string>): boolean {
  return !entry.prime || !(entry.parts ?? []).some((part) => drops.has(part));
}

async function addAcquisition(fetchJson: FetchJson, entries: CatalogEntry[]): Promise<void> {
  // Each entry's article page, then the page itself: a few Warframes
  // (Excalibur Prime, Excalibur Umbra) keep their text there, not in "/Main".
  const pagesOf = (entry: CatalogEntry) => {
    const page = wikiPage(entry);
    const bare = page.replace(/\/Main$/, "");
    return bare === page ? [page] : [page, bare];
  };
  const perRequest = Math.floor(PAGES_PER_REQUEST / 2);
  for (let i = 0; i < entries.length; i += perRequest) {
    const batch = entries.slice(i, i + perRequest);
    const content = pageContents((await fetchJson(wikiPagesUrl(batch.flatMap(pagesOf)))) as WikiQuery);
    for (const entry of batch) {
      for (const title of pagesOf(entry)) {
        const text = content.get(title);
        const paragraphs = text ? extractAcquisition(text) : [];
        if (paragraphs.length > 0) {
          entry.acquisition = paragraphs;
          break;
        }
      }
    }
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
