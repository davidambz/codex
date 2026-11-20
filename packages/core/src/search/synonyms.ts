// Codex — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// Words people type for words in item names. Item names stay in English,
// as the game shows them in most clients; these let a Portuguese or
// shorthand query land on them. Keys and values are already tokenized
// (lowercase, no accents).

export const SYNONYMS: Record<string, string[]> = {
  // shorthand
  p: ["prime"],
  bp: ["blueprint"],
  // relics
  reliquia: ["relic"],
  reliquias: ["relic"],
  // warframe parts
  chassi: ["chassis"],
  sistema: ["systems"],
  sistemas: ["systems"],
  neuroptica: ["neuroptics"],
  neuropticas: ["neuroptics"],
  neuroptico: ["neuroptics"],
  neuropticos: ["neuroptics"],
  planta: ["blueprint"],
  projeto: ["blueprint"],
  diagrama: ["blueprint"],
  // weapon parts
  cano: ["barrel"],
  receptor: ["receiver"],
  coronha: ["stock"],
  lamina: ["blade", "blades"],
  laminas: ["blade", "blades"],
  cabo: ["handle"],
  empunhadura: ["grip", "handle"],
  punho: ["hilt"],
  guarda: ["guard"],
  corda: ["string"],
  elo: ["link"],
  corrente: ["chain"],
  cabeca: ["head"],
  disco: ["disc"],
  estrelas: ["stars"],
  manopla: ["gauntlet"],
  bolsa: ["pouch"],
  ornamento: ["ornament"],
  superior: ["upper"],
  inferior: ["lower"],
  membro: ["limb"],
  // sentinel parts
  carapaca: ["carapace"],
  cerebro: ["cerebrum"],
};
