// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { DropData } from "@iaframe/core";
import { SCHEMA, SCHEMA_VERSION } from "./schema.ts";

/** Writes `data` into a brand new database file at `path`, replacing whatever was there. */
export function buildDatabase(path: string, data: DropData, meta: Record<string, string>): void {
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

    const insertMeta = db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
    const allMeta = {
      ...meta,
      schema_version: String(SCHEMA_VERSION),
      items: String(data.items.length),
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
