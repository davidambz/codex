// Codex — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// Where a resource is found, as the game itself puts it: the in-game
// description of most resources ends in a "Location:" line ("Ceres,
// Saturn, and Deimos"). The game publishes no per-planet chances, so this
// text is all there is beyond the drop tables.

/** Resource name -> where it's found ("Ceres, Saturn, and Deimos"), from the Public Export's ExportResources. */
export function parseResourceLocations(raw: unknown): Map<string, string> {
  const list = (raw as { ExportResources?: unknown } | null)?.ExportResources;
  if (!Array.isArray(list)) throw new Error("Not a Public Export resources file: expected ExportResources");
  const locations = new Map<string, string>();
  for (const item of list as { name?: unknown; description?: unknown }[]) {
    if (typeof item?.name !== "string" || typeof item.description !== "string") continue;
    const location = resourceLocation(item.description);
    const name = item.name.trim();
    if (location && name && !locations.has(name)) locations.set(name, location);
  }
  return locations;
}

/** The text after "Location:" in an in-game description, without a closing full stop. */
export function resourceLocation(description: string): string | undefined {
  const match = /(?:^|\n)\s*Location:\s*(.+?)\s*$/s.exec(description);
  const text = match?.[1].replace(/\s+/g, " ").replace(/\.$/, "").trim();
  return text || undefined;
}
