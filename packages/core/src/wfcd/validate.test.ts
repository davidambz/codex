// Codex — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { parseDropData } from "./parse.ts";
import { validateDropData } from "./validate.ts";
import sample from "./fixtures/sample.json" with { type: "json" };
import type { DropData } from "../types.ts";

const fresh = (): DropData => parseDropData(sample);

describe("validateDropData", () => {
  it("accepts good data", () => {
    const data = fresh();
    expect(validateDropData(data)).toEqual([]);
    expect(validateDropData(data, { items: data.items.length, drops: data.drops.length })).toEqual([]);
  });

  it("rejects empty data", () => {
    expect(validateDropData({ items: [], sources: [], drops: [], relics: [], skipped: 0 })).toHaveLength(1);
  });

  it("rejects a big swing from the last ingest", () => {
    const data = fresh();
    const problems = validateDropData(data, { items: data.items.length, drops: data.drops.length * 2 });
    expect(problems).toEqual([expect.stringMatching(/^drops went from/)]);
  });

  it("rejects a relic missing a reward", () => {
    const data = fresh();
    const index = data.drops.findIndex((d) => d.source === "relic:Axi G13" && d.refinement === "Radiant");
    data.drops.splice(index, 1);
    expect(validateDropData(data)).toEqual(["relic:Axi G13 Radiant has 5 rewards"]);
  });

  it("rejects a six-reward relic whose chances don't add up to 100%", () => {
    const data = fresh();
    const drop = data.drops.find((d) => d.source === "relic:Axi G13" && d.refinement === "Intact");
    if (drop) drop.chance += 5;
    expect(validateDropData(data)).toEqual(["relic:Axi G13 Intact chances add up to 104.99%"]);
  });

  it("rejects data where an anchor item stopped dropping", () => {
    const data = fresh();
    data.drops = data.drops.filter((d) => !(d.item === "Serration" && d.source.startsWith("enemy:")));
    expect(validateDropData(data)).toEqual(["Serration no longer drops from any enemy"]);
  });

  it("rejects data where every relic is vaulted", () => {
    const data = fresh();
    for (const relic of data.relics) relic.vaulted = true;
    expect(validateDropData(data)).toEqual(["Every relic came out vaulted"]);
  });
});
