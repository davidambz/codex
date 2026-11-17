// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ingest, WFCD_DATA_URL, WFCD_INFO_URL, type FetchJson } from "./ingest.ts";
import { openStore, readMeta, readWarframes } from "./sqlite.ts";
import { fakeCatalog } from "./test/catalog.ts";
import sample from "../../core/src/wfcd/fixtures/sample.json" with { type: "json" };

let dir: string;
let dbPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "iaframe-store-"));
  dbPath = join(dir, "nested", "iaframe.db");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** A fake WFCD serving `data` under `hash`, counting downloads of all.json; `catalogUp` toggles the catalog. */
function wfcd(hash: string, data: unknown = sample) {
  const fake: { downloads: number; catalogUp: boolean; fetchJson: FetchJson } = {
    downloads: 0,
    catalogUp: true,
    fetchJson: (async (url) => {
      if (url === WFCD_INFO_URL) return { hash, timestamp: 1, modified: Date.UTC(2026, 10, 17) };
      if (url === WFCD_DATA_URL) {
        fake.downloads++;
        return data;
      }
      const catalog: unknown = fake.catalogUp ? fakeCatalog(url) : undefined;
      if (catalog) return catalog;
      throw new Error(`unexpected ${url}`);
    }) as FetchJson,
  };
  return fake;
}

const now = () => new Date("2026-11-17T12:00:00Z");

describe("ingest", () => {
  it("builds the database on first run", async () => {
    const source = wfcd("h1");
    const result = await ingest({ dbPath, fetchJson: source.fetchJson, now });
    expect(result).toMatchObject({ status: "updated", hash: "h1", skipped: 0 });
    expect(readMeta(dbPath)).toMatchObject({
      drops_hash: "h1",
      ingested_at: "2026-11-17T12:00:00.000Z",
      source_modified: "2026-11-17T00:00:00.000Z",
      schema_version: "2",
      warframes: "3",
    });
    expect(existsSync(`${dbPath}.tmp`)).toBe(false);
  });

  it("stores rows the queries can read", async () => {
    await ingest({ dbPath, fetchJson: wfcd("h1").fetchJson, now });
    const store = openStore(dbPath);
    try {
      const rows = store.all<{ refinement: string; chance: number }>(
        `SELECT d.refinement, d.chance FROM drops d
         JOIN items i ON i.id = d.item_id JOIN sources s ON s.id = d.source_id
         WHERE i.name = ? AND s.key = ? ORDER BY d.chance`,
        "Khora Prime Chassis Blueprint",
        "relic:Axi G13",
      );
      expect(rows.map((r) => r.chance)).toEqual([11, 13, 17, 20]);
      expect(store.get<{ vaulted: number }>("SELECT vaulted FROM relics WHERE code = ?", "S21")).toEqual({ vaulted: 0 });
    } finally {
      store.close();
    }
  });

  it("downloads nothing more when the hash is unchanged", async () => {
    const source = wfcd("h1");
    await ingest({ dbPath, fetchJson: source.fetchJson, now });
    expect(await ingest({ dbPath, fetchJson: source.fetchJson, now })).toEqual({ status: "up-to-date", hash: "h1" });
    expect(source.downloads).toBe(1);
  });

  it("rebuilds when forced or when the hash changes", async () => {
    await ingest({ dbPath, fetchJson: wfcd("h1").fetchJson, now });
    expect((await ingest({ dbPath, fetchJson: wfcd("h1").fetchJson, now, force: true })).status).toBe("updated");
    expect((await ingest({ dbPath, fetchJson: wfcd("h2").fetchJson, now })).status).toBe("updated");
    expect(readMeta(dbPath)?.drops_hash).toBe("h2");
  });

  it("closes the caller's connection before swapping files", async () => {
    const calls: string[] = [];
    await ingest({ dbPath, fetchJson: wfcd("h1").fetchJson, now, beforeSwap: () => calls.push("swap") });
    expect(calls).toEqual(["swap"]);
  });

  it("keeps the old database when the new data fails validation", async () => {
    await ingest({ dbPath, fetchJson: wfcd("h1").fetchJson, now });
    const before = readFileSync(dbPath);

    const broken = { ...sample, modLocations: [] };
    const beforeSwap = vi.fn();
    const result = await ingest({ dbPath, fetchJson: wfcd("h2", broken).fetchJson, now, beforeSwap });

    expect(result).toEqual({ status: "rejected", hash: "h2", problems: ["Serration no longer drops from any enemy"] });
    expect(beforeSwap).not.toHaveBeenCalled();
    expect(readFileSync(dbPath).equals(before)).toBe(true);
  });

  it("stores the Warframe list with the wiki's acquisition text", async () => {
    const result = await ingest({ dbPath, fetchJson: wfcd("h1").fetchJson, now });
    expect(result).toMatchObject({ status: "updated", warframes: 3 });
    expect(result).not.toHaveProperty("catalogError");
    expect(readWarframes(dbPath)).toEqual([
      {
        name: "Khora",
        prime: false,
        counterpart: "Khora Prime",
        wikiUrl: "https://wiki.warframe.com/w/Khora",
        acquisition: ["Khora's main blueprint can be purchased from the Market."],
      },
      { name: "Khora Prime", prime: true, counterpart: "Khora", wikiUrl: "https://wiki.warframe.com/w/Khora%2FPrime" },
      {
        name: "Nezha",
        prime: false,
        wikiUrl: "https://wiki.warframe.com/w/Nezha",
        acquisition: ["Nezha's blueprints can be researched from the Tenno Lab in the dojo."],
      },
    ]);
  });

  it("still updates the drops when the catalog is down, keeping the last Warframe list", async () => {
    await ingest({ dbPath, fetchJson: wfcd("h1").fetchJson, now });

    const down = wfcd("h2");
    down.catalogUp = false;
    const result = await ingest({ dbPath, fetchJson: down.fetchJson, now });
    expect(result).toMatchObject({ status: "updated", hash: "h2", warframes: 3 });
    expect(result).toHaveProperty("catalogError");
    expect(readWarframes(dbPath).map((w) => w.name)).toEqual(["Khora", "Khora Prime", "Nezha"]);

    // Same drop hash, but the catalog is retried until it comes through.
    expect((await ingest({ dbPath, fetchJson: down.fetchJson, now })).status).toBe("updated");
    down.catalogUp = true;
    expect((await ingest({ dbPath, fetchJson: down.fetchJson, now })).status).toBe("updated");
    expect((await ingest({ dbPath, fetchJson: down.fetchJson, now })).status).toBe("up-to-date");
  });

  it("builds without Warframes when the catalog is down on the first run", async () => {
    const down = wfcd("h1");
    down.catalogUp = false;
    expect(await ingest({ dbPath, fetchJson: down.fetchJson, now })).toMatchObject({ status: "updated", warframes: 0 });
  });

  it("refuses an info.json without a hash", async () => {
    const fetchJson: FetchJson = async () => ({});
    await expect(ingest({ dbPath, fetchJson })).rejects.toThrow(/hash/);
    expect(existsSync(dbPath)).toBe(false);
  });
});
