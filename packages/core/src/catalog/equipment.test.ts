// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import {
  applyPartRecipes,
  assignWeaponParts,
  equipmentPartLabel,
  joinCatalog,
  partImage,
  parseEquipment,
  partLabel,
  recipePiece,
  warframeParts,
  wikiPage,
  type CatalogEntry,
} from "./equipment.ts";

describe("parseEquipment", () => {
  it("keeps playable Warframes only", () => {
    const list = parseEquipment("warframe", [
      { name: "Nezha", isPrime: false, productCategory: "Suits", wikiaUrl: "https://wiki.warframe.com/w/Nezha" },
      { name: "Dagath", isPrime: false, productCategory: "Suits", wikiaUrl: "https://example.com/Dagath" },
      { name: "Excalibur Umbra", isPrime: false, productCategory: "SpecialItems" },
      { name: "Voidrig", isPrime: false, productCategory: "MechSuits" },
      { name: "Helminth" },
    ]);
    expect(list).toEqual([
      { name: "Nezha", category: "warframe", prime: false, wikiUrl: "https://wiki.warframe.com/w/Nezha" },
      { name: "Dagath", category: "warframe", prime: false },
    ]);
  });

  it("leaves Zaw parts and amps out of the weapons", () => {
    const list = parseEquipment("melee", [
      { name: "War", productCategory: "Melee" },
      { name: "Plague Kripath", type: "Zaw Component" },
      { name: "Amp Prism", productCategory: "OperatorAmps" },
    ]);
    expect(list.map((e) => e.name)).toEqual(["War"]);
  });

  it("keeps companions, not their mutagens and antigens", () => {
    const list = parseEquipment("companion", [
      { name: "Helios", type: "Sentinel" },
      { name: "Smeeta Kavat", productCategory: "KubrowPets" },
      { name: "Lambeo Moa", type: "Pets", productCategory: "Pistols" },
      { name: "Venari", productCategory: "SpecialItems" },
      { name: "Adra Mutagen", type: "Pet Parts", productCategory: "Pistols" },
    ]);
    expect(list.map((e) => e.name)).toEqual(["Helios", "Smeeta Kavat", "Lambeo Moa", "Venari"]);
  });

  it("reads what else the recipe consumes and its price, adding up repeated components", () => {
    const names = new Map([
      ["/Lotus/Types/Items/MiscItems/OrokinCell", "Orokin Cell"],
      ["/Lotus/Weapons/Tenno/Pistol/CrossBow", "Bolto"],
    ]);
    const [akbolto] = parseEquipment(
      "secondary",
      [
        {
          name: "Akbolto",
          buildPrice: 25000,
          components: [
            { uniqueName: "/Lotus/Types/Recipes/Weapons/AkBoltoBlueprint", itemCount: 1 },
            { uniqueName: "/Lotus/Weapons/Tenno/Pistol/CrossBow", itemCount: 1 },
            { uniqueName: "/Lotus/Weapons/Tenno/Pistol/CrossBow", itemCount: 1 },
            { uniqueName: "/Lotus/Types/Items/MiscItems/OrokinCell", itemCount: 1 },
            { uniqueName: "/Lotus/Types/Items/Unknown", itemCount: 3 },
          ],
        },
      ],
      names,
    );
    expect(akbolto.recipe).toEqual(["Blueprint"]);
    expect(akbolto.materials).toEqual([
      { name: "Bolto", count: 2 },
      { name: "Orokin Cell", count: 1 },
    ]);
    expect(akbolto.credits).toBe(25000);
    expect(akbolto.pieceCounts).toBeUndefined();
  });

  it("counts pieces the recipe takes more than once", () => {
    const [prime] = parseEquipment("secondary", [
      {
        name: "Akbolto Prime",
        components: [
          { uniqueName: "/Lotus/Types/Recipes/Weapons/AkboltoPrimeBlueprint", itemCount: 1 },
          { uniqueName: "/Lotus/Types/Recipes/Weapons/WeaponParts/AkboltoPrimeBarrel", itemCount: 2 },
          { uniqueName: "/Lotus/Types/Recipes/Weapons/WeaponParts/AkboltoPrimeReceiver", itemCount: 2 },
        ],
      },
    ]);
    expect(prime.pieceCounts).toEqual({ Barrel: 2, Receiver: 2 });
  });

  it("gives each piece its own blueprint's cost from the Public Export", () => {
    const names = new Map([["/Lotus/Types/Items/MiscItems/Ferrite", "Ferrite"]]);
    const [nezha] = parseEquipment("warframe", [
      {
        name: "Nezha",
        productCategory: "Suits",
        components: [
          { uniqueName: "/Lotus/Types/Recipes/WarframeRecipes/NezhaBlueprint", itemCount: 1 },
          { uniqueName: "/Lotus/Types/Recipes/WarframeRecipes/NezhaChassisComponent", itemCount: 1 },
          { uniqueName: "/Lotus/Types/Recipes/WarframeRecipes/NezhaHelmetComponent", itemCount: 1 },
        ],
      },
    ]);
    applyPartRecipes(
      [nezha],
      {
        ExportRecipes: [
          {
            resultType: "/Lotus/Types/Recipes/WarframeRecipes/NezhaChassisComponent",
            buildPrice: 15000,
            ingredients: [
              { ItemType: "/Lotus/Types/Items/MiscItems/Ferrite", ItemCount: 3200 },
              { ItemType: "/Lotus/Types/Items/Unknown", ItemCount: 1 },
            ],
          },
        ],
      },
      names,
    );
    expect(nezha.partRecipes).toEqual({ Chassis: { materials: [{ name: "Ferrite", count: 3200 }], credits: 15000 } });
    expect(() => applyPartRecipes([nezha], {}, names)).toThrow(/ExportRecipes/);
  });

  it("rejects anything that isn't a list", () => {
    expect(() => parseEquipment("warframe", {})).toThrow(/array/);
  });
});

describe("joinCatalog", () => {
  it("sorts and pairs regular and Prime versions of the same category", () => {
    const list = joinCatalog([
      [
        { name: "Nezha Prime", category: "warframe", prime: true },
        { name: "Nezha", category: "warframe", prime: false },
      ],
      [{ name: "Lex", category: "secondary", prime: false }],
      [{ name: "Nezha", category: "melee", prime: false }],
    ]);
    expect(list).toEqual([
      { name: "Lex", category: "secondary", prime: false },
      { name: "Nezha", category: "warframe", prime: false, counterpart: "Nezha Prime" },
      { name: "Nezha Prime", category: "warframe", prime: true, counterpart: "Nezha" },
    ]);
  });
});

describe("wikiPage", () => {
  it("points at the page holding the article text", () => {
    const frame = (wikiUrl?: string): CatalogEntry => ({ name: "Cyte-09", category: "warframe", prime: false, wikiUrl });
    expect(wikiPage(frame("https://wiki.warframe.com/w/Nezha"))).toBe("Nezha/Main");
    expect(wikiPage(frame())).toBe("Cyte-09/Main");
    expect(wikiPage(frame("https://wiki.warframe.com/w/Sirius_%26_Orion"))).toBe("Sirius & Orion/Main");
    expect(wikiPage({ name: "Helios", category: "companion", prime: false })).toBe("Helios/Main");
    expect(
      wikiPage({ name: "War Prime", category: "melee", prime: true, wikiUrl: "https://wiki.warframe.com/w/War%2FPrime" }),
    ).toBe("War/Prime");
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

describe("Warframe parts", () => {
  it("are the four blueprints, unless the drop tables name variants like Equinox's", () => {
    const frames: CatalogEntry[] = [
      { name: "Nezha", category: "warframe", prime: false },
      { name: "Equinox", category: "warframe", prime: false },
      { name: "Equinox Prime", category: "warframe", prime: true, recipe: ["Blueprint", "Chassis", "Neuroptics", "Systems"] },
    ];
    assignWeaponParts(frames, [
      "Equinox Night Chassis Blueprint",
      "Equinox Day Chassis Blueprint",
      "Equinox Day Aspect Blueprint",
      "Equinox Prime Chassis Blueprint",
      "Equinox Prime Blueprint",
    ]);
    expect(frames[0].parts).toEqual(warframeParts("Nezha"));
    expect(frames[1].parts).toEqual([
      "Equinox Blueprint",
      "Equinox Day Aspect Blueprint",
      "Equinox Day Chassis Blueprint",
      "Equinox Night Chassis Blueprint",
    ]);
    expect(frames[2].parts).toEqual(warframeParts("Equinox Prime"));
  });

  it("follow the recipe: Umbra is its blueprint alone, a Prime with no recipe has none", () => {
    const frames: CatalogEntry[] = [
      { name: "Excalibur Umbra", category: "warframe", prime: false, recipe: ["Blueprint"] },
      { name: "Excalibur Prime", category: "warframe", prime: true },
      { name: "Chroma", category: "warframe", prime: false, recipe: ["Blueprint", "Chassis", "Neuroptics", "Systems"] },
    ];
    assignWeaponParts(frames, []);
    expect(frames.map((f) => f.parts)).toEqual([["Excalibur Umbra Blueprint"], [], warframeParts("Chroma")]);
  });

  it("names each piece", () => {
    expect(equipmentPartLabel("warframe", "Equinox", "Equinox Day Chassis Blueprint")).toBe("Day Chassis");
    expect(equipmentPartLabel("warframe", "Nezha", "Nezha Blueprint")).toBe("Blueprint");
    expect(equipmentPartLabel("primary", "Soma", "Soma Barrel")).toBe("Barrel");
    expect(partImage("Night Chassis", false)).toBe("GenericWarframeChassis.png");
  });
});

describe("recipe pieces", () => {
  it("reads the piece from the component's internal name", () => {
    expect(recipePiece("/Lotus/Types/Recipes/Weapons/WeaponParts/SomaPrimeBarrel")).toBe("Barrel");
    expect(recipePiece("/Lotus/Types/Recipes/Weapons/SomaPrimeBlueprint")).toBe("Blueprint");
    expect(recipePiece("/Lotus/Types/Recipes/Weapons/StalkerTwoGreatswordBlueprint")).toBe("Blueprint");
    expect(recipePiece("/Lotus/Types/Recipes/Weapons/WeaponParts/AkbroncoPrimeLink")).toBe("Link");
    expect(recipePiece("/Lotus/Types/Recipes/Weapons/WeaponParts/CernosPrimeUpperLimb")).toBe("Upper Limb");
    expect(recipePiece("/Lotus/Types/Recipes/Weapons/WeaponParts/OkinaPrimeLeftGauntlet")).toBe("Left Gauntlet");
    expect(recipePiece("/Lotus/Types/Game/SentinelPowersuits/PrimeHeliosCarapace")).toBeUndefined();
    expect(recipePiece("/Lotus/Types/Recipes/Helmets/PrimeHeliosCerebrum")).toBe("Cerebrum");
    expect(recipePiece("/Lotus/Types/Recipes/WarframeRecipes/NezhaHelmetComponent")).toBe("Neuroptics");
    expect(recipePiece("/Lotus/Types/Items/MiscItems/OrokinCell")).toBeUndefined();
    expect(recipePiece("/Lotus/Weapons/ClanTech/Energy/ChainLightningRifleBlueprint")).toBe("Blueprint");
    expect(recipePiece("/Lotus/Weapons/Ostron/Melee/ModularMelee01/Tip/TipOne")).toBeUndefined();
    expect(recipePiece("/Lotus/Weapons/Tenno/Pistol/BroncoPrime")).toBeUndefined();
  });

  it("puts every piece of the recipe on the weapon, whether it drops or not", () => {
    const [soma] = parseEquipment("primary", [
      {
        name: "Soma Prime",
        components: [
          { uniqueName: "/Lotus/Types/Recipes/Weapons/WeaponParts/SomaPrimeBarrel" },
          { uniqueName: "/Lotus/Types/Recipes/Weapons/SomaPrimeBlueprint" },
          { uniqueName: "/Lotus/Types/Items/MiscItems/OrokinCell" },
          { uniqueName: "/Lotus/Types/Recipes/Weapons/WeaponParts/SomaPrimeStock" },
        ],
      },
    ]);
    expect(soma.recipe).toEqual(["Barrel", "Blueprint", "Stock"]);
    const ruvox: CatalogEntry = { name: "Ruvox", category: "melee", prime: false, recipe: ["Blueprint", "Glove"] };
    assignWeaponParts([soma, ruvox], ["Soma Prime Barrel", "Ruvox Glove Blueprint"]);
    expect(soma.parts).toEqual(["Soma Prime Blueprint", "Soma Prime Barrel", "Soma Prime Stock"]);
    expect(ruvox.parts).toEqual(["Ruvox Blueprint", "Ruvox Glove Blueprint"]);
  });
});

describe("weapon parts", () => {
  it("names the piece a part is", () => {
    expect(partLabel("Soma Prime", "Soma Prime Barrel")).toBe("Barrel");
    expect(partLabel("Soma Prime", "Soma Prime Blueprint")).toBe("Blueprint");
    expect(partLabel("Ruvox", "Ruvox Glove Blueprint")).toBe("Glove");
    expect(partLabel("Gorgon", "Gorgon Frenzy")).toBeUndefined();
    expect(partLabel("Lex", "Lex Prime Barrel")).toBeUndefined();
  });

  it("gives each part to the longest weapon name it starts with", () => {
    const entries: CatalogEntry[] = [
      { name: "Lex", category: "secondary", prime: false },
      { name: "Lex Prime", category: "secondary", prime: false },
      { name: "Gorgon", category: "primary", prime: false },
      { name: "Nezha", category: "warframe", prime: false },
    ];
    assignWeaponParts(entries, [
      "Lex Prime Receiver",
      "Lex Prime Barrel",
      "Lex Prime Blueprint",
      "Lex Blueprint",
      "Gorgon Frenzy",
      "Nezha Chassis Blueprint",
      "Serration",
    ]);
    expect(entries.map((e) => [e.name, e.parts])).toEqual([
      ["Lex", ["Lex Blueprint"]],
      ["Lex Prime", ["Lex Prime Blueprint", "Lex Prime Barrel", "Lex Prime Receiver"]],
      ["Gorgon", undefined],
      ["Nezha", warframeParts("Nezha")],
    ]);
  });
});
