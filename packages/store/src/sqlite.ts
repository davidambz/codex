// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { DatabaseSync } from "node:sqlite";
import { EQUIPMENT_CATEGORIES, isItemLanguage, type CatalogEntry, type Db, type Material, type SqlValue } from "@iaframe/core";
import type { ItemNames } from "./names.ts";

/** A read-only connection to a built database, as the queries see it. */
export interface Store extends Db {
  close(): void;
}

export function openStore(path: string): Store {
  const db = new DatabaseSync(path, { readOnly: true });
  return wrap(db);
}

export function wrap(db: DatabaseSync): Store {
  // Statements are cached: the same few queries run on every keystroke.
  const cache = new Map<string, ReturnType<DatabaseSync["prepare"]>>();
  const statement = (sql: string) => {
    let stmt = cache.get(sql);
    if (!stmt) {
      stmt = db.prepare(sql);
      cache.set(sql, stmt);
    }
    return stmt;
  };
  return {
    all: <T>(sql: string, ...params: SqlValue[]) => statement(sql).all(...params) as T[],
    get: <T>(sql: string, ...params: SqlValue[]) => statement(sql).get(...params) as T | undefined,
    close: () => db.close(),
  };
}

/** Reads the meta table of the database at `path`, or nothing if there's no usable database there. */
export function readMeta(path: string): Record<string, string> | undefined {
  let db: DatabaseSync | undefined;
  try {
    db = new DatabaseSync(path, { readOnly: true });
    const rows = db.prepare("SELECT key, value FROM meta").all() as { key: string; value: string }[];
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch {
    return undefined;
  } finally {
    db?.close();
  }
}

/** The catalog stored in the database at `path` (without parts), to carry over when it can't be fetched. */
export function readCatalog(path: string): CatalogEntry[] {
  let db: DatabaseSync | undefined;
  try {
    db = new DatabaseSync(path, { readOnly: true });
    const rows = db
      .prepare(
        `SELECT i.name, e.category, e.prime, e.counterpart, e.image_name, e.wiki_url, e.acquisition, e.credits
         FROM equipment e JOIN items i ON i.id = e.item_id ORDER BY i.name`,
      )
      .all() as {
      name: string;
      category: string;
      prime: number;
      counterpart: string | null;
      image_name: string | null;
      wiki_url: string | null;
      acquisition: string | null;
      credits: number | null;
    }[];
    const parts = new Map<string, string[]>();
    for (const { owner, part } of db
      .prepare("SELECT i.name AS owner, p.part FROM parts p JOIN items i ON i.id = p.owner_id ORDER BY p.position")
      .all() as { owner: string; part: string }[]) {
      parts.set(owner, [...(parts.get(owner) ?? []), part]);
    }
    const materials = new Map<string, Material[]>();
    for (const { owner, name, count } of db
      .prepare(
        `SELECT o.name AS owner, i.name, m.count FROM materials m
         JOIN items o ON o.id = m.owner_id JOIN items i ON i.id = m.item_id ORDER BY m.position`,
      )
      .all() as { owner: string; name: string; count: number }[]) {
      materials.set(owner, [...(materials.get(owner) ?? []), { name, count }]);
    }
    return rows.flatMap((r) => {
      const category = EQUIPMENT_CATEGORIES.find((c) => c === r.category);
      if (!category) return [];
      const entry: CatalogEntry = { name: r.name, category, prime: r.prime === 1 };
      if (r.counterpart) entry.counterpart = r.counterpart;
      if (r.image_name) entry.imageName = r.image_name;
      if (r.wiki_url) entry.wikiUrl = r.wiki_url;
      if (r.acquisition) entry.acquisition = JSON.parse(r.acquisition) as string[];
      const owned = parts.get(r.name);
      if (owned) entry.parts = owned;
      const consumed = materials.get(r.name);
      if (consumed) entry.materials = consumed;
      if (r.credits !== null) entry.credits = r.credits;
      return [entry];
    });
  } catch {
    return [];
  } finally {
    db?.close();
  }
}

/** The item pictures stored in the database at `path`, to carry over when the catalog can't be fetched. */
export function readItemImages(path: string): Map<string, string> {
  let db: DatabaseSync | undefined;
  try {
    db = new DatabaseSync(path, { readOnly: true });
    const rows = db.prepare("SELECT name, image_name FROM items WHERE image_name IS NOT NULL").all() as {
      name: string;
      image_name: string;
    }[];
    return new Map(rows.map((r) => [r.name, r.image_name]));
  } catch {
    return new Map();
  } finally {
    db?.close();
  }
}

/** The translated names stored in the database at `path`, to carry over when they can't be fetched. */
export function readItemNames(path: string): ItemNames {
  const names: ItemNames = new Map();
  let db: DatabaseSync | undefined;
  try {
    db = new DatabaseSync(path, { readOnly: true });
    const rows = db
      .prepare("SELECT i.name AS item, n.lang, n.name FROM names n JOIN items i ON i.id = n.item_id")
      .all() as { item: string; lang: string; name: string }[];
    for (const row of rows) {
      if (!isItemLanguage(row.lang)) continue;
      let byItem = names.get(row.lang);
      if (!byItem) names.set(row.lang, (byItem = new Map()));
      byItem.set(row.item, row.name);
    }
  } catch {
    // No database, or one without names: nothing to carry over.
  } finally {
    db?.close();
  }
  return names;
}
