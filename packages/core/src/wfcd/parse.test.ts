// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { parseDropData } from "./parse.ts";
import sample from "./fixtures/sample.json" with { type: "json" };

// sample.json is cut from the real all.json (2026-11-17): a few missions,
// four relics in every refinement, and one entry from each other table.
const data = parseDropData(sample);
const dropsOf = (item: string) => data.drops.filter((d) => d.item === item);
const source = (key: string) => data.sources.find((s) => s.key === key);

describe("parseDropData", () => {
  it("rejects anything that isn't WFCD drop data", () => {
    expect(() => parseDropData({})).toThrow(/missionRewards/);
    expect(() => parseDropData(null)).toThrow();
  });

  it("reads missions with planet, game mode and rotation", () => {
    expect(source("mission:Sedna/Hydron")).toEqual({
      key: "mission:Sedna/Hydron",
      kind: "mission",
      name: "Hydron",
      location: "Sedna",
      gameMode: "Defense",
    });
    expect(dropsOf("Axi S21 Relic")).toContainEqual(
      expect.objectContaining({ source: "mission:Sedna/Hydron", rotation: "C", chance: 9.68 }),
    );
  });

  it("sums a reward listed in several slots of one rotation", () => {
    const endo = data.drops.find(
      (d) => d.item === "400 Endo" && d.source === "mission:Mercury/Terminus (Caches)" && d.rotation === "B",
    );
    expect(endo).toMatchObject({ chance: 62.08, slots: 6 });
  });

  it("reads every refinement of a relic as its own drop", () => {
    const khora = dropsOf("Khora Prime Chassis Blueprint").filter((d) => d.source === "relic:Axi G13");
    expect(khora.map((d) => [d.refinement, d.chance])).toEqual([
      ["Intact", 11],
      ["Exceptional", 13],
      ["Flawless", 17],
      ["Radiant", 20],
    ]);
    expect(source("relic:Axi G13")).toMatchObject({ kind: "relic", name: "Axi G13 Relic" });
  });

  it("keeps relics with eight rewards", () => {
    const eterna = data.drops.filter((d) => d.source === "relic:Requiem ETERNA" && d.refinement === "Intact");
    expect(eterna).toHaveLength(8);
  });

  it("marks relics no reward table gives as vaulted", () => {
    const relic = (item: string) => data.relics.find((r) => r.item === item);
    expect(relic("Axi S21 Relic")).toMatchObject({ tier: "Axi", code: "S21", vaulted: false });
    expect(relic("Axi G13 Relic")?.vaulted).toBe(true);
  });

  it("reads pre-refined bounty relics as the relic at that refinement", () => {
    expect(dropsOf("Lith L8 Relic")).toContainEqual(
      expect.objectContaining({
        source: "bounty:Orb Vallis/Level 40 - 60 PROFIT-TAKER - PHASE 1",
        refinement: "Radiant",
        stage: "Final Stage",
        rotation: "C",
      }),
    );
    expect(data.relics.find((r) => r.item === "Lith L8 Relic")?.vaulted).toBe(false);
    expect(data.items.find((i) => i.name === "Lith L8 Relic (Radiant)")).toBeUndefined();
  });

  it("multiplies the enemy's drop chance into enemy mod drops", () => {
    const shade = dropsOf("Serration").find((d) => d.source === "enemy:Void Shade");
    expect(shade).toMatchObject({ enemyChance: 3, tableChance: 11.06, chance: 0.3318 });
    expect(data.items.find((i) => i.name === "Serration")?.kind).toBe("mod");
  });

  it("reads blueprint drops from enemies", () => {
    expect(dropsOf("Lavan Glazio Mk Iii")).toContainEqual(
      expect.objectContaining({ source: "enemy:Vorac Crewship (Level 0 - 70)", chance: 2.5 }),
    );
  });

  it("splits bundles into item and quantity", () => {
    expect(data.items.some((i) => /^\d+X /i.test(i.name))).toBe(false);
    expect(data.drops.some((d) => d.quantity !== undefined)).toBe(true);
  });

  it("reads transient, sortie and key rewards", () => {
    expect(source("transient:Arbitrations")?.kind).toBe("transient");
    expect(dropsOf("Forma")).toContainEqual(expect.objectContaining({ source: "sortie:Sortie" }));
    expect(source("key:Recover The Orokin Archive")?.kind).toBe("key");
  });

  it("tidies bounty names", () => {
    expect(source("bounty:Zariman/Level 50 - 55 Zariman Bounty")).toBeDefined();
  });

  it("marks by-avatar drops as conditional", () => {
    expect(dropsOf("Techrot Motherboard")).toEqual([
      expect.objectContaining({ source: "enemy:Techrot Motherboard Cluster", chance: 100, conditional: true }),
    ]);
  });

  it("skips rows without a usable chance instead of guessing one", () => {
    const broken: typeof sample = JSON.parse(JSON.stringify(sample));
    broken.modLocations[0].enemies[0].chance = null as unknown as number;
    broken.sortieRewards[0].chance = null as unknown as number;
    const parsed = parseDropData(broken);
    expect(parsed.skipped).toBe(2);
    expect(parsed.drops.length).toBe(data.drops.length - 2);
    expect(data.skipped).toBe(0);
  });

  it("only points drops at known items and sources", () => {
    const items = new Set(data.items.map((i) => i.name));
    const sources = new Set(data.sources.map((s) => s.key));
    for (const drop of data.drops) {
      expect(items).toContain(drop.item);
      expect(sources).toContain(drop.source);
    }
  });
});
