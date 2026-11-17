// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// The Warframe list and how to get each regular frame, from sources other
// than the drop tables: WFCD's item catalog and the Warframe Wiki.

import { extractAcquisition, parseWarframeList, wikiMainPage, type WarframeEntry } from "@iaframe/core";
import type { FetchJson } from "./ingest.ts";

export const WARFRAMES_URL = "https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json/Warframes.json";
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

/** Every Warframe, with the wiki's acquisition text for the regular ones. */
export async function fetchWarframes(fetchJson: FetchJson): Promise<WarframeEntry[]> {
  const frames = parseWarframeList(await fetchJson(WARFRAMES_URL));
  const regular = frames.filter((f) => !f.prime);

  for (let i = 0; i < regular.length; i += PAGES_PER_REQUEST) {
    const batch = regular.slice(i, i + PAGES_PER_REQUEST);
    const titles = batch.map(wikiMainPage);
    const result = (await fetchJson(wikiPagesUrl(titles))) as WikiQuery;
    const content = pageContents(result);
    batch.forEach((frame, j) => {
      const text = content.get(titles[j]);
      const paragraphs = text ? extractAcquisition(text) : [];
      if (paragraphs.length > 0) frame.acquisition = paragraphs;
    });
  }
  return frames;
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
