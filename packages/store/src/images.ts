// Codex — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// Item pictures from warframe-items, downloaded the first time they're
// shown and kept on disk, so the app stays offline afterwards.

import fs from "node:fs";
import path from "node:path";
import { IMAGE_BASE_URL, SAFE_IMAGE } from "@codex/core";

export type FetchBytes = (url: string) => Promise<Uint8Array>;

export interface ImageCache {
  /** The picture's bytes, or undefined when the name is bad or it can't be had. */
  get(name: string): Promise<Uint8Array | undefined>;
}

const defaultFetchBytes: FetchBytes = async (url) => {
  const response = await fetch(url, { headers: { "User-Agent": "Codex (+https://github.com/davidambz/codex)" } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
};

export function createImageCache(dir: string, fetchBytes: FetchBytes = defaultFetchBytes): ImageCache {
  const pending = new Map<string, Promise<Uint8Array | undefined>>();
  // Names that failed this session: not asked again until the app restarts.
  const missing = new Set<string>();

  async function load(name: string): Promise<Uint8Array | undefined> {
    const file = path.join(dir, name);
    try {
      return await fs.promises.readFile(file);
    } catch {
      // Not cached yet.
    }
    try {
      const bytes = await fetchBytes(IMAGE_BASE_URL + encodeURIComponent(name));
      await fs.promises.mkdir(dir, { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await fs.promises.writeFile(tmp, bytes);
      await fs.promises.rename(tmp, file);
      return bytes;
    } catch {
      missing.add(name);
      return undefined;
    }
  }

  return {
    get(name) {
      if (!SAFE_IMAGE.test(name) || missing.has(name)) return Promise.resolve(undefined);
      let result = pending.get(name);
      if (!result) {
        result = load(name).finally(() => pending.delete(name));
        pending.set(name, result);
      }
      return result;
    },
  };
}
