// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import type { ItemKind } from "@iaframe/core";

/** The search's type filter: a few groups instead of every item kind. */
export const KIND_GROUPS = {
  all: undefined,
  warframe: ["warframe"],
  prime: ["prime_part"],
  mod: ["mod"],
  arcane: ["arcane"],
  relic: ["relic"],
  other: ["blueprint", "ayatan", "credits", "endo", "other"],
} as const satisfies Record<string, readonly ItemKind[] | undefined>;

export type KindGroup = keyof typeof KIND_GROUPS;

export function isKindGroup(value: unknown): value is KindGroup {
  return typeof value === "string" && value in KIND_GROUPS;
}
