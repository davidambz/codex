// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { DatabaseSync } from "node:sqlite";
import type { Db, SqlValue } from "@iaframe/core";

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
