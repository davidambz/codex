// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { extractAcquisition, toPlainText } from "./wikitext.ts";

describe("toPlainText", () => {
  it.each([
    ["[[Research/Tenno Lab|Tenno Lab]] in the [[dojo]]", "Tenno Lab in the dojo"],
    ["[[research]]ed", "researched"],
    ["costs {{sc|5,000}} Standing", "costs 5,000 Standing"],
    ["for {{cc|100,000}}", "for 100,000 Credits"],
    ["Prior to {{ver|19}}", "Prior to Update 19"],
    ["{{Resource|Vainthorn|Vainthorns}} and {{Faction|Vox Solaris}}", "Vainthorns and Vox Solaris"],
    ["[[File:Icon.png|30x30px]][[Acrithis]]", "Acrithis"],
    ["'''Rank 2 - Agent'''", "Rank 2 - Agent"],
    ["Foundry &ndash; each", "Foundry – each"],
    ["drops.<ref>Patch notes</ref> Done{{Clr}}", "drops. Done"],
    ["{{A|{{D|Slow|Slowing}}}}", "Slowing"],
  ])("%s", (input, expected) => {
    expect(toPlainText(input)).toBe(expected);
  });
});

describe("extractAcquisition", () => {
  it("reads the {{Acquisition}} template and the paragraphs after it, up to the next heading", () => {
    const page = [
      "Rhino is a tank.",
      "",
      "{{Acquisition|name=Rhino|Rhino's main [[blueprint]] can be purchased from the [[Market]]. Parts drop from [[Jackal]].}}",
      "",
      "Alternatively, [[The Circuit]] has them.",
      "",
      "===History===",
      "*Prior to {{ver|17}}, other things.",
    ].join("\n");
    expect(extractAcquisition(page)).toEqual([
      "Rhino's main blueprint can be purchased from the Market. Parts drop from Jackal.",
      "Alternatively, The Circuit has them.",
    ]);
  });

  it("reads an ==Acquisition== section, without history or tables", () => {
    const page = [
      "==Acquisition==",
      "Nezha's blueprints can be [[research]]ed in the [[dojo]].",
      "",
      '{| class="emodtable"',
      "|-",
      "! Node",
      "|}",
      "",
      "Prior to {{ver|19}}, the main blueprint was sold in the [[Market]].",
      "",
      "==Crafting==",
      "{{BuildAutomatic|type=Warframe|name=Nezha}}",
    ].join("\n");
    expect(extractAcquisition(page)).toEqual(["Nezha's blueprints can be researched in the dojo."]);
  });

  it("returns nothing for a page without acquisition text", () => {
    expect(extractAcquisition("==Crafting==\n{{BuildAutomatic}}")).toEqual([]);
  });

  it("keeps at most a few paragraphs", () => {
    const page = `==Acquisition==\n${["One.", "Two.", "Three.", "Four."].join("\n\n")}\n==Notes==`;
    expect(extractAcquisition(page)).toEqual(["One.", "Two.", "Three."]);
  });
});
