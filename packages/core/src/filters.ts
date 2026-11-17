// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// Filtering, sorting and summing up the rows the queries return. Pure, so
// the screens stay thin and the rules are tested once.

import type { DeepDrops, DropRow, RelicRoute } from "./queries.ts";
import type { Refinement, RelicTier, Rotation, SourceKind } from "./types.ts";
import { RELIC_TIERS } from "./types.ts";
import { tokenize } from "./search/normalize.ts";

export interface DropFilter {
  kind?: SourceKind;
  /** Planet / open world, as in Source.location. */
  location?: string;
  rotation?: Rotation;
  hideEvents?: boolean;
  /** Hide "by avatar" rows, whose chance isn't per kill. */
  hideConditional?: boolean;
  /** Words that must all appear in the source's name, location or mode. */
  text?: string;
}

export type DropSortKey = "chance" | "source" | "when";
export type SortDirection = "asc" | "desc";

export function filterDrops(rows: readonly DropRow[], filter: DropFilter): DropRow[] {
  const words = filter.text ? tokenize(filter.text) : [];
  return rows.filter((row) => {
    if (filter.kind && row.source.kind !== filter.kind) return false;
    if (filter.location && row.source.location !== filter.location) return false;
    if (filter.rotation && row.rotation !== filter.rotation) return false;
    if (filter.hideEvents && row.source.isEvent) return false;
    if (filter.hideConditional && row.conditional) return false;
    if (words.length > 0) {
      const haystack = tokenize(
        [row.source.name, row.source.location, row.source.gameMode, row.stage].filter(Boolean).join(" "),
      );
      if (!words.every((word) => haystack.some((token) => token.startsWith(word)))) return false;
    }
    return true;
  });
}

/** The values worth offering as filters for these rows. */
export function dropFacets(rows: readonly DropRow[]): {
  kinds: SourceKind[];
  locations: string[];
  rotations: Rotation[];
  hasEvents: boolean;
  hasConditional: boolean;
} {
  const kinds = new Set<SourceKind>();
  const locations = new Set<string>();
  const rotations = new Set<Rotation>();
  let hasEvents = false;
  let hasConditional = false;
  for (const row of rows) {
    kinds.add(row.source.kind);
    if (row.source.location) locations.add(row.source.location);
    if (row.rotation) rotations.add(row.rotation);
    hasEvents ||= Boolean(row.source.isEvent);
    hasConditional ||= row.conditional;
  }
  return {
    kinds: [...kinds],
    locations: [...locations].sort((a, b) => a.localeCompare(b)),
    rotations: [...rotations].sort(),
    hasEvents,
    hasConditional,
  };
}

/** A sorted copy. Ties fall back to best chance, then source name. */
export function sortDrops(rows: readonly DropRow[], key: DropSortKey, direction: SortDirection): DropRow[] {
  const sign = direction === "asc" ? 1 : -1;
  const byChance = (a: DropRow, b: DropRow) => b.chance - a.chance || a.source.name.localeCompare(b.source.name);
  const primary = (a: DropRow, b: DropRow): number => {
    switch (key) {
      case "chance":
        return a.chance - b.chance;
      case "source":
        return a.source.name.localeCompare(b.source.name) || (a.source.location ?? "").localeCompare(b.source.location ?? "");
      case "when":
        return whenRank(a).localeCompare(whenRank(b));
    }
  };
  return [...rows].sort((a, b) => sign * primary(a, b) || byChance(a, b));
}

function whenRank(row: DropRow): string {
  return [row.rotation ?? "", row.stage ?? "", row.refinement ?? ""].join("\u0000");
}

export type RelicSortKey = "intact" | "radiant" | "name";

export interface RelicFilter {
  tiers?: readonly RelicTier[];
  hideVaulted?: boolean;
}

export function filterRelics(routes: readonly RelicRoute[], filter: RelicFilter): RelicRoute[] {
  return routes.filter(
    (route) =>
      !(filter.hideVaulted && route.info.vaulted) &&
      (!filter.tiers?.length || filter.tiers.includes(route.info.tier)),
  );
}

/** Farmable relics first, then by the chosen key. */
export function sortRelics(routes: readonly RelicRoute[], key: RelicSortKey): RelicRoute[] {
  const chance = (route: RelicRoute, refinement: Refinement) => route.chances[refinement] ?? 0;
  return [...routes].sort((a, b) => {
    const vaulted = Number(a.info.vaulted) - Number(b.info.vaulted);
    if (vaulted !== 0) return vaulted;
    if (key === "name") return relicOrder(a) - relicOrder(b) || a.relic.localeCompare(b.relic, undefined, { numeric: true });
    const refinement: Refinement = key === "intact" ? "Intact" : "Radiant";
    return chance(b, refinement) - chance(a, refinement) || a.relic.localeCompare(b.relic, undefined, { numeric: true });
  });
}

function relicOrder(route: RelicRoute): number {
  return RELIC_TIERS.indexOf(route.info.tier);
}

export function relicTiers(routes: readonly RelicRoute[]): RelicTier[] {
  const tiers = new Set(routes.map((route) => route.info.tier));
  return RELIC_TIERS.filter((tier) => tiers.has(tier));
}

export interface BestBet {
  /** The best direct drop that can be had any time: no events, chance per attempt. */
  direct?: DropRow;
  /** The farmable relic with the best Radiant chance, and where it drops best. */
  relic?: { route: RelicRoute; source?: DropRow };
}

/** The quickest ways to get the item, to show before the full tables. */
export function bestBet(deep: DeepDrops): BestBet {
  const bet: BestBet = {};
  const direct = deep.direct
    .filter((row) => !row.conditional && !row.source.isEvent)
    .reduce<DropRow | undefined>((best, row) => (!best || row.chance > best.chance ? row : best), undefined);
  if (direct) bet.direct = direct;

  const relic = sortRelics(
    deep.relics.filter((route) => !route.info.vaulted),
    "radiant",
  )[0];
  if (relic) {
    const source = relic.sources
      .filter((row) => !row.conditional && !row.source.isEvent)
      .reduce<DropRow | undefined>((best, row) => (!best || row.chance > best.chance ? row : best), undefined);
    bet.relic = source ? { route: relic, source } : { route: relic };
  }
  return bet;
}
