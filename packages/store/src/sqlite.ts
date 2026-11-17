// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { DatabaseSync } from "node:sqlite";
import type { Db, SqlValue, WarframeEntry } from "@iaframe/core";

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

/** The Warframe list stored in the database at `path`, to carry over when the catalog can't be fetched. */
export function readWarframes(path: string): WarframeEntry[] {
  let db: DatabaseSync | undefined;
  try {
    db = new DatabaseSync(path, { readOnly: true });
    const rows = db
      .prepare(
        `SELECT i.name, w.prime, w.counterpart, w.wiki_url, w.acquisition
         FROM warframes w JOIN items i ON i.id = w.item_id ORDER BY i.name`,
      )
      .all() as { name: string; prime: number; counterpart: string | null; wiki_url: string | null; acquisition: string | null }[];
    return rows.map((r) => {
      const entry: WarframeEntry = { name: r.name, prime: r.prime === 1 };
      if (r.counterpart) entry.counterpart = r.counterpart;
      if (r.wiki_url) entry.wikiUrl = r.wiki_url;
      if (r.acquisition) entry.acquisition = JSON.parse(r.acquisition) as string[];
      return entry;
    });
  } catch {
    return [];
  } finally {
    db?.close();
  }
}
