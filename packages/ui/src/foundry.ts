// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import type { EquipmentCard, EquipmentCategory } from "@iaframe/core";
import { tokenize } from "@iaframe/core";

/** The Foundry's tabs. */
export const FOUNDRY_TABS = {
  all: undefined,
  warframe: ["warframe"],
  primary: ["primary"],
  secondary: ["secondary"],
  melee: ["melee"],
  arch: ["arch_gun", "arch_melee"],
  companion: ["companion", "companion_weapon"],
} as const satisfies Record<string, readonly EquipmentCategory[] | undefined>;
export type FoundryTab = keyof typeof FOUNDRY_TABS;

export const PRIME_FILTERS = ["all", "prime", "regular"] as const;
export type PrimeFilter = (typeof PRIME_FILTERS)[number];

export const AVAILABILITY = ["all", "farmable", "vaulted", "none"] as const;
export type Availability = (typeof AVAILABILITY)[number];

/**
 * How a card can be had, all parts together:
 * - "farmable": every part drops or comes from a farmable relic; or it's
 *   not a Prime, since regular gear can always be had in game, by drops,
 *   the Market, Dojo research, quests or syndicates;
 * - "vaulted": at least one part only comes from vaulted relics;
 * - "none": a Prime none of whose parts are in the drop tables (War Prime,
 *   Excalibur Prime);
 * - "mixed": a Prime with some parts dropping and others not.
 */
export function cardAvailability(card: EquipmentCard): Exclude<Availability, "all"> | "mixed" {
  const statuses = card.parts.map((part) => part.status);
  if (statuses.includes("vaulted")) return "vaulted";
  if (!card.prime) return "farmable";
  if (statuses.every((status) => status === "none")) return "none";
  if (statuses.every((status) => status === "drops" || status === "relics")) return "farmable";
  return "mixed";
}

export interface FoundryFilter {
  tab: FoundryTab;
  prime: PrimeFilter;
  availability: Availability;
  /** Words that must all start a word of the name, in English or as shown. */
  text: string;
}

export function filterCards(
  cards: readonly EquipmentCard[],
  filter: FoundryFilter,
  shownName: (name: string) => string = (name) => name,
): EquipmentCard[] {
  const categories: readonly EquipmentCategory[] | undefined = FOUNDRY_TABS[filter.tab];
  const words = tokenize(filter.text);
  return cards.filter((card) => {
    if (categories && !categories.includes(card.category)) return false;
    if (filter.prime === "prime" && !card.prime) return false;
    if (filter.prime === "regular" && card.prime) return false;
    if (filter.availability !== "all" && cardAvailability(card) !== filter.availability) return false;
    if (words.length > 0) {
      const tokens = tokenize(`${card.name} ${shownName(card.name)}`);
      if (!words.every((word) => tokens.some((token) => token.startsWith(word)))) return false;
    }
    return true;
  });
}
