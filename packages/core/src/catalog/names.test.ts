// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { englishIds, itemLanguageForLocale, translateNames } from "./names.ts";
import { sanitizeSettings, settingsLanguages } from "../platform.ts";

describe("englishIds", () => {
  it("maps names as the drop tables spell them, relics without the refinement", () => {
    const ids = englishIds([
      [{ name: "Oxium", uniqueName: "/Oxium" }, { name: "Axi A1 Intact", uniqueName: "/AxiA1Bronze" }, { nope: 1 }],
      [{ name: "Axi A1 Radiant", uniqueName: "/AxiA1Platinum" }, { name: "Oxium", uniqueName: "/Other" }],
      null,
    ]);
    expect(Object.fromEntries(ids)).toEqual({ Oxium: "/Oxium", "Axi A1 Relic": "/AxiA1Bronze" });
  });
});

describe("translateNames", () => {
  const ids = new Map([
    ["Oxium", "/Oxium"],
    ["Serration", "/Serration"],
    ["Orokin Ballistics Matrix", "/Matrix"],
  ]);
  const pt = {
    "/Oxium": { name: "Óxio" },
    "/Serration": { name: "Serration" },
    "/Matrix": { name: "MATRIZ DE BALÍSTICA OROKIN" },
  };

  it("keeps only names that differ, written in normal case", () => {
    const names = translateNames(["Oxium", "Serration", "Orokin Ballistics Matrix", "Alternox Prime Stock"], ids, pt);
    expect(Object.fromEntries(names)).toEqual({ Oxium: "Óxio", "Orokin Ballistics Matrix": "Matriz de Balística Orokin" });
  });

  it("refuses something that isn't an i18n file", () => {
    expect(() => translateNames(["Oxium"], ids, null)).toThrow(/i18n/);
  });
});

describe("itemLanguageForLocale", () => {
  it.each([
    ["pt-BR", "pt"],
    ["en-US", "en"],
    ["zh-TW", "tc"],
    ["zh-CN", "zh"],
    ["ja", "ja"],
    ["nl-NL", "en"],
  ])("%s -> %s", (locale, language) => {
    expect(itemLanguageForLocale(locale)).toBe(language);
  });
});

describe("settings", () => {
  const fallback = { itemLanguage: "en", searchLanguages: [] } as const;

  it("drops unknown values", () => {
    expect(sanitizeSettings({ itemLanguage: "pt", searchLanguages: ["es", "xx", "es", 3] }, { ...fallback, searchLanguages: [] })).toEqual({
      itemLanguage: "pt",
      searchLanguages: ["es"],
    });
    expect(sanitizeSettings("junk", { ...fallback, searchLanguages: [] })).toEqual(fallback);
  });

  it("needs names for the item language and the search languages, never English", () => {
    expect(settingsLanguages({ itemLanguage: "pt", searchLanguages: ["en", "es", "pt"] })).toEqual(["pt", "es"]);
  });
});
