// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// How many attempts a chance takes. Computed here, never by a model.

/** Average attempts to get a drop with this chance (in percent): 1/p. */
export function expectedRuns(chance: number): number {
  if (!(chance > 0)) return Number.POSITIVE_INFINITY;
  return 100 / Math.min(chance, 100);
}

/** Attempts needed to have got it at least once with the given confidence (0.9 = 90% of players). */
export function runsForConfidence(chance: number, confidence = 0.9): number {
  if (!(chance > 0)) return Number.POSITIVE_INFINITY;
  if (chance >= 100) return 1;
  return Math.max(1, Math.ceil(Math.log(1 - confidence) / Math.log(1 - chance / 100)));
}
