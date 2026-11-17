// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import type { EquipmentCard } from "@iaframe/core";
import { cardAvailability } from "./foundry";

const card = (overrides: Partial<EquipmentCard>): EquipmentCard => ({
  name: "X",
  category: "warframe",
  prime: false,
  parts: [],
  materials: [],
  ...overrides,
});
const part = (status: EquipmentCard["parts"][number]["status"]) => ({ name: "X Part", label: "Chassis", status });

describe("cardAvailability", () => {
  it("calls regular gear farmable, even outside the drop tables", () => {
    expect(cardAvailability(card({ parts: [part("none"), part("drops")] }))).toBe("farmable");
    expect(cardAvailability(card({ parts: [] }))).toBe("farmable");
  });

  it("sets quest rewards and things no longer handed out apart", () => {
    expect(cardAvailability(card({ note: "quest", parts: [part("none")] }))).toBe("quest");
    expect(cardAvailability(card({ prime: true, note: "unobtainable" }))).toBe("unavailable");
  });

  it("judges Primes by their parts", () => {
    expect(cardAvailability(card({ prime: true, parts: [part("relics"), part("drops")] }))).toBe("farmable");
    expect(cardAvailability(card({ prime: true, parts: [part("relics"), part("vaulted")] }))).toBe("vaulted");
    expect(cardAvailability(card({ prime: true, parts: [part("none")] }))).toBe("none");
    expect(cardAvailability(card({ prime: true, parts: [part("none"), part("relics")] }))).toBe("mixed");
  });
});
