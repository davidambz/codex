// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// Runs core's queries against a real SQLite database built from the
// fixture, so the SQL is checked by the engine the app uses.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assignWeaponParts,
  buildSearchIndex,
  getDataInfo,
  getDrops,
  getDropsDeep,
  getItem,
  getSource,
  getSourceDrops,
  listEquipment,
  listItems,
  listRelics,
  parseDropData,
  RELIC_TIERS,
} from "@iaframe/core";
import type { CatalogEntry } from "@iaframe/core";
import { buildDatabase } from "./build.ts";
import { openStore, type Store } from "./sqlite.ts";
import sample from "../../core/src/wfcd/fixtures/sample.json" with { type: "json" };

let dir: string;
let store: Store;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "iaframe-queries-"));
  const path = join(dir, "iaframe.db");
  const data = parseDropData(sample);
  const catalog: CatalogEntry[] = [
    { name: "Gara", category: "warframe", prime: false, acquisition: ["Gara's main blueprint is awarded by Saya's Vigil."] },
    { name: "Khora", category: "warframe", prime: false, counterpart: "Khora Prime", wikiUrl: "https://wiki.warframe.com/w/Khora" },
    {
      name: "Khora Prime",
      category: "warframe",
      prime: true,
      counterpart: "Khora",
      recipe: ["Blueprint", "Chassis", "Neuroptics", "Systems"],
      materials: [
        { name: "Neurodes", count: 2 },
        { name: "Orokin Cell", count: 1 },
        { name: "Detonite Ampule", count: 1 },
      ],
      credits: 25000,
      partRecipes: { Chassis: { materials: [{ name: "Neurodes", count: 4 }], credits: 15000 } },
    },
    { name: "Lex Prime", category: "secondary", prime: true, pieceCounts: { Barrel: 2 } },
    { name: "War Prime", category: "melee", prime: true, acquisition: ["Crafted from Hunhow's Trinket."] },
  ];
  assignWeaponParts(catalog, data.items.map((item) => item.name));
  const locations = new Map([
    ["Orokin Cell", "Ceres, Saturn, and Deimos"],
    ["Not In The Data", "Nowhere"],
  ]);
  buildDatabase(path, data, { drops_hash: "abc", ingested_at: "2026-11-17T12:00:00.000Z" }, catalog, undefined, undefined, locations);
  store = openStore(path);
});
afterAll(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("queries", () => {
  it("lists every item for the search index", () => {
    const index = buildSearchIndex(listItems(store));
    expect(index.search("khora p chassi", 1)[0]).toMatchObject({ name: "Khora Prime Chassis Blueprint", kind: "prime_part" });
  });

  it("finds Warframes by name, even ones with no drops", () => {
    const index = buildSearchIndex(listItems(store));
    expect(index.search("khora", 2).map((h) => [h.name, h.kind])).toEqual([
      ["Khora", "warframe"],
      ["Khora Prime", "warframe"],
    ]);
  });

  it("sums up where each of a Warframe's blueprints comes from", () => {
    const gara = getItem(store, "Gara")?.equipment;
    expect(gara).toMatchObject({ prime: false, acquisition: ["Gara's main blueprint is awarded by Saya's Vigil."] });
    expect(gara?.parts.map((p) => [p.label, p.status])).toEqual([
      ["Blueprint", "none"],
      ["Chassis", "drops"],
      ["Neuroptics", "none"],
      ["Systems", "none"],
    ]);
    expect(gara?.parts[1].bestChance).toBeGreaterThan(0);

    const khoraPrime = getItem(store, "Khora Prime")?.equipment;
    expect(khoraPrime).toMatchObject({ prime: true, counterpart: "Khora" });
    expect(khoraPrime?.parts[1]).toEqual({
      name: "Khora Prime Chassis Blueprint",
      label: "Chassis",
      craftable: true,
      status: "vaulted",
      relics: 1,
      openRelics: 0,
    });
    expect(getItem(store, "Serration")?.equipment).toBeUndefined();
  });

  it("lists a weapon's parts found in the drop tables", () => {
    expect(getItem(store, "Lex Prime")).toMatchObject({
      kind: "secondary",
      equipment: { category: "secondary", prime: true, parts: [{ name: "Lex Prime Barrel", label: "Barrel", count: 2 }] },
    });
    expect(getItem(store, "War Prime")?.equipment).toEqual({
      category: "melee",
      prime: true,
      parts: [],
      materials: [],
      acquisition: ["Crafted from Hunhow's Trinket."],
    });
    const index = buildSearchIndex(listItems(store));
    expect(index.search("war prime", 1, ["melee"])[0]).toMatchObject({ name: "War Prime", kind: "melee" });
  });

  it("lists the resources and credits a recipe consumes", () => {
    // Orokin Cell and Detonite Ampule aren't in these drop tables: the database learns about them from the
    // recipe. Orokin Cell still gets a page, for where the game says it's found.
    expect(getItem(store, "Khora Prime")?.equipment).toMatchObject({
      materials: [
        { name: "Neurodes", count: 2, linked: true },
        { name: "Orokin Cell", count: 1, linked: true },
        { name: "Detonite Ampule", count: 1, linked: false },
      ],
      credits: 25000,
    });
  });

  it("tells where the game says a resource is found", () => {
    expect(getItem(store, "Orokin Cell")).toMatchObject({ name: "Orokin Cell", kind: "resource", location: "Ceres, Saturn, and Deimos" });
    // In a recipe, so a resource too, even with no location.
    expect(getItem(store, "Detonite Ampule")?.kind).toBe("resource");
    expect(getItem(store, "Serration")?.kind).toBe("mod");
    expect(getItem(store, "Neurodes")?.location).toBeUndefined();
    expect(getItem(store, "Not In The Data")).toBeUndefined();
  });

  it("tells what a part's own blueprint takes", () => {
    expect(getItem(store, "Khora Prime Chassis Blueprint")?.crafting).toEqual({
      materials: [{ name: "Neurodes", count: 4, linked: true }],
      credits: 15000,
    });
    const parts = getItem(store, "Khora Prime")?.equipment?.parts ?? [];
    expect(parts.find((p) => p.label === "Chassis")?.craftable).toBe(true);
    expect(parts.find((p) => p.label === "Systems")?.craftable).toBeUndefined();
    expect(getItem(store, "Khora Prime Systems Blueprint")?.crafting).toBeUndefined();
  });

  it("lists every piece of equipment with its parts' status for the grid", () => {
    const cards = listEquipment(store);
    expect(cards.map((c) => c.name)).toEqual(["Gara", "Khora", "Khora Prime", "Lex Prime", "War Prime"]);
    expect(cards.find((c) => c.name === "Gara")?.parts.map((p) => p.status)).toEqual(["none", "drops", "none", "none"]);
    expect(cards.find((c) => c.name === "Khora Prime")?.parts[1]).toEqual({
      name: "Khora Prime Chassis Blueprint",
      label: "Chassis",
      status: "vaulted",
    });
    expect(cards.find((c) => c.name === "War Prime")?.howTo).toBe("Crafted from Hunhow's Trinket.");
    expect(cards.find((c) => c.name === "Lex Prime")).toMatchObject({ category: "secondary", prime: true, parts: [{ label: "Barrel", count: 2 }] });
    // Same answers as the item page.
    for (const card of cards) {
      expect(card.parts.map((p) => p.status)).toEqual(getItem(store, card.name)?.equipment?.parts.map((p) => p.status));
    }
  });

  it("lists relics by tier with what they hold", () => {
    const relics = listRelics(store);
    expect(relics.length).toBeGreaterThan(0);
    const tiers = relics.map((r) => r.tier);
    expect([...tiers].sort((a, b) => RELIC_TIERS.indexOf(a) - RELIC_TIERS.indexOf(b))).toEqual(tiers);
    const s21 = relics.find((r) => r.name === "Axi S21 Relic");
    expect(s21).toMatchObject({ tier: "Axi", code: "S21", vaulted: false });
    expect(s21?.rewards.length).toBeGreaterThanOrEqual(6);
    expect(s21?.rewards.map((r) => r.rarity)).toEqual(["common", "common", "common", "uncommon", "uncommon", "rare"]);
  });

  it("describes a relic item", () => {
    expect(getItem(store, "Axi S21 Relic")).toEqual({
      name: "Axi S21 Relic",
      kind: "relic",
      relic: { tier: "Axi", code: "S21", vaulted: false },
    });
    expect(getItem(store, "Nope")).toBeUndefined();
  });

  it("calls a part vaulted when only vaulted relics hold it", () => {
    expect(getItem(store, "Khora Prime Chassis Blueprint")).toMatchObject({ kind: "prime_part", vaulted: true });
    expect(getItem(store, "Serration")?.vaulted).toBeUndefined();
  });

  it("lists drops best chance first", () => {
    const drops = getDrops(store, "Serration");
    const chances = drops.map((d) => d.chance);
    expect(chances).toEqual([...chances].sort((a, b) => b - a));
    expect(drops.find((d) => d.source.key === "enemy:Void Shade")).toMatchObject({
      chance: 0.3318,
      enemyChance: 3,
      tableChance: 11.06,
      conditional: false,
    });
    expect(drops.find((d) => d.source.key === "mission:Mercury/Apollodorus")).toMatchObject({
      source: { kind: "mission", name: "Apollodorus", location: "Mercury", gameMode: "Survival" },
      rotation: "B",
    });
  });

  it("follows a prime part through its relics to the missions", () => {
    const deep = getDropsDeep(store, "Khora Prime Chassis Blueprint");
    expect(deep.direct).toEqual([]);
    expect(deep.relics).toHaveLength(1);
    expect(deep.relics[0]).toMatchObject({
      relic: "Axi G13 Relic",
      info: { vaulted: true },
      chances: { Intact: 11, Exceptional: 13, Flawless: 17, Radiant: 20 },
      sources: [],
    });
  });

  it("puts obtainable relics first and shows where they drop", () => {
    const relic = getDrops(store, "Axi S21 Relic");
    expect(relic[0]).toMatchObject({ source: { key: "mission:Sedna/Hydron" }, rotation: "C", chance: 9.68 });

    const forma = getDropsDeep(store, "Forma Blueprint");
    const vaulted = forma.relics.map((r) => r.info.vaulted);
    expect(vaulted).toEqual([...vaulted].sort((a, b) => Number(a) - Number(b)));
    const open = forma.relics.find((r) => !r.info.vaulted);
    expect(open?.sources.length).toBeGreaterThan(0);
  });

  it("marks relic sources with their vaulted state", () => {
    const row = getDrops(store, "Khora Prime Chassis Blueprint")[0];
    expect(row).toMatchObject({ source: { kind: "relic" }, sourceVaulted: true });
  });

  it("lists what a source drops", () => {
    expect(getSource(store, "relic:Axi G13")).toEqual({ key: "relic:Axi G13", kind: "relic", name: "Axi G13 Relic" });
    const rows = getSourceDrops(store, "relic:Axi G13");
    expect(rows).toHaveLength(24);
    expect(rows.slice(0, 6).every((r) => r.refinement === "Intact")).toBe(true);
    expect(rows.at(-1)?.refinement).toBe("Radiant");

    const hydron = getSourceDrops(store, "mission:Sedna/Hydron");
    expect(new Set(hydron.map((r) => r.rotation))).toEqual(new Set(["A", "B", "C"]));
  });

  it("reports where the data came from", () => {
    expect(getDataInfo(store)).toMatchObject({ hash: "abc", ingestedAt: "2026-11-17T12:00:00.000Z" });
    expect(getDataInfo(store).items).toBeGreaterThan(0);
  });
});
