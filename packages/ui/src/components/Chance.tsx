// Codex — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { formatChance } from "../format";
import { useI18n } from "../i18n/I18nContext";
import styles from "./Chance.module.css";

interface ChanceProps {
  chance: number;
  /** Not a per-attempt chance: marked and explained on hover. */
  conditional?: boolean;
  title?: string;
}

/** A chance on a small lit readout, the one place numbers glow. */
export function Chance({ chance, conditional, title }: ChanceProps) {
  const { t, locale } = useI18n();
  return (
    <span className={styles.visor} title={conditional ? t.table.conditionalNote : title} data-conditional={conditional}>
      {formatChance(chance, locale)}
      {conditional && <span aria-hidden>*</span>}
    </span>
  );
}
