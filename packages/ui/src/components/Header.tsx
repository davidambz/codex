// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import type { DataStatus } from "@iaframe/core";
import { useI18n } from "../i18n/I18nContext";
import { formatDate } from "../format";
import { IAFrameMark, RefreshIcon } from "./icons";
import styles from "./Header.module.css";

interface HeaderProps {
  status: DataStatus;
  onUpdate: () => void;
}

/** Nameplate on the left; on the right, the data feed: a lamp lit while the data is current. */
export function Header({ status, onUpdate }: HeaderProps) {
  const { t, locale } = useI18n();
  const when = status.info?.sourceModified || status.info?.ingestedAt;
  let text: string;
  if (status.busy) text = status.info ? t.data.checking : t.data.downloading;
  else if (status.outcome === "failed" && status.info) text = t.data.failed;
  else if (status.outcome === "rejected") text = t.data.rejected;
  else if (when) text = t.data.updatedOn(formatDate(when, locale));
  else text = t.data.downloading;
  const lit = !!status.info && status.outcome !== "failed" && status.outcome !== "rejected";

  return (
    <header className={styles.header}>
      <div className={styles.nameplate}>
        <IAFrameMark />
        <span className={styles.wordmark}>IAFrame</span>
      </div>
      <div className={styles.feed}>
        <span className="lamp" data-lit={lit} />
        <span className={styles.feedText} role="status">
          <span className="label">{t.data.label}</span>
          <span className={styles.feedValue}>{text}</span>
        </span>
        <button
          type="button"
          className={styles.refresh}
          onClick={onUpdate}
          disabled={status.busy}
          aria-label={t.data.update}
          title={t.data.update}
          data-busy={status.busy}
        >
          <RefreshIcon />
        </button>
      </div>
    </header>
  );
}
