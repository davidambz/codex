// Codex — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { buildSearchIndex, type SearchEntry } from "./index.ts";
import { editDistance } from "./fuzzy.ts";
import { tokenize } from "./normalize.ts";
import { kindFromName } from "../wfcd/names.ts";

const names = [
  "Khora Chassis Blueprint",
  "Khora Neuroptics Blueprint",
  "Khora Prime Blueprint",
  "Khora Prime Chassis Blueprint",
  "Khora Prime Neuroptics Blueprint",
  "Khora Prime Systems Blueprint",
  "Khora Systems Blueprint",
  "Saryn Prime Systems Blueprint",
  "Serration",
  "Split Chamber",
  "Primed Continuity",
  "Axi G13 Relic",
  "Lith G1 Relic",
  "400 Endo",
  "Akstiletto Prime Barrel",
  "Hystrix Prime Barrel",
];
const index = buildSearchIndex(names.map((name): SearchEntry => ({ name, kind: kindFromName(name) })));
const top = (query: string) => index.search(query, 3).map((h) => h.name);

describe("tokenize", () => {
  it("drops accents, case and punctuation", () => {
    expect(tokenize("Neuróptica  do Khora-P.")).toEqual(["neuroptica", "do", "khora", "p"]);
  });

  it("keeps thousands together", () => {
    expect(tokenize("2,000 Credits")).toEqual(["2000", "credits"]);
  });
});

describe("editDistance", () => {
  it("counts swaps as one edit", () => {
    expect(editDistance("seratoin", "serration", 2)).toBe(2);
    expect(editDistance("chasis", "chassis", 1)).toBe(1);
    expect(editDistance("abc", "xyz", 1)).toBe(2);
  });
});

describe("search", () => {
  it("finds an item by any of its names, returning the English one", () => {
    const multi = buildSearchIndex([
      { name: "Oxium", kind: "other", aliases: ["Óxio", "Oxio"] },
      { name: "Arcane Momentum", kind: "arcane", aliases: ["Impulso Arcano"] },
    ]);
    expect(multi.search("oxio", 1)).toEqual([{ name: "Oxium", kind: "other", score: expect.any(Number) }]);
    expect(multi.search("impulso arc", 1)[0]?.name).toBe("Arcane Momentum");
    expect(multi.search("momentum", 1)[0]?.name).toBe("Arcane Momentum");
  });

  it("keeps only the kinds asked for", () => {
    expect(index.search("khora", 10, ["relic"])).toEqual([]);
    expect(index.search("g1", 10, ["relic"]).map((h) => h.name)).toEqual(["Lith G1 Relic", "Axi G13 Relic"]);
    expect(index.search("g1", 10, ["mod"])).toEqual([]);
    expect(index.search("khora prime", 2, ["prime_part"]).every((h) => h.kind === "prime_part")).toBe(true);
    expect(index.search("khora", 20, [])).toHaveLength(7);
  });

  it("finds shorthand with Portuguese part names", () => {
    expect(top("khora p chassi")[0]).toBe("Khora Prime Chassis Blueprint");
    expect(top("khora prime neuroptica")[0]).toBe("Khora Prime Neuroptics Blueprint");
    expect(top("saryn p sistemas")[0]).toBe("Saryn Prime Systems Blueprint");
    expect(top("hystrix p cano")[0]).toBe("Hystrix Prime Barrel");
  });

  it("requires every word to match", () => {
    expect(top("khora p chassi")).not.toContain("Khora Chassis Blueprint");
  });

  it("forgives typos", () => {
    expect(top("seration")[0]).toBe("Serration");
    expect(top("khroa prime chasis")[0]).toBe("Khora Prime Chassis Blueprint");
  });

  it("completes prefixes as you type", () => {
    expect(top("khora prime neur")[0]).toBe("Khora Prime Neuroptics Blueprint");
    expect(top("serr")[0]).toBe("Serration");
  });

  it("ranks the closest name first", () => {
    expect(top("khora prime")[0]).toBe("Khora Prime Blueprint");
    expect(top("axi g13")[0]).toBe("Axi G13 Relic");
  });

  it("doesn't match short words loosely", () => {
    expect(top("g12")).toEqual([]);
  });

  it("returns nothing for an empty query", () => {
    expect(index.search("  ")).toEqual([]);
  });
});
