// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// In-memory item search. The catalogue is a few thousand names, small
// enough to score every one per keystroke, which buys typo tolerance and
// Portuguese words that a full-text index wouldn't give.
//
// Every query word has to match some word of the name: exactly, as a
// prefix ("neur" -> "neuroptics"), through a synonym ("chassi" ->
// "chassis", "p" -> "prime") or within a typo or two ("seration").

import type { ItemKind } from "../types.ts";
import { allowedTypos, editDistance } from "./fuzzy.ts";
import { tokenize } from "./normalize.ts";
import { SYNONYMS } from "./synonyms.ts";

export interface SearchEntry {
  name: string;
  kind: ItemKind;
}

export interface SearchHit extends SearchEntry {
  score: number;
}

export interface SearchIndex {
  search(query: string, limit?: number): SearchHit[];
}

interface Indexed {
  entry: SearchEntry;
  tokens: string[];
}

const EXACT = 1;
const SYNONYM = 0.95;
const PREFIX = 0.75;
const TYPO = 0.6;

export function buildSearchIndex(entries: readonly SearchEntry[]): SearchIndex {
  const indexed: Indexed[] = entries.map((entry) => ({ entry, tokens: tokenize(entry.name) }));
  return {
    search(query, limit = 10) {
      const words = tokenize(query);
      if (words.length === 0) return [];
      const hits: SearchHit[] = [];
      for (const item of indexed) {
        const score = scoreItem(words, item.tokens);
        if (score > 0) hits.push({ ...item.entry, score });
      }
      hits.sort((a, b) => b.score - a.score || a.name.length - b.name.length || a.name.localeCompare(b.name));
      return hits.slice(0, limit);
    },
  };
}

function scoreItem(words: string[], tokens: string[]): number {
  let total = 0;
  const used = new Set<number>();
  let inOrder = true;
  let last = -1;
  for (const word of words) {
    let best = 0;
    let bestAt = -1;
    for (let i = 0; i < tokens.length; i++) {
      if (used.has(i)) continue;
      const s = scoreWord(word, tokens[i]);
      if (s > best) {
        best = s;
        bestAt = i;
      }
    }
    if (best === 0) return 0;
    used.add(bestAt);
    if (bestAt < last) inOrder = false;
    last = bestAt;
    total += best;
  }
  // Prefer names the query covers best: "khora prime" should rank
  // "Khora Prime Blueprint" above "Khora Prime Neuroptics Blueprint".
  const coverage = used.size / tokens.length;
  return total / words.length + 0.3 * coverage + (inOrder ? 0.1 : 0);
}

function scoreWord(word: string, token: string): number {
  if (word === token) return EXACT;
  for (const synonym of SYNONYMS[word] ?? []) {
    if (synonym === token) return SYNONYM;
  }
  if (token.startsWith(word)) return PREFIX * (0.5 + (0.5 * word.length) / token.length);
  const typos = allowedTypos(word.length);
  if (typos > 0) {
    const distance = editDistance(word, token, typos);
    if (distance <= typos) return TYPO - 0.1 * (distance - 1);
    // A misspelt start of a longer word: "neurop" for "neuroptics".
    if (token.length > word.length && editDistance(word, token.slice(0, word.length), typos) <= typos) {
      return TYPO * 0.8;
    }
  }
  return 0;
}

export { tokenize } from "./normalize.ts";
