// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

/** Bumped whenever the tables change; an older database is rebuilt, not migrated. */
export const SCHEMA_VERSION = 5;

// The database is rebuilt from scratch on every ingest, so there are no
// migrations: a new schema version just forces the next ingest.
export const SCHEMA = `
CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE items (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL
);

CREATE TABLE sources (
  id        INTEGER PRIMARY KEY,
  key       TEXT NOT NULL UNIQUE,
  kind      TEXT NOT NULL,
  name      TEXT NOT NULL,
  location  TEXT,
  game_mode TEXT,
  is_event  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE drops (
  item_id      INTEGER NOT NULL REFERENCES items(id),
  source_id    INTEGER NOT NULL REFERENCES sources(id),
  rotation     TEXT,
  refinement   TEXT,
  stage        TEXT,
  rarity       TEXT,
  chance       REAL NOT NULL,
  quantity     INTEGER,
  slots        INTEGER NOT NULL DEFAULT 1,
  enemy_chance REAL,
  table_chance REAL,
  conditional  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX drops_item ON drops(item_id);
CREATE INDEX drops_source ON drops(source_id);

CREATE TABLE relics (
  item_id INTEGER PRIMARY KEY REFERENCES items(id),
  tier    TEXT NOT NULL,
  code    TEXT NOT NULL,
  vaulted INTEGER NOT NULL
);

-- Warframes, weapons and companions from WFCD's item catalog.
CREATE TABLE equipment (
  item_id     INTEGER PRIMARY KEY REFERENCES items(id),
  category    TEXT NOT NULL,
  prime       INTEGER NOT NULL,
  counterpart TEXT,
  image_name  TEXT,
  wiki_url    TEXT,
  -- JSON array of plain-text paragraphs from the wiki.
  acquisition TEXT
);

-- Weapon and companion parts, by name (a Warframe's are always its four blueprints).
CREATE TABLE parts (
  owner_id INTEGER NOT NULL REFERENCES items(id),
  part     TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (owner_id, part)
);

-- Item names in other languages, only where they differ from English.
CREATE TABLE names (
  item_id INTEGER NOT NULL REFERENCES items(id),
  lang    TEXT NOT NULL,
  name    TEXT NOT NULL,
  PRIMARY KEY (item_id, lang)
);
`;
