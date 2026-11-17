// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// Runs core's queries against a real SQLite database built from the
// fixture, so the SQL is checked by the engine the app uses.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildSearchIndex,
  getDataInfo,
  getDrops,
  getDropsDeep,
  getItem,
  getSource,
  getSourceDrops,
  listItems,
  parseDropData,
} from "@iaframe/core";
import { buildDatabase } from "./build.ts";
import { openStore, type Store } from "./sqlite.ts";
import sample from "../../core/src/wfcd/fixtures/sample.json" with { type: "json" };

let dir: string;
let store: Store;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "iaframe-queries-"));
  const path = join(dir, "iaframe.db");
  buildDatabase(path, parseDropData(sample), { drops_hash: "abc", ingested_at: "2026-11-17T12:00:00.000Z" }, [
    { name: "Gara", prime: false, acquisition: ["Gara's main blueprint is awarded by Saya's Vigil."] },
    { name: "Khora", prime: false, counterpart: "Khora Prime", wikiUrl: "https://wiki.warframe.com/w/Khora" },
    { name: "Khora Prime", prime: true, counterpart: "Khora" },
  ]);
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
    const gara = getItem(store, "Gara")?.warframe;
    expect(gara).toMatchObject({ prime: false, acquisition: ["Gara's main blueprint is awarded by Saya's Vigil."] });
    expect(gara?.parts.map((p) => [p.slot, p.status])).toEqual([
      ["blueprint", "none"],
      ["chassis", "drops"],
      ["neuroptics", "none"],
      ["systems", "none"],
    ]);
    expect(gara?.parts[1].bestChance).toBeGreaterThan(0);

    const khoraPrime = getItem(store, "Khora Prime")?.warframe;
    expect(khoraPrime).toMatchObject({ prime: true, counterpart: "Khora" });
    expect(khoraPrime?.parts[1]).toEqual({
      name: "Khora Prime Chassis Blueprint",
      slot: "chassis",
      status: "vaulted",
      relics: 1,
      openRelics: 0,
    });
    expect(getItem(store, "Serration")?.warframe).toBeUndefined();
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
