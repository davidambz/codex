// Codex — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { IMAGE_BASE_URL } from "@codex/core";
import { createImageCache } from "./images.ts";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "codex-images-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("image cache", () => {
  it("downloads a picture once and serves it from disk after", async () => {
    const fetchBytes = vi.fn(async () => new Uint8Array([1, 2, 3]));
    const cache = createImageCache(dir, fetchBytes);
    expect(await cache.get("SomaPrime.png")).toEqual(new Uint8Array([1, 2, 3]));
    expect(fetchBytes).toHaveBeenCalledWith(`${IMAGE_BASE_URL}SomaPrime.png`);
    expect(readFileSync(join(dir, "SomaPrime.png"))).toEqual(Buffer.from([1, 2, 3]));

    const again = createImageCache(dir, fetchBytes);
    expect(await again.get("SomaPrime.png")).toEqual(Buffer.from([1, 2, 3]));
    expect(fetchBytes).toHaveBeenCalledTimes(1);
  });

  it("refuses names that aren't plain picture files", async () => {
    const fetchBytes = vi.fn(async () => new Uint8Array([1]));
    const cache = createImageCache(dir, fetchBytes);
    expect(await cache.get("../secret.png")).toBeUndefined();
    expect(await cache.get("notes.txt")).toBeUndefined();
    expect(fetchBytes).not.toHaveBeenCalled();
  });

  it("gives up on a picture that can't be had, without asking again", async () => {
    const fetchBytes = vi.fn(async () => {
      throw new Error("offline");
    });
    const cache = createImageCache(dir, fetchBytes);
    expect(await cache.get("Nope.png")).toBeUndefined();
    expect(await cache.get("Nope.png")).toBeUndefined();
    expect(fetchBytes).toHaveBeenCalledTimes(1);
  });
});
