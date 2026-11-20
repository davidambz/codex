// Codex — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

/** Lowercase words without accents or punctuation: "Neuróptica  P." -> ["neuroptica", "p"]. */
export function tokenize(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/(\d),(\d)/g, "$1$2")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}
