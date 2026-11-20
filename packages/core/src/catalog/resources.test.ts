// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { parseResourceLocations, resourceLocation } from "./resources.ts";

describe("resource locations", () => {
  it("are the description's Location line", () => {
    expect(resourceLocation("Ancient energy cell from the Orokin era.\r\n\r\nLocation: Ceres, Saturn, and Deimos")).toBe(
      "Ceres, Saturn, and Deimos",
    );
    expect(resourceLocation("Lighter than air.\n\nLocation: Venus, Jupiter, and Lua.")).toBe("Venus, Jupiter, and Lua");
    expect(resourceLocation("Just flavour text.")).toBeUndefined();
    expect(resourceLocation("Location: ")).toBeUndefined();
  });

  it("are read by name from ExportResources, skipping resources without one", () => {
    const locations = parseResourceLocations({
      ExportResources: [
        { name: "Morphics", description: "An amorphous solid.\r\n\r\nLocation: Mercury, Mars, and Pluto" },
        { name: "Forma", description: "Reshapes polarity." },
        { name: "Morphics", description: "Location: elsewhere" },
        { description: "Location: nowhere" },
      ],
    });
    expect([...locations]).toEqual([["Morphics", "Mercury, Mars, and Pluto"]]);
    expect(() => parseResourceLocations({})).toThrow(/ExportResources/);
  });
});
