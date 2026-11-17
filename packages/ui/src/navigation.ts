// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

/** What the detail pane shows. */
export type View = { kind: "item"; name: string } | { kind: "source"; key: string };

export interface Navigate {
  openItem(name: string): void;
  openSource(key: string): void;
}
