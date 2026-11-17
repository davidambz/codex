// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import {
  bestBet,
  dropFacets,
  filterDrops,
  filterRelics,
  relicTiers,
  sortDrops,
  sortRelics,
} from "./filters.ts";
import type { DropRow, RelicRoute } from "./queries.ts";
import type { Source } from "./types.ts";

const source = (name: string, extra: Partial<Source> = {}): Source => ({
  key: `mission:${name}`,
  kind: "mission",
  name,
  ...extra,
});
const row = (src: Source, chance: number, extra: Partial<DropRow> = {}): DropRow => ({
  source: src,
  chance,
  slots: 1,
  conditional: false,
  ...extra,
});

const hydron = source("Hydron", { location: "Sedna", gameMode: "Defense" });
const lua = source("Apollo", { location: "Lua", gameMode: "Disruption" });
const event = source("Ghoul Purge", { kind: "bounty", location: "Plains of Eidolon", isEvent: true });
const shade = source("Void Shade", { kind: "enemy", key: "enemy:Void Shade" });

const rows = [
  row(hydron, 8.6, { rotation: "B" }),
  row(hydron, 5, { rotation: "C" }),
  row(lua, 12.5, { rotation: "C" }),
  row(event, 30),
  row(shade, 40, { conditional: true }),
];

describe("filterDrops", () => {
  it("narrows by kind, planet, rotation and text", () => {
    expect(filterDrops(rows, { kind: "enemy" }).map((r) => r.source.name)).toEqual(["Void Shade"]);
    expect(filterDrops(rows, { location: "Sedna" })).toHaveLength(2);
    expect(filterDrops(rows, { rotation: "C" }).map((r) => r.chance)).toEqual([5, 12.5]);
    expect(filterDrops(rows, { text: "defen sed" }).map((r) => r.source.name)).toEqual(["Hydron", "Hydron"]);
    expect(filterDrops(rows, { text: "nope" })).toEqual([]);
  });

  it("hides events and chances that aren't per attempt", () => {
    expect(filterDrops(rows, { hideEvents: true, hideConditional: true })).toHaveLength(3);
  });
});

describe("dropFacets", () => {
  it("offers only the values the rows have", () => {
    expect(dropFacets(rows)).toEqual({
      kinds: ["mission", "bounty", "enemy"],
      locations: ["Lua", "Plains of Eidolon", "Sedna"],
      rotations: ["B", "C"],
      hasEvents: true,
      hasConditional: true,
    });
  });
});

describe("sortDrops", () => {
  it("sorts by chance either way", () => {
    expect(sortDrops(rows, "chance", "desc").map((r) => r.chance)).toEqual([40, 30, 12.5, 8.6, 5]);
    expect(sortDrops(rows, "chance", "asc").map((r) => r.chance)).toEqual([5, 8.6, 12.5, 30, 40]);
  });

  it("sorts by source name, best chance first within one source", () => {
    expect(sortDrops(rows, "source", "asc").map((r) => `${r.source.name} ${r.chance}`)).toEqual([
      "Apollo 12.5",
      "Ghoul Purge 30",
      "Hydron 8.6",
      "Hydron 5",
      "Void Shade 40",
    ]);
  });

  it("sorts by rotation", () => {
    expect(sortDrops(rows, "when", "desc").map((r) => r.rotation ?? "-")).toEqual(["C", "C", "B", "-", "-"]);
  });

  it("leaves the input alone", () => {
    const copy = [...rows];
    sortDrops(rows, "source", "asc");
    expect(rows).toEqual(copy);
  });
});

const route = (relic: string, tier: RelicRoute["info"]["tier"], vaulted: boolean, intact: number, radiant: number, sources: DropRow[] = []): RelicRoute => ({
  relic,
  info: { tier, code: relic.split(" ")[1], vaulted },
  chances: { Intact: intact, Radiant: radiant },
  sources,
});

const relics = [
  route("Axi A21 Relic", "Axi", false, 2, 10, [row(lua, 12.5, { rotation: "C" }), row(event, 50)]),
  route("Lith B4 Relic", "Lith", false, 25.33, 16.67),
  route("Meso N9 Relic", "Meso", true, 11, 20),
];

describe("relics", () => {
  it("sorts farmable first, then by the chosen refinement or by tier and name", () => {
    expect(sortRelics(relics, "intact").map((r) => r.relic)).toEqual(["Lith B4 Relic", "Axi A21 Relic", "Meso N9 Relic"]);
    expect(sortRelics(relics, "radiant").map((r) => r.relic)).toEqual(["Lith B4 Relic", "Axi A21 Relic", "Meso N9 Relic"]);
    expect(sortRelics(relics, "name").map((r) => r.relic)).toEqual(["Lith B4 Relic", "Axi A21 Relic", "Meso N9 Relic"]);
  });

  it("filters by tier and vaulted", () => {
    expect(filterRelics(relics, { tiers: ["Axi", "Meso"] }).map((r) => r.relic)).toEqual(["Axi A21 Relic", "Meso N9 Relic"]);
    expect(filterRelics(relics, { hideVaulted: true })).toHaveLength(2);
    expect(filterRelics(relics, {})).toHaveLength(3);
    expect(relicTiers(relics)).toEqual(["Lith", "Meso", "Axi"]);
  });
});

describe("bestBet", () => {
  it("picks the best drop that's always there, and the best farmable relic with its best source", () => {
    const bet = bestBet({ direct: rows, relics });
    expect(bet.direct).toMatchObject({ source: { name: "Apollo" }, chance: 12.5 });
    expect(bet.relic?.route.relic).toBe("Lith B4 Relic");
    expect(bet.relic?.source).toBeUndefined();

    const onlyAxi = bestBet({ direct: [], relics: [relics[0], relics[2]] });
    expect(onlyAxi.direct).toBeUndefined();
    expect(onlyAxi.relic?.source).toMatchObject({ source: { name: "Apollo" } });
  });

  it("has nothing to offer when every relic is vaulted", () => {
    expect(bestBet({ direct: [], relics: [relics[2]] })).toEqual({});
  });
});
