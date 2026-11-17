// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { parseWarframeList, warframeParts, wikiMainPage } from "./warframes.ts";

describe("parseWarframeList", () => {
  it("keeps playable Warframes and pairs each with its Prime", () => {
    const list = parseWarframeList([
      { name: "Nezha Prime", isPrime: true, productCategory: "Suits", wikiaUrl: "https://wiki.warframe.com/w/Nezha%2FPrime" },
      { name: "Nezha", isPrime: false, productCategory: "Suits", wikiaUrl: "https://wiki.warframe.com/w/Nezha" },
      { name: "Dagath", isPrime: false, productCategory: "Suits", wikiaUrl: "https://example.com/Dagath" },
      { name: "Excalibur Umbra", isPrime: false, productCategory: "SpecialItems" },
      { name: "Voidrig", isPrime: false, productCategory: "MechSuits" },
      { name: "Helminth" },
    ]);
    expect(list).toEqual([
      { name: "Dagath", prime: false },
      { name: "Nezha", prime: false, counterpart: "Nezha Prime", wikiUrl: "https://wiki.warframe.com/w/Nezha" },
      { name: "Nezha Prime", prime: true, counterpart: "Nezha", wikiUrl: "https://wiki.warframe.com/w/Nezha%2FPrime" },
    ]);
  });

  it("rejects anything that isn't a list", () => {
    expect(() => parseWarframeList({})).toThrow(/array/);
  });
});

describe("wikiMainPage", () => {
  it("points at the page holding the article text", () => {
    expect(wikiMainPage({ name: "Nezha", prime: false, wikiUrl: "https://wiki.warframe.com/w/Nezha" })).toBe("Nezha/Main");
    expect(wikiMainPage({ name: "Cyte-09", prime: false })).toBe("Cyte-09/Main");
    expect(wikiMainPage({ name: "X", prime: false, wikiUrl: "https://wiki.warframe.com/w/Sirius_%26_Orion" })).toBe(
      "Sirius & Orion/Main",
    );
  });
});

describe("warframeParts", () => {
  it("names the four blueprints as the drop tables do", () => {
    expect(warframeParts("Khora Prime")).toEqual([
      "Khora Prime Blueprint",
      "Khora Prime Chassis Blueprint",
      "Khora Prime Neuroptics Blueprint",
      "Khora Prime Systems Blueprint",
    ]);
  });
});
