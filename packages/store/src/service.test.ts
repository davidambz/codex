// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DataStatus } from "@iaframe/core";
import { createDataService } from "./service.ts";
import { WFCD_DATA_URL, WFCD_INFO_URL, type FetchJson } from "./ingest.ts";
import { fakeCatalog } from "./test/catalog.ts";
import sample from "../../core/src/wfcd/fixtures/sample.json" with { type: "json" };

let dir: string;
let dbPath: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "iaframe-service-"));
  dbPath = join(dir, "iaframe.db");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const now = () => new Date("2026-11-17T12:00:00Z");
const wfcd =
  (hash: string, data: unknown = sample): FetchJson =>
  async (url) => {
    if (url === WFCD_INFO_URL) return { hash, modified: 0 };
    if (url === WFCD_DATA_URL) return data;
    const catalog = fakeCatalog(url);
    if (catalog) return catalog;
    throw new Error(url);
  };

describe("createDataService", () => {
  it("answers with nothing before the first download", () => {
    const service = createDataService({ dbPath, fetchJson: wfcd("h1"), now });
    expect(service.search("serration")).toEqual([]);
    expect(service.getItem("Serration")).toBeUndefined();
    expect(service.getDropsDeep("Serration")).toEqual({ direct: [], relics: [] });
    expect(service.status()).toEqual({ busy: false });
  });

  it("downloads, then searches and queries the new data", async () => {
    const statuses: DataStatus[] = [];
    const service = createDataService({ dbPath, fetchJson: wfcd("h1"), now, onStatus: (s) => statuses.push(s) });
    const status = await service.update();

    expect(statuses[0]).toEqual({ busy: true });
    expect(status).toMatchObject({ busy: false, outcome: "updated", checkedAt: "2026-11-17T12:00:00.000Z", info: { hash: "h1" } });
    expect(service.search("seration", 1)[0]?.name).toBe("Serration");
    expect(service.getSource("relic:Axi G13")?.drops).toHaveLength(24);
    service.close();
  });

  it("opens an existing database straight away", async () => {
    const first = createDataService({ dbPath, fetchJson: wfcd("h1"), now });
    await first.update();
    first.close();

    const second = createDataService({ dbPath, fetchJson: wfcd("h1"), now });
    expect(second.status().info?.hash).toBe("h1");
    expect(second.search("khora p chassi", 1)).toHaveLength(1);
    expect((await second.update()).outcome).toBe("up-to-date");
    second.close();
  });

  it("swaps in new data without a restart", async () => {
    let source = wfcd("h1");
    const service = createDataService({ dbPath, fetchJson: (url) => source(url), now });
    await service.update();
    expect(service.search("shiny new", 1)).toEqual([]);

    source = wfcd("h2", { ...sample, sortieRewards: [{ itemName: "Shiny New Thing", rarity: "Rare", chance: 100 }] });
    expect((await service.update()).outcome).toBe("updated");
    expect(service.status().info?.hash).toBe("h2");
    expect(service.search("shiny new", 1)[0]?.name).toBe("Shiny New Thing");
    service.close();
  });

  it("shares one run between concurrent update calls", async () => {
    let downloads = 0;
    const fetchJson: FetchJson = async (url) => {
      if (url === WFCD_DATA_URL) downloads++;
      return wfcd("h1")(url);
    };
    const service = createDataService({ dbPath, fetchJson, now });
    await Promise.all([service.update(), service.update(), service.update()]);
    expect(downloads).toBe(1);
    service.close();
  });

  it("keeps working on the old data when WFCD can't be reached", async () => {
    const service = createDataService({ dbPath, fetchJson: wfcd("h1"), now });
    await service.update();
    const offline = createDataService({
      dbPath,
      fetchJson: async () => {
        throw new Error("getaddrinfo ENOTFOUND");
      },
      now,
    });
    service.close();
    const status = await offline.update();
    expect(status).toMatchObject({ busy: false, outcome: "failed", error: "getaddrinfo ENOTFOUND", info: { hash: "h1" } });
    expect(offline.search("serration", 1)).toHaveLength(1);
    offline.close();
  });
});
