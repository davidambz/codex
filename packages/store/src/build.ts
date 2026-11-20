// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { equipmentPartLabel, warframeParts, type CatalogEntry, type DropData } from "@iaframe/core";
import type { ItemNames } from "./names.ts";
import { SCHEMA, SCHEMA_VERSION } from "./schema.ts";

/** Writes `data` into a brand new database file at `path`, replacing whatever was there. */
export function buildDatabase(
  path: string,
  data: DropData,
  meta: Record<string, string>,
  catalog: CatalogEntry[] = [],
  names: ItemNames = new Map(),
  images: ReadonlyMap<string, string> = new Map(),
  locations: ReadonlyMap<string, string> = new Map(),
): void {
  rmSync(path, { force: true });
  const db = new DatabaseSync(path);
  try {
    db.exec("PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF;");
    db.exec(SCHEMA);
    db.exec("BEGIN");

    const insertItem = db.prepare("INSERT INTO items (name, kind) VALUES (?, ?)");
    const itemIds = new Map<string, number>();
    for (const item of data.items) {
      itemIds.set(item.name, Number(insertItem.run(item.name, item.kind).lastInsertRowid));
    }

    const insertSource = db.prepare(
      "INSERT INTO sources (key, kind, name, location, game_mode, is_event) VALUES (?, ?, ?, ?, ?, ?)",
    );
    const sourceIds = new Map<string, number>();
    for (const s of data.sources) {
      const result = insertSource.run(s.key, s.kind, s.name, s.location ?? null, s.gameMode ?? null, s.isEvent ? 1 : 0);
      sourceIds.set(s.key, Number(result.lastInsertRowid));
    }

    const insertDrop = db.prepare(
      `INSERT INTO drops (item_id, source_id, rotation, refinement, stage, rarity, chance,
                          quantity, slots, enemy_chance, table_chance, conditional)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const d of data.drops) {
      insertDrop.run(
        idOf(itemIds, d.item),
        idOf(sourceIds, d.source),
        d.rotation ?? null,
        d.refinement ?? null,
        d.stage ?? null,
        d.rarity ?? null,
        d.chance,
        d.quantity ?? null,
        d.slots ?? 1,
        d.enemyChance ?? null,
        d.tableChance ?? null,
        d.conditional ? 1 : 0,
      );
    }

    const insertRelic = db.prepare("INSERT INTO relics (item_id, tier, code, vaulted) VALUES (?, ?, ?, ?)");
    for (const r of data.relics) insertRelic.run(idOf(itemIds, r.item), r.tier, r.code, r.vaulted ? 1 : 0);

    const insertEquipment = db.prepare(
      "INSERT INTO equipment (item_id, category, prime, counterpart, image_name, wiki_url, acquisition, credits) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    const setKind = db.prepare("UPDATE items SET kind = ? WHERE id = ?");
    const insertPart = db.prepare("INSERT INTO parts (owner_id, part, position, count) VALUES (?, ?, ?, ?)");
    const kindOf = db.prepare("SELECT kind FROM items WHERE id = ?");
    for (const entry of catalog) {
      let id = itemIds.get(entry.name);
      if (id === undefined) {
        id = Number(insertItem.run(entry.name, entry.category).lastInsertRowid);
        itemIds.set(entry.name, id);
      } else {
        setKind.run(entry.category, id);
      }
      insertEquipment.run(
        id,
        entry.category,
        entry.prime ? 1 : 0,
        entry.counterpart ?? null,
        entry.imageName ?? null,
        entry.wikiUrl ?? null,
        entry.acquisition?.length ? JSON.stringify(entry.acquisition) : null,
        entry.credits ?? null,
      );
      (entry.parts ?? (entry.category === "warframe" ? warframeParts(entry.name) : undefined))?.forEach((part, position) => {
        const label = equipmentPartLabel(entry.category, entry.name, part);
        insertPart.run(id, part, position, (label && entry.pieceCounts?.[label]) || 1);
        // "War Blade" was a plain "other" until now; Prime parts keep their own kind.
        const partId = itemIds.get(part);
        const kind = partId === undefined ? undefined : (kindOf.get(partId) as { kind: string } | undefined)?.kind;
        if (partId !== undefined && kind !== "prime_part") setKind.run("part", partId);
      });
    }

    // After every entry has its id, so a recipe consuming another weapon finds it.
    const insertMaterial = db.prepare(
      "INSERT OR IGNORE INTO materials (owner_id, item_id, count, position) VALUES (?, ?, ?, ?)",
    );
    const insertPartCredits = db.prepare("INSERT OR IGNORE INTO part_credits (item_id, credits) VALUES (?, ?)");
    const idFor = (name: string, kind: string) => {
      let id = itemIds.get(name);
      if (id === undefined) {
        id = Number(insertItem.run(name, kind).lastInsertRowid);
        itemIds.set(name, id);
      }
      return id;
    };
    const addMaterials = (owner: number, materials: CatalogEntry["materials"]) =>
      materials?.forEach(({ name, count }, position) => insertMaterial.run(owner, idFor(name, "other"), count, position));
    for (const entry of catalog) {
      addMaterials(itemIds.get(entry.name)!, entry.materials);
      if (!entry.partRecipes) continue;
      for (const part of entry.parts ?? []) {
        const label = equipmentPartLabel(entry.category, entry.name, part);
        const recipe = label ? entry.partRecipes[label] : undefined;
        if (!recipe) continue;
        // A part no drop table names gets an item here, so it has a page to show its recipe on.
        const id = idFor(part, entry.prime ? "prime_part" : "part");
        addMaterials(id, recipe.materials);
        if (recipe.credits !== undefined) insertPartCredits.run(id, recipe.credits);
      }
    }

    // Only for resources already here (a drop or a recipe names them), not every one the game has.
    const insertLocation = db.prepare("INSERT INTO resource_locations (item_id, location) VALUES (?, ?)");
    for (const [name, location] of locations) {
      const id = itemIds.get(name);
      if (id !== undefined) insertLocation.run(id, location);
    }

    // A thing a recipe consumes, or the game says where to find, is a resource,
    // unless something more specific already claimed it (a weapon Akbolto takes).
    db.exec(`UPDATE items SET kind = 'resource' WHERE kind = 'other' AND (
      id IN (SELECT item_id FROM materials) OR id IN (SELECT item_id FROM resource_locations))`);

    const setImage = db.prepare("UPDATE items SET image_name = ? WHERE id = ?");
    for (const entry of catalog) {
      const id = itemIds.get(entry.name);
      if (id !== undefined && entry.imageName) setImage.run(entry.imageName, id);
    }
    for (const [item, image] of images) {
      const id = itemIds.get(item);
      if (id !== undefined) setImage.run(image, id);
    }

    const insertName = db.prepare("INSERT INTO names (item_id, lang, name) VALUES (?, ?, ?)");
    for (const [language, byItem] of names) {
      for (const [item, name] of byItem) {
        const id = itemIds.get(item);
        if (id !== undefined) insertName.run(id, language, name);
      }
    }

    const insertMeta = db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
    const allMeta = {
      ...meta,
      schema_version: String(SCHEMA_VERSION),
      items: String(itemIds.size),
      equipment: String(catalog.length),
      languages: [...names.keys()].sort().join(","),
      drops: String(data.drops.length),
      skipped: String(data.skipped),
    };
    for (const [key, value] of Object.entries(allMeta)) insertMeta.run(key, value);

    db.exec("COMMIT");
    db.exec("ANALYZE");
  } finally {
    db.close();
  }
}

function idOf(ids: Map<string, number>, name: string): number {
  const id = ids.get(name);
  if (id === undefined) throw new Error(`Drop points at unknown ${name}`);
  return id;
}
