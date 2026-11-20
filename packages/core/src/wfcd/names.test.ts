// Codex — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { kindFromName, parseRelicName, splitQuantity } from "./names.ts";

describe("splitQuantity", () => {
  it("takes the stack size off bundled rewards", () => {
    expect(splitQuantity("100X Oxium")).toEqual({ name: "Oxium", quantity: 100 });
    expect(splitQuantity("1,500x Polymer Bundle")).toEqual({ name: "Polymer Bundle", quantity: 1500 });
  });

  it("leaves credit and endo amounts whole", () => {
    expect(splitQuantity("2,000 Credits Cache")).toEqual({ name: "2,000 Credits Cache" });
    expect(splitQuantity("400 Endo")).toEqual({ name: "400 Endo" });
  });

  it("collapses stray whitespace", () => {
    expect(splitQuantity("  Serration ")).toEqual({ name: "Serration" });
  });
});

describe("parseRelicName", () => {
  it("reads tier and code", () => {
    expect(parseRelicName("Axi G13 Relic")).toEqual({ item: "Axi G13 Relic", tier: "Axi", code: "G13", refinement: undefined });
  });

  it("reads a pre-refined relic from a bounty", () => {
    expect(parseRelicName("Lith L8 Relic (Radiant)")).toMatchObject({ item: "Lith L8 Relic", refinement: "Radiant" });
  });

  it("ignores things that only mention relics", () => {
    expect(parseRelicName("Relic Pack (3 x Random Void Relics)")).toBeUndefined();
    expect(parseRelicName("Eidolon Relic")).toBeUndefined();
  });
});

describe("kindFromName", () => {
  it.each([
    ["Axi G13 Relic", "relic"],
    ["Vanguard C1 Relic", "relic"],
    ["Khora Prime Chassis Blueprint", "prime_part"],
    ["Akstiletto Prime Barrel", "prime_part"],
    ["Forma Blueprint", "blueprint"],
    ["Ayatan Anasa Sculpture", "ayatan"],
    ["2,000 Credits Cache", "credits"],
    ["400 Endo", "endo"],
    ["Arcane Energize", "arcane"],
    ["Serration", "other"],
  ])("%s -> %s", (name, kind) => {
    expect(kindFromName(name)).toBe(kind);
  });
});
