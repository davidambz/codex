// Codex — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import type { ReactNode } from "react";
import styles from "./Tag.module.css";

/** A small rectangular nameplate tag; `lamp` adds the indicator, lit or not. */
export function Tag({ children, lamp }: { children: ReactNode; lamp?: boolean }) {
  return (
    <span className={styles.tag}>
      {lamp !== undefined && <span className="lamp" data-lit={lamp} />}
      {children}
    </span>
  );
}
