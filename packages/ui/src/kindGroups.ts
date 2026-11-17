// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import type { ItemKind } from "@iaframe/core";

/** The search's type filter: a few groups instead of every item kind. */
export const KIND_GROUPS = {
  all: undefined,
  warframe: ["warframe"],
  weapon: ["primary", "secondary", "melee", "arch_gun", "arch_melee", "companion_weapon", "part"],
  companion: ["companion"],
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

/** Under "Weapons": one kind of weapon, or all of them (loose parts included). */
export const WEAPON_GROUPS = {
  all: KIND_GROUPS.weapon,
  primary: ["primary"],
  secondary: ["secondary"],
  melee: ["melee"],
  arch: ["arch_gun", "arch_melee"],
  companion_weapon: ["companion_weapon"],
} as const satisfies Record<string, readonly ItemKind[]>;

export type WeaponGroup = keyof typeof WEAPON_GROUPS;

export function isWeaponGroup(value: unknown): value is WeaponGroup {
  return typeof value === "string" && value in WEAPON_GROUPS;
}

/** The kinds a search should keep for this choice. */
export function searchKinds(group: KindGroup, weapon: WeaponGroup): readonly ItemKind[] | undefined {
  return group === "weapon" ? WEAPON_GROUPS[weapon] : KIND_GROUPS[group];
}
