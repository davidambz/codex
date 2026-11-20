// Codex — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// Sanity checks run on freshly parsed data before it replaces the
// database in use. A failure keeps the old data: better a day stale than
// a screen of wrong chances after WFCD changes its format.

import type { DropData } from "../types.ts";

export interface PreviousCounts {
  items: number;
  drops: number;
}

/** Items that have dropped somewhere for years; if one vanishes, the parse broke. */
export const ANCHORS = [
  { item: "Forma Blueprint", sourceKind: "relic" },
  { item: "Serration", sourceKind: "mission" },
  { item: "Serration", sourceKind: "enemy" },
] as const;

const MAX_SWING = 0.2;
const RELIC_REWARD_COUNTS = [6, 8];
const CHANCE_TOLERANCE = 0.5;

/** Returns what's wrong, in plain English; empty means the data can be used. */
export function validateDropData(data: DropData, previous?: PreviousCounts): string[] {
  const problems: string[] = [];
  if (data.items.length === 0 || data.drops.length === 0) {
    return ["No items or drops at all"];
  }

  if (previous) {
    for (const what of ["items", "drops"] as const) {
      const now = what === "items" ? data.items.length : data.drops.length;
      const before = previous[what];
      if (before > 0 && Math.abs(now - before) / before > MAX_SWING) {
        problems.push(`${what} went from ${before} to ${now}, more than ${MAX_SWING * 100}%`);
      }
    }
  }

  const relicTables = new Map<string, { count: number; total: number }>();
  for (const drop of data.drops) {
    if (!drop.source.startsWith("relic:")) continue;
    const key = `${drop.source} ${drop.refinement ?? "?"}`;
    const table = relicTables.get(key) ?? { count: 0, total: 0 };
    table.count += drop.slots ?? 1;
    table.total += drop.chance;
    relicTables.set(key, table);
  }
  for (const [key, { count, total }] of relicTables) {
    if (!RELIC_REWARD_COUNTS.includes(count)) problems.push(`${key} has ${count} rewards`);
    // Only the standard six-reward tables must add up to 100%: the
    // eight-reward Requiem ones don't (ETERNA Intact lists 8 x 9.5%).
    if (count === 6 && Math.abs(total - 100) > CHANCE_TOLERANCE) problems.push(`${key} chances add up to ${total.toFixed(2)}%`);
  }

  const kinds = new Map(data.sources.map((s) => [s.key, s.kind]));
  for (const anchor of ANCHORS) {
    const found = data.drops.some((d) => d.item === anchor.item && kinds.get(d.source) === anchor.sourceKind);
    if (!found) problems.push(`${anchor.item} no longer drops from any ${anchor.sourceKind}`);
  }

  if (!data.relics.some((r) => !r.vaulted)) problems.push("Every relic came out vaulted");

  return problems;
}
