// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import type { ItemKind, Refinement, RelicTier } from "../types.ts";

const QUANTITY = /^(\d[\d,]*)\s*x\s+(.+)$/i;

/**
 * Splits a bundled reward into the item and its stack size:
 * "100X Oxium" -> { name: "Oxium", quantity: 100 }. Credit and Endo
 * rewards ("2,000 Credits Cache", "400 Endo") have no "X" and stay whole.
 */
export function splitQuantity(raw: string): { name: string; quantity?: number } {
  const name = raw.trim().replace(/\s+/g, " ");
  const match = QUANTITY.exec(name);
  if (!match) return { name };
  return { name: match[2], quantity: Number(match[1].replace(/,/g, "")) };
}

const RELIC =
  /^(Lith|Meso|Neo|Axi|Requiem|Vanguard) (\S+) Relic(?: \((Intact|Exceptional|Flawless|Radiant)\))?$/;

export interface RelicName {
  /** "Axi G13 Relic", without the refinement. */
  item: string;
  tier: RelicTier;
  code: string;
  refinement?: Refinement;
}

/** Reads "Lith L8 Relic (Radiant)" as Lith L8, already refined to Radiant. */
export function parseRelicName(name: string): RelicName | undefined {
  const match = RELIC.exec(name);
  if (!match) return undefined;
  const tier = match[1] as RelicTier;
  const code = match[2];
  return {
    item: relicItemName(tier, code),
    tier,
    code,
    refinement: match[3] as Refinement | undefined,
  };
}

export function relicItemName(tier: string, code: string): string {
  return `${tier} ${code} Relic`;
}

/**
 * Best guess from the name alone. Tables carry no category, so a plain
 * mod reward in a mission ("Serration") comes out "other" here and is
 * upgraded by the parser once it shows up in a mod table.
 */
export function kindFromName(name: string): ItemKind {
  if (RELIC.test(name)) return "relic";
  if (/ Prime /.test(name)) return "prime_part";
  if (/^Ayatan .+ Sculpture$/.test(name)) return "ayatan";
  if (/Credits( Cache)?$/.test(name)) return "credits";
  if (/^[\d,]+ Endo$/.test(name)) return "endo";
  if (/^Arcane /.test(name)) return "arcane";
  if (/ Blueprint$/.test(name)) return "blueprint";
  return "other";
}
