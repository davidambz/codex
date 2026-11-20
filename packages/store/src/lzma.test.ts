// Codex — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { readFileSync } from "node:fs";
import { decodeLzma } from "./lzma.ts";
import { parseExportIndex } from "./export.ts";

const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`./test/fixtures/${name}`, import.meta.url)));

describe("decodeLzma", () => {
  it("unpacks the Public Export index as the game serves it", () => {
    const text = new TextDecoder().decode(decodeLzma(fixture("export-index.lzma")));
    expect(text).toBe(new TextDecoder().decode(fixture("export-index.txt")));
    expect(parseExportIndex(text).get("ExportRecipes_en.json")).toBe("ExportRecipes_en.json!00_oac+LCAtIyqDxZF8Qe1ZZA");
  });

  it("rejects what isn't LZMA", () => {
    expect(() => decodeLzma(new Uint8Array([1, 2, 3]))).toThrow(/LZMA/);
    expect(() => decodeLzma(new Uint8Array(20).fill(0xff))).toThrow(/LZMA/);
  });
});
